const IOInterface = require('./IOInterface');
const Router = require('./Router');

const context = {
  io: null,
  router: null,
  name: null
};

context.io = new IOInterface(context);
context.router = new Router(context);

module.exports = context;
