const assert = require('assert');
const { EventEmitter } = require('events');

const chalk = require('chalk');

const Server = require('./Server');
const Node = require('./Node');
const io = require('./IOInterface');
const algorithms = require('../algo');

/**
 * managing Server, Algo, global infomations
 * handling connection establishing
 */
class Router extends EventEmitter {
  async init (name, algo, port) {
    this.name = name;
    this.neighbors = new Map(); // name to neighbors Nodes
    this.nodes = new Set(); // all Nodes' name, managed by algo instance

    this.server = new Server(); // server
    await this.server.start(port);
    this.server.on(Server.NEW_CONNECTION, this._onNewNode.bind(this));
    this.server.on(Server.LOST_CONNECTION, node => {
      this.neighbors.delete(node.info.name);
    });

    this._installAlgo(algo);
  }

  _installAlgo (algoName) {
    assert(algorithms[algoName], `Unknown routing algorithm "${algoName}"`);
    const Algo = algorithms[algoName];
    this.algo = new Algo().install(this);
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
      node.send({
        type: Node.CONNECTION_REFUSE,
        content: `Connection refused: ${refuseReason}`
      });
      node.end();
      return;
    }

    // accept connect
    this.neighbors.set(name, node);
    node.send({
      type: Node.CONNECTION_ACCEPT,
      content: {
        self: this.name
      }
    });
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
      node.on(Node.CONNECTION_ACCEPT, data => {
        this.nodes = new Set(data.nodes);
        this.nodes.add(this.name);
        this.neighbors.set(data.self, node);
        node.info = {
          name: data.self,
          algoName: this.algo.name,
          cost
        };

        io.result(`Connection with [${data.self}] established.`);
        resolve();
      });
      node.on(Node.CONNECTION_REFUSE, reason => reject(new Error(reason)));
      // send self information
      node.connect({ port, host }, () => {
        node.send({
          type: Node.SELF_INTRODUCTION,
          content: {
            name: this.name,
            algoName: this.algo.name,
            cost
          }
        });
      });
    });
    // remove all listeners
    node.removeAllListeners(Node.CONNECTION_ACCEPT);
    node.removeAllListeners(Node.CONNECTION_REFUSE);

    node.on('close', () => {
      this.server.emit(Server.LOST_CONNECTION, node);
    });

    // handle this node
    this._handleNodeEvent(node);

    this.emit(Router.NEW_NEIGHBOR, node);
  }

  broadcast (type, content) {
    for (const node of this.neighbors.values()) {
      node.send({
        type,
        content
      });
    }
  }

  _handleNodeEvent (node) {
    // for close
    node.on('error', () => {});

    // handle packet forwarding
    node.on(Router.PACKET_FORWARDING, ({ type, content }, { from, to, path }) => {
      if (to === this.name) {
        // destination
        io.result(`Packet Received: from ${from}, via ${[...path, this.name].reduce((res, name) => `${res}->${name}`)}`);
        node.emit(type, content);
      } else {
        // forwarding
        const route = this.algo.route.routeInfo.get(to);
        if (!route || route.len === Infinity) return io.error(`Packet Forwarding (${from} → ${to}): Route to ${to} not exists!`);
        const byNode = this.neighbors.get(route.by);
        byNode.send({
          type: Router.PACKET_FORWARDING,
          header: { from, to, path: [...path, this.name] },
          content: { type, content }
        });
        io.result(`Packet Forwarding (${from} → ${to}): forward via ${route.by}`);
      }
    });

    // handle messages
    node.on(Node.MESSAGE, ({ from, data }) => {
      io.result(`${chalk.green('[Message]')} ${from}: ${data}`);
    });
  }

  setEdge (name, len) {
    const node = this.neighbors.get(name);
    assert(node, `${name} is not a neighbor!`);

    node.info.cost = len;
    node.send({
      type: Node.EDGE_LENGTH_CHANGED,
      content: len
    });
    node.emit(Node.EDGE_LENGTH_CHANGED, len);
  }

  send (name, data) {
    const route = this.algo.route.routeInfo.get(name);
    assert(route && route.len !== Infinity, `Route to "${name}" not exists!`);
    const byName = route.by;
    assert(byName, `${chalk.red('[Fatal]')} Route to ${name} not exists!`);

    const node = this.neighbors.get(byName);
    node.send({
      type: Router.PACKET_FORWARDING,
      header: {
        from: this.name,
        to: name,
        path: [this.name]
      },
      content: {
        type: Node.MESSAGE,
        content: { from: this.name, data }
      }
    });
  }
}

Router.NEW_NEIGHBOR = Router.prototype.NEW_NEIGHBOR = 'NEW_NEIGHBOR';
Router.PACKET_FORWARDING = Router.prototype.PACKET_FORWARDING = 'PACKET_FORWARDING';

module.exports = new Router();
