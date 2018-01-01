const { EventEmitter } = require('events');
const net = require('net');
const io = require('./IOInterface');
const Node = require('./Node');
const Message = require('./Message');

/**
 * handling nodes in & out
 * emits: error, NEW_CONNECTION, LOST_CONNECTION
 */
class Server extends EventEmitter {
  constructor () {
    super();
    // create the server
    this.server = net.createServer(this._onConnection.bind(this));
    this._forwardEvent(this.server, 'error');
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
    this.emit(Server.NEW_CONNECTION, node);
  }

  _forwardEvent (eventEmitter, eventName) {
    eventEmitter.on(eventName, (...args) => {
      this.emit(eventName, ...args);
    });
  }
}

// server event constant
Server.NEW_CONNECTION = 'SERVER.NEW_CONNECTION';

module.exports = Server;
