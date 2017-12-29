const assert = require('assert');
const { EventEmitter } = require('events');

const chalk = require('chalk');

const Server = require('./Server');
const Node = require('./Node');
const io = require('./IOInterface');
const Message = require('./Message');

let instance;

/**
 * managing Server, Algo, global infomations
 * handling connection establishing
 */
class Router extends EventEmitter {
  async init (name, port) {
    this.name = name;
    this.neighbors = new Map(); // name to neighbors Nodes
    this.nodes = new Set(); // all nodes

    this.server = new Server(); // server
    await this.server.start(port);
    this.server.on(Server.NEW_CONNECTION, this._onNewNode.bind(this));
    this.server.on(Server.LOST_CONNECTION, node => {
      this.neighbors.delete(node.info.name);
      io.result(`Lost connection with: ${node.info.name}`);
    });
  }

  installAlgo (algo) {
    algo.init(this);
    this.algo = algo;
  }

  // A node connect to this
  _onNewNode (node) {
    const name = node.info.name;

    // check whether accept connection
    let refuseReason = null;
    if (node.info.algoName !== this.algo.name) {
      refuseReason = `Mismatched algorithm: require ${this.algo.name} but get ${node.info.algoName}`;
    }
    if (this.neighbors.has(name)) {
      refuseReason = `A connection between ${this.name} & ${name} has already been built`;
    }

    // refuse connect
    if (refuseReason) {
      node.send(new Message(Message.CONNECTION_REFUSE, name, {
        reason: `Connection refused: ${refuseReason}`
      }));
      node.end();
      return;
    }

    // accept connect
    this.neighbors.set(name, node);
    node.send(new Message(Message.CONNECTION_ACCEPT, name, {
      name: this.name
    }));
    io.result(`New connection: ${name}`);

    // handle event
    this._handleNodeEvent(node);

    this.emit(Router.NEW_NEIGHBOR, node); // for algorithm hooking
  }

  // this connect to other node
  async connect (host, port, cost) {
    const node = new Node();
    await new Promise((resolve, reject) => {
      // add listener to decide resolve or reject
      node.on(Message.CONNECTION_ACCEPT, msg => {
        this.neighbors.set(msg.data.name, node);
        node.info = {
          name: msg.data.name,
          algoName: this.algo.name,
          cost
        };

        io.result(`Connection with [${msg.data.name}] established.`);
        resolve();
      });
      node.on(Message.CONNECTION_REFUSE, msg => reject(new Error(msg.data.reason)));
      // send self information
      node.connect({ port, host }, () => {
        node.send(new Message(Message.SELF_INTRODUCTION, node.info.name, {
          name: this.name,
          algoName: this.algo.name,
          cost
        }));
      });
    });
    // remove all listeners
    node.removeAllListeners(Message.CONNECTION_ACCEPT);
    node.removeAllListeners(Message.CONNECTION_REFUSE);

    // handle this node
    this._handleNodeEvent(node);

    this.emit(Router.NEW_NEIGHBOR, node);
  }

  broadcast (msg) {
    for (const node of this.neighbors.values()) {
      msg.header.to = node.info.name;
      node.send(msg);
    }
  }

  _handleNodeEvent (node) {
    // for close
    node.on('error', () => {});

    // handle packet forwarding
    node.on(Message.PACKET_FORWARDING, msg => {
      if (msg.header.to === this.name) {
        // destination
        io.result(`Packet Received: from ${msg.header.from}, via ${msg.header.path.reduce((res, name) => `${res}->${name}`)}`);
        this.emit(msg.data.type, msg);
      } else {
        // forwarding
        const route = this.algo.route.routeInfo.get(msg.header.to);
        if (!route || route.len === Infinity) return io.error(`Packet Forwarding (${msg.header.from} → ${msg.header.to}): Route to ${msg.header.to} not exists!`);
        const byNode = this.neighbors.get(route.by);
        // msg.header.path.push(this.name);
        byNode.send(msg);
        io.result(`Packet Forwarding (${msg.header.from} → ${msg.header.to}): forward via ${route.by}`);
      }
    });
  }

  setEdge (name, length) {
    const node = this.neighbors.get(name);
    assert(node, `${name} is not a neighbor!`);

    node.changeCost(length);
    node.send(new Message(Message.EDGE_LENGTH_CHANGED, name, {
      length
    }));
  }

  send (name, data) {
    const route = this.algo.route.routeInfo.get(name);
    assert(route && route.len !== Infinity, `Route to "${name}" not exists!`);
    const byName = route.by;
    assert(byName, `${chalk.red('[Fatal]')} Route to ${name} not exists!`);

    const node = this.neighbors.get(byName);
    node.send(new Message(Message.PACKET_FORWARDING, name, {
      type: Router.ECHO,
      data
    }));
  }
}

// router event constant
Router.NEW_NEIGHBOR = 'ROUTER.NEW_NEIGHBOR';
Router.ECHO = 'ROUTER.ECHO';

Router.getInstance = () => {
  if (!instance) instance = new Router();
  return instance;
};

module.exports = Router;
