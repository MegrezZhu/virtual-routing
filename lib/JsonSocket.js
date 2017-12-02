const { EventEmitter } = require('events');
const net = require('net');

class JsonSocket extends EventEmitter {
  constructor (sock = null, delim = ';') {
    super();

    this.delim = delim;
    sock = sock || new net.Socket();
    this.sock = this.raw = sock;
    this.buffer = [];

    this._forwardEvent(sock, 'error');
    this._forwardEvent(sock, 'close');
    this._forwardEvent(sock, 'end');

    sock.on('data', buf => {
      const data = buf.toString('utf8').split(delim);
      while (data.length > 1) {
        this.buffer.push(data.shift());
        this.emit('data', JSON.parse(this.buffer.join('')));
        this.buffer = [];
      }
      this.buffer.push(data.shift());
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
    this.sock.write(JSON.stringify(data), 'utf8');
    this.sock.write(this.delim, 'utf8');
  }
}

module.exports = JsonSocket;
