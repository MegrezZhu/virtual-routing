const IOInterface = require('./IOInterface');
const Router = require('./Router');

const config = require('../config');

const context = {
  io: null,
  router: null,
  name: null,
  config
};

context.io = new IOInterface(context);
context.router = new Router(context);

module.exports = context;
