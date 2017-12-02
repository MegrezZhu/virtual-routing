const net = require('net');
const { EventEmitter } = require('events');
const chalk = require('chalk');

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
   * connect to a peer Router
   * @param {String} host
   * @param {Number} port
   */
  async connect (host, port) {
    const socket = new net.Socket();
    return new Promise((resolve, reject) => {
      socket.connect(port, host, resolve);
      socket.on('error', reject);
    });
  }

  _onConnection (peer) {
    const { io } = this.context;
    const addr = peer.address();
    io.result(`new connection from ${addr.address}:${addr.port}`);
    peer.on('close', () => {
      this._onClose(peer);
    });
  }

  _onClose (peer) {

  }
}

module.exports = Router;
