const { EventEmitter } = require('events');
const net = require('net');

class JsonSocket extends EventEmitter {
  constructor (sock = null, delim = ';') {
    super();

    this.delim = delim;
    sock = sock || new net.Socket();
    this.sock = this.raw = sock;
    this.buffer = '';

    this._forwardEvent(sock, 'error');
    this._forwardEvent(sock, 'close');
    this._forwardEvent(sock, 'end');

    sock.on('data', buf => {
      this.buffer += buf.toString('utf8');
      const data = this.buffer.split(this.delim);
      while (data.length > 1) {
        this.emit('data', JSON.parse(data.shift()));
      }
      this.buffer = data.shift();
    });
  }

  _forwardEvent (sock, eventName) {
    sock.on(eventName, (...args) => {
      this.emit(eventName, ...args);
    });
  }

  connect (...args) {
    this.sock.connect(...args);
  }

  send (data) {
    this.sock.write(`${JSON.stringify(data)};`, 'utf8');
  }
}

module.exports = JsonSocket;
