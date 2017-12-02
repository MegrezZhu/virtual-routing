const { EventEmitter } = require('events');
const _ = require('lodash');

class Peer extends EventEmitter {
  constructor (sock, context) {
    super();

    this.sock = sock;
    this.context = context;
    this.joined = false;
    this.info = {
      address: sock.raw.remoteAddress,
      port: sock.raw.remotePort,
      name: null
    };

    sock.on('data', this._receive.bind(this));

    sock.on('error', () => { }); // just to catch

    const { io } = this.context;

    this.sock.on('close', () => {
      this.joined && io.error(`Peer ${this.info.name} exited`);
      // TODO: broadcast
      // remove peer info
      this.context.peers.delete(this.info.name);
      this.context.members.delete(this.info.name);
    });
  }

  _receive (data) {
    if (this.joined) {
      switch (data.type) {
        // TODO:
      }
    } else {
      this._auth(data);
    }
  }

  /**
   * check whether name is not duplicated & algo is the same as others
   */
  _auth (data) {
    const context = this.context;
    if (data.algo === context.config.algo && this._checkDuplicate(data)) {
      this.joined = true;
      this.info.name = data.name;

      this.emit('join');
    } else {
      // invalid peer, close connection
      this.sock.end();
    }
  }

  /**
   * true if ok
   */
  _checkDuplicate (data) {
    const context = this.context;
    const dup = _.find([...context.members.entries()], member => member.name === data.name);
    if (!dup) return true;
    if (dup.address !== this.sock.remoteAddress || dup.port !== this.sock.remotePort) return false;
    return dup.connected === false; // same people, but a new direct connection established
  }
}

module.exports = Peer;
