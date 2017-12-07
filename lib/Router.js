const assert = require('assert');
const { EventEmitter } = require('events');

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
    if (this.nodes.has(name)) {
      refuseReason = `Duplicated name: ${name}`; // FIXME: dual edge?
    } else if (node.info.algoName !== this.algo.name) {
      refuseReason = `Mismatched algorithm: require ${this.algo.name} but get ${node.info.algoName}`;
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
  }
}

Router.NEW_NEIGHBOR = Router.prototype.NEW_NEIGHBOR = 'NEW_NEIGHBOR';

module.exports = new Router();
