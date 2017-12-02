const net = require('net');
const { EventEmitter } = require('events');
const _ = require('lodash');

const Peer = require('./Peer');
const JsonSocket = require('./JsonSocket');
const config = require('../config');

class Router extends EventEmitter {
  constructor (context) {
    super();

    this.port = null;

    this.context = context;
  }

  async listen (port = config.port) {
    this.port = this.context.port = port;
    this.server = net.createServer(this._onConnection.bind(this));

    await new Promise((resolve, reject) => {
      this.server.once('error', err => {
        reject(err);
      });

      this.server.once('listening', () => {
        this.context.io.result(`Router lisening at port ${port}`);
        resolve();
      });
      this.server.listen(port);
    });

    this.server.removeAllListeners('error');
    this.server.on('error', err => {
      // fatal
      console.error(err);
      process.exit(1);
    });
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
   * connect to a peer Router
   */
  async connect (host, port) {
    const socket = new JsonSocket();
    return new Promise((resolve, reject) => {
      // create connection
      socket.connect({ port, host }, () => {
        socket.removeAllListeners('error');
        resolve(socket);
      });

      socket.once('error', reject);
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

  _onConnection (sock) {
    sock = new JsonSocket(sock); // wrap
    const context = this.context;
    const peer = new Peer(sock, context);

    peer.on('authed', () => {
      this.sendInitDataTo(peer);
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

module.exports = Router;
