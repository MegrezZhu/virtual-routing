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

  // A node connect to this
  _onNewNode (node) {
    const name = node.info.name;

    // check whether accept connection
    let refuseReason = null;
    if (this.nodes.has(name)) {
      refuseReason = `Duplicated name: ${name}`;
    } else if (node.info.algoName !== this.algo.name) {
      refuseReason = `Mismatched algorithm: require ${this.algo.name} but get ${node.info.algoName}`;
    }

    // refuse connect
    if (refuseReason) {
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

    // handle event
    this._handleNodeEvent(node);

    // broadcast
    this.broadcast(Router.NODE_IN, node.info.name);
  }

  // this connect to other node
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
          algoName: this.algo.name,
          cost
        };
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
    node.on('close', () => {
      const name = node.info.name;
      this.neighbors.delete(name);
      this.nodes.delete(name);
      this.broadcast(Router.NODE_OUT, name);
    });

    // for NODE_IN
    node.on(Router.NODE_IN, name => {
      if (!this.nodes.has(name)) {
        this.nodes.add(name);
        this.broadcast(Router.NODE_IN, name);
      }
    });

    // for NODE_OUT
    node.on(Router.NODE_OUT, name => {
      if (this.nodes.has(name)) {
        this.nodes.delete(name);
        this.broadcast(Router.NODE_OUT, name);
      }
    });
  }
}

Router.NODE_IN = 'NODE_IN';
Router.NODE_OUT = 'NODE_OUT';

module.exports = new Router();
