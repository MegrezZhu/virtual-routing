const { EventEmitter } = require('events');
const Message = require('./Message');
const net = require('net');
const _ = require('lodash');

/**
 * handling raw socket instance, wrapping communications between sockets
 * emits: 'error', 'close', 'end', [EVENT_TYPE]
 */
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
        const msg = Message.fromObject(JSON.parse(_.unescape(data.shift())));
        msg.addSelfToPath();
        this.emit(msg.header.type, msg);
      }
      this.buffer = data.shift();
    });

    this.info = {
      name: null,
      algoName: null,
      cost: null
    };
  }

  _forwardEvent (eventEmitter, eventName) {
    eventEmitter.on(eventName, (...args) => {
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

  changeCost (newCost) {
    this.info.cost = newCost;
    this.emit(Node.EDGE_LENGTH_CHANGED, newCost);
  }
}

Node.EDGE_LENGTH_CHANGED = 'Node.EDGE_LENGTH_CHANGED';

module.exports = Node;
