const IOInterface = require('./IOInterface');
const Router = require('./Router');

const config = require('../config');

const context = {
  io: null,
  router: null,
  name: null,
  config,
  port: null, // currently listening port
  peers: new Map(), // name to Peer
  members: new Map() // name to all members' info (name, ip, port...)
};

context.io = new IOInterface(context);
context.router = new Router(context);

module.exports = context;
