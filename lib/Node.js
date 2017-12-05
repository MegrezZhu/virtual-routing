const { EventEmitter } = require('events');
const net = require('net');
const _ = require('lodash');

class Node extends EventEmitter {
  constructor (sock = null, delim = '<') {
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
        const obj = JSON.parse(_.unescape(data.shift()));
        this.emit(obj.type, obj.content);
      }
      this.buffer = data.shift();
    });

    this.info = {
      name: null,
      algo: null,
      cost: null
    };
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
    this.sock.write(`${_.escape(JSON.stringify(data))}${this.delim}`, 'utf8');
  }

  end () {
    this.sock.end();
  }
}

Node.SELF_INTRODUCTION = 'SELF_INTRODUCTION';
Node.CONNECTION_REFUSE = 'CONNECTION_REFUSE';
Node.CONNECTION_ACCEPT = 'CONNECTION_ACCEPT';

module.exports = Node;
