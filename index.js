const assert = require('assert');
const crypto = require('crypto');
const parser = require('yargs-parser');
const inq = require('inquirer');
const chalk = require('chalk');

const io = require('./lib/IOInterface');
const Router = require('./lib/Router');
const Message = require('./lib/Message');
const router = Router.getInstance();
const algorithms = require('./algo');
const handlers = require('./handlers');
const config = require('./config');

const port = Number(process.env.PORT) || config.port || 0;

startup() // start the application
  .catch(err => {
    io.error(err.message);
    process.exit(1);
  });

async function startup () {
  const name = await promptName();
  console.log(' ---- use "help" to see more commands ----');
  io.registInputHandler(handleInput);

  await router.init(name, port);
  const Algo = algorithms[config.algo];
  await router.installAlgo(new Algo());

  Message.init(router.name);

  router.on(Router.ECHO, msg => {
    io.result(`${chalk.green('[Message]')} ${msg.header.from}: ${msg.data.data}`);
  });

  await io.run();
}

async function promptName () {
  const {name} = await inq.prompt([{
    name: 'name',
    message: 'your name',
    default: crypto.randomBytes(3).toString('hex').toUpperCase()
  }]);
  return name;
}

async function handleInput (input) {
  if (!input) return;
  const args = parser(input);
  const [command] = args._;

  assert(command, 'command required');
  assert(handlers[command], `command "${command}" not found`);

  return handlers[command](args);
}

process.on('uncaughtException', err => {
  console.error(chalk.bgRed('uncaughtException'));
  console.error(err);
});
