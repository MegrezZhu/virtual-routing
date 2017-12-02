const net = require('net');
const { EventEmitter } = require('events');
const chalk = require('chalk');

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
        // TODO: create Peer
        console.log('connection acknowledged!');
        console.log(data);

        const peer = new Peer(sock, this.context);
        peer.joined = true;
        peer.info.name = data.name;
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
      // TODO: add to peer list
      io.result(`new connection from ${peer.info.name}@${peer.info.address}:${peer.info.port}`);
    });
  }
}

module.exports = Router;
