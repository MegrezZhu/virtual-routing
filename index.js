const parser = require('yargs-parser');
const assert = require('assert');

const handlers = require('./handlers');
const { context } = require('./lib');
const config = require('./config');

const { io, router } = context;

const port = process.env.PORT || config.port;

startup() // start the application
  .catch(err => {
    io.error(err.message);
    process.exit(1);
  });

async function startup () {
  console.log(' ---- use "help" to see more commands ----');
  io.registInputHandler(handleInput);

  await router.listen(port);

  await io.run();
}

async function handleInput (context, input) {
  const args = parser(input);
  const [command] = args._;

  assert(command, 'command required');
  assert(handlers[command], `command "${command}" not found`);

  return handlers[command](context, args);
}
