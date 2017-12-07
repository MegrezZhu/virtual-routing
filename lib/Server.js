const { EventEmitter } = require('events');
const net = require('net');
const io = require('./IOInterface');
const Node = require('./Node');

/**
 * handling nodes in & out
 * emits: NEW_CONNECTION & LOST_CONNECTION
 */
class Server extends EventEmitter {
  constructor () {
    super();
    // start up the server
    this.server = net.createServer(this._onConnection.bind(this));
    this.server.on('error', err => {
      console.error(err);
    });
  }

  async start (port) {
    await new Promise((resolve, reject) => {
      this.server.once('listening', () => {
        io.result(`Listen at port ${this.server.address().port}`);
        resolve();
      });
      this.server.listen(port);
    });
  }

  _onConnection (socket) {
    const node = new Node(socket);
    node.once(Node.SELF_INTRODUCTION, info => {
      node.info = info;
      this.emit(Server.NEW_CONNECTION, node);
    });

    node.once('close', () => {
      this.emit(Server.LOST_CONNECTION, node);
    });
  }
}

Server.NEW_CONNECTION = 'NEW_CONNECTION';
Server.LOST_CONNECTION = 'LOST_CONNECTION';

module.exports = Server;
