const _ = require('lodash');
const Server = require('./Server');
const Node = require('./Node');

class Router {
  async init (name, algo, port) {
    this.name = name;
    this.algo = algo;
    // name to neighbors Nodes
    this.neighbors = new Map();
    // all Nodes' name
    this.nodes = new Set();
    this.nodes.add(this.name);
    // server
    this.server = new Server();
    await this.server.start(port);
    this.server.on(Server.NEW_NODE, this._onNewNode.bind(this));
  }

  _onNewNode (node) {
    const name = node.info.name;

    let refuseReason = null;
    if (this.nodes.has(name)) {
      refuseReason = `Duplicated name: ${name}`;
    } else if (node.info.algo !== this.algo) {
      refuseReason = `Mismatched algorithm: require ${this.algo} but get ${node.info.algo}`;
    }

    if (refuseReason) {
      // refuse connect
      node.send({
        type: Node.CONNECTION_REFUSE,
        content: `Duplicated Name: ${name}`
      });
      node.end();
      return;
    }
    // accept connect
    this.neighbors.set(name, node);
    this.nodes.add(name);
    node.send({
      type: Node.CONNECTION_ACCEPT,
      content: {
        nodes: [...this.nodes],
        self: this.name
      }
    });
    this._handleNodeClose(node);
  }

  /**
   * connect to a neighbor Router
   */
  async connect (host, port, cost) {
    const node = new Node();
    await new Promise((resolve, reject) => {
      // add listener to decide resolve or reject
      node.on(Node.CONNECTION_ACCEPT, data => {
        resolve();
        this.nodes = new Set(data.nodes);
        this.nodes.add(this.name);
        this.neighbors.set(data.self, node);
        node.info = {
          name: data.self,
          algo: this.algo,
          cost
        };
      });
      node.on(Node.CONNECTION_REFUSE, reason => reject(new Error(reason)));
      node.on('error', err => reject(err));
      // send self information
      node.connect({ port, host }, () => {
        node.send({
          type: Node.SELF_INTRODUCTION,
          content: {
            name: this.name,
            algo: this.algo,
            cost
          }
        });
      });
    });
    // remove all listener
    node.removeAllListeners(Node.CONNECTION_ACCEPT);
    node.removeAllListeners(Node.CONNECTION_REFUSE);
    node.removeAllListeners('error');
    // handler this node
    this._handleNodeClose(node);
  }

  broadcast (data) {
    for (const node of this.nodes.values()) {
      node.send(data);
    }
  }

  _handleNodeClose (node) {
    // just catch
    node.on('error', () => {});
    node.on('close', () => {
      this.neighbors.delete(node.info.name);
      this.nodes.delete(node.info.name);
    });
  }
}

module.exports = new Router();
