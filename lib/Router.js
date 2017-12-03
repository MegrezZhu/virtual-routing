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
    } else {
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
    }
  }

  /**
   * connect to a peer Router
   */
  async connect (host, port, cost) {
    const node = new Node();
    await new Promise((resolve, reject) => {
      // add listener to decide resolve or reject
      node.on(Node.CONNECTION_ACCEPT, data => {
        resolve();
        this.nodes = data.nodes;
        this.nodes.add(this.name);
        this.neighbors.set(data.self, node);
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
  }

  /**
   * join a esxisting net or create a new edge
   */
  async establish (host, port, edgeLen) {
    const context = this.context;
    const sock = await this.connect(host, port);
    await this._sendAuth(sock);

    // get first packet back
    sock.once('data', data => {
      if (!data.errno) {
        context.io.result('connection established');

        const peer = new Peer(sock, context);
        peer.joined = true;

        context.peers.set(peer.info.name, peer);

        // sync existing members
        for (const member of data.members) {
          member.name !== context.name && context.members.set(member.name, member);
        }
        peer.info.name = data.self.name;
        peer.info.port = data.self.port;
      }
    });
  }

  /**
   * send auth packet
   */
  _sendAuth (sock) {
    sock.send({
      type: 'auth',
      algo: config.algo,
      name: this.context.name,
      port: this.port
    });
  }

  broadcast (data) {
    for (const peer of this.context.peers.values()) {
      peer.sock.send(data);
    }
  }

  sendInitDataTo (peer) {
    // TODO: send DV
    peer.sock.send({
      type: 'init',
      self: {
        name: this.context.name,
        port: this.context.port
      },
      members: [
        ...[...this.context.members.values()].map(o => _.pick(o, ['name', 'address', 'port'])), // others
        {
          name: this.context.name,
          address: peer.sock.raw.localAddress,
          port: peer.sock.raw.localPort
        }
      ]
    });
  }
}

module.exports = new Router();
