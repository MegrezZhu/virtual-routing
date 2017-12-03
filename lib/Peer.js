const { EventEmitter } = require('events');
const _ = require('lodash');

class Peer extends EventEmitter {
  constructor (sock) {
    super();

    this.sock = sock;
    // this.context = context;
    this.joined = false;
    this.info = {
      address: sock.raw.remoteAddress,
      port: null,
      name: null
    };

    sock.on('data', this._receive.bind(this));

    sock.on('error', () => { }); // just to catch

    this.sock.on('close', () => {
      this.emit('logout');
    });

    this.on('authed', this._onAuthed.bind(this));
    this.on('newMember', this._onNewMember.bind(this));
    this.on('memberLogout', this._onMemberLogout.bind(this));
    this.on('logout', this._onLogout.bind(this));
  }

  _onAuthed () {
    // new directly-connected peer
    const context = this.context;
    const { io } = context;
    io.result(`new connection from ${this.info.name}@${this.info.address}:${this.info.port}`);

    const info = {
      name: this.info.name,
      address: this.info.address,
      port: this.info.port,
      connected: true // directly connected to local host
    };

    // broadcast new member
    context.router.broadcast({
      type: 'newMember',
      info: _.omit(info, 'connected')
    });

    context.peers.set(this.info.name, this);
    context.members.set(this.info.name, info);
  }

  _onNewMember (data) {
    const context = this.context;
    const { io } = context;
    if (!context.members.has(data.info.name)) {
      io.result(`new member: ${data.info.name}@${data.info.address}:${data.info.port}`);
      context.members.set(data.info.name, data.info);
      context.router.broadcast(data);
    }
  }

  _onLogout () {
    const context = this.context;
    const {io} = context;
    this.joined && io.error(`Peer ${this.info.name} disconnected`);

    // remove peer info
    context.peers.delete(this.info.name);
    context.members.delete(this.info.name);

    // broadcast logged out member
    context.router.broadcast({
      type: 'memberLogout',
      name: this.info.name
    });
  }

  _onMemberLogout (data) {
    const context = this.context;
    const { io } = context;
    if (context.members.has(data.name)) {
      io.error(`Peer ${data.name} logged out`);
      context.members.delete(data.name);
      context.router.broadcast(data);
    }
  }

  _receive (data) {
    if (this.joined) {
      this.emit(data.type, data);
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
      this.info.port = data.port;

      this.emit('authed', this);
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
    if (dup.address !== this.info.address || dup.port !== data.port) return false;
    return dup.connected === false; // same people, but a new direct connection established
  }
}

module.exports = Peer;
