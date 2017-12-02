const net = require('net');
const { EventEmitter } = require('events');
const chalk = require('chalk');

const config = require('../config');

class Router extends EventEmitter {
  constructor (context, port = config.port) {
    super();

    this.context = context;
    this.listen(port);
  }

  listen (port) {
    this.server = net.createServer(this._onConnection.bind(this));

    this.server.on('error', err => {
      console.error(err.message);
      throw err;
    });

    this.server.on('listening', () => {
      const { io } = this.context;
      console.log(`\r${chalk.cyan('!')}  Router lisening at port ${port}`);
      process.stdout.write(`${chalk.gray('λ')} `);
    });

    this.server.listen(port);
  }

  /**
   * connect to a peer Router
   * @param {String} host
   * @param {Number} port
   */
  connect (host, port) {

  }

  _onConnection (peer) {
    peer.on('close', () => {
      this._onClose(peer);
    });
  }

  _onClose (peer) {

  }
}

module.exports = Router;
