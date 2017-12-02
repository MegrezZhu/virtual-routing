const net = require('net');
const { EventEmitter } = require('events');

class Router extends EventEmitter {
  constructor (context, port = 23333) {
    super();

    this.context = context;
    this.listen(port);
  }

  listen (port) {
    this.server = net.createServer(this._onConnection.bind(this));

    this.server.on('error', err => {
      throw err;
    });
    this.server.listen(port, () => {
      const { io } = this.context;
      io.result(`Router listening at port ${port}`);
    });
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
