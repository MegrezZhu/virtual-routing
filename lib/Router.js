const net = require('net');
const { EventEmitter } = require('events');
const _ = require('lodash');

const Peer = require('./Peer');
const JsonSocket = require('./JsonSocket');
const config = require('../config');

class Router extends EventEmitter {
  constructor (context) {
    super();

    this.context = context;
  }

  async listen (port = config.port) {
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
    const sock = await this.connect(host, port);
    await this._sendAuth(sock);

    // get first packet back
    sock.once('data', data => {
      if (!data.errno) {
        console.log('connection acknowledged!');
        console.log(data);

        const peer = new Peer(sock, this.context);
        peer.joined = true;

        this.context.peers.set(peer.info.name, peer);

        // sync existing members
        for (const member of data.members) {
          this.context.members.set(member.name, member);
        }
        peer.info.name = data.self.name;
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
  async _sendAuth (sock) {
    sock.send({
      type: 'auth',
      algo: config.algo,
      name: this.context.name
    });
  }

  _onConnection (sock) {
    sock = new JsonSocket(sock); // wrap
    const { io } = this.context;
    const peer = new Peer(sock, this.context);

    peer.on('join', () => {
      io.result(`new connection from ${peer.info.name}@${peer.info.address}:${peer.info.port}`);

      this.sendInitDataTo(peer);
      // TODO: broadcast to net

      this.context.peers.set(peer.info.name, peer);
      this.context.members.set(peer.info.name, {
        name: peer.info.name,
        address: peer.info.address,
        port: peer.info.port,
        distance: -1,
        connected: true // directly connected to local host
      });
    });
  }

  sendInitDataTo (peer) {
    // TODO: send DV
    peer.sock.send({
      type: 'init',
      self: {
        name: this.context.name
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
