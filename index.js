const parser = require('yargs-parser');
const assert = require('assert');

const handlers = require('./handlers');
const { io, context } = require('./lib');

startup(); // start the application

async function startup () {
  io.on('input', handleInput);
  const name = await io.prompt('name: ', i => !!i, 'shall not be empty');
  context.name = name;
  io.result(`get name: ${name}`);
}

function handleInput (context, input) {
  const args = parser(input);
  const [command] = args._;
  assert(command, 'command required');
  assert(handlers[command], `command "${command}" not found`);
  handlers[command](context, args);
}
