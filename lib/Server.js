const { EventEmitter } = require('events');
const net = require('net');
const io = require('./IOInterface');
const Node = require('./Node');

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
    node.on(Node.SELF_INTRODUCTION, info => {
      node.info = info;
      node.removeAllListeners(Node.SELF_INTRODUCTION);
      this.emit(Server.NEW_NODE, node);
    });
  }
}

Server.NEW_NODE = 'NEW_NODE';

module.exports = Server;
