const { EventEmitter } = require('events');

class Peer extends EventEmitter {
  constructor (sock, router) {
    super();

    this.sock = sock;
    this.router = router;
    this.joined = false;

    sock.on('data', this._receive.bind(this));
    sock.on('error', () => {});
  }

  _receive (data) {
    if (this.joined) {

    } else {
      // auth
      if (this._auth(data)) {
        const {io} = this.router.context;
        this.joined = true;
        this._sendInitData();
        this.emit('join', data);
        this.sock.on('close', err => {
          io.error(err);
        });
      } else {
        // invalid peer, close connection
        this.sock.end();
      }
    }
  }

  _auth (data) {
    return true;
  }

  _sendInitData () {
    this.sock.send({
      peers: [
        {
          name: this.router.context.name,
          addr: this.sock.raw.localAddress,
          port: this.sock.raw.localPort
        }
      ]
    });
  }
}

module.exports = Peer;
