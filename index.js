const parser = require('yargs-parser');
const assert = require('assert');

const handlers = require('./handlers');
const { context } = require('./lib');

const { io, router } = context;

startup(); // start the application

async function startup () {
  io.setInputHandler(handleInput);
  io.println('\r---- use "help" to see more commands ----');
}

async function handleInput (context, input) {
  const args = parser(input);
  const [command] = args._;

  assert(command, 'command required');
  assert(handlers[command], `command "${command}" not found`);

  return handlers[command](context, args);
}
