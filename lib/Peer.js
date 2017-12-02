const { EventEmitter } = require('events');

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
    });
  }

  _receive (data) {
    if (this.joined) {
      // TODO:
    } else {
      this._auth(data);
    }
  }

  /**
   * check whether name is not duplicated & algo is the same as others
   */
  _auth (data) {
    const context = this.context;
    // TODO: check name duplication
    if (data.algo === context.config.algo) {
      this.joined = true;
      this._sendInitData();
      this.info.name = data.name;

      this.emit('join');
    } else {
      // invalid peer, close connection
      this.sock.end();
    }
  }

  _sendInitData () {
    this.sock.send({
      peers: [
        {
          name: this.context.name,
          addr: this.sock.raw.localAddress,
          port: this.sock.raw.localPort
        }
      ]
    });
  }
}

module.exports = Peer;
