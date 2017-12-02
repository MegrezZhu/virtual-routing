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

    return new Promise((resolve, reject) => {
      this.server.on('error', err => {
        reject(err);
      });

      this.server.on('listening', () => {
        this.context.io.result(`Router lisening at port ${port}`);
        resolve();
      });

      this.server.listen(port);
    });
  }

  /**
   * join a esxisting net or create a new edge
   */
  async establish (host, port, edgeLen) {
    const sock = await this.connect(host, port);
    await this._sendAuth(sock);

    sock.once('data', data => {
      // get first packet back
      if (!data.errno) {
        // TODO
        console.log('connection acknowledged!');
        console.log(data);
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

  async _sendAuth (sock) {
    sock.send({
      type: 'auth',
      algo: config.algo,
      name: this.context.name
    });
    console.log('auth sent');
  }

  _onConnection (sock) {
    sock = new JsonSocket(sock); // wrap
    const { io } = this.context;
    const peer = new Peer(sock, this);

    peer.on('join', () => {
      // TODO: add to peer list
      io.result(`new connection from ${sock.raw.remoteAddress}:${sock.raw.remotePort}`);
    });
  }

  _onClose (peer) {

  }
}

module.exports = Router;
