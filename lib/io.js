const chalk = require('chalk');
const { EventEmitter } = require('events');
const readline = require('readline');

class IOInterface extends EventEmitter {
  constructor (context) {
    super();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.rl = rl;
    this.mode = 'INPUT'; // or PROMPT
    this.context = context;
    this.handler = {};
    this.prefix();

    rl.on('line', async line => {
      try {
        rl.pause();
        const what = line.trim();
        if (this.mode === 'INPUT') await this.inputHandler(context, what);
        else this.promptHandler && this.promptHandler(what);
      } catch (err) {
        this.error(err);
      } finally {
        rl.resume();
        this.prefix();
      }
    });
  }

  setInputHandler (fn) {
    this.inputHandler = fn;
  }

  _updatePromptHandler (handler) {
    this.promptHandler = handler;
  }

  print (what) {
    process.stdout.write(what);
  }

  println (what) {
    this.print(what + '\n');
    this.prefix();
  }

  prefix () {
    this.print('\r');
    if (this.mode === 'INPUT') this.print(chalk.gray('> '));
    else this.print(chalk.green('? '));
  }

  error (err) {
    this.println(`\r${chalk.red('×')} ${err.message}`);
  }

  async prompt (question, checkFn, errMsg) {
    this.mode = 'PROMPT';
    try {
      while (true) {
        this.prefix();
        this.print(question);
        const input = await new Promise(resolve => {
          this._updatePromptHandler(resolve);
        });
        if (!checkFn || checkFn(input)) return input;
        else this.error(new Error(errMsg));
      }
    } finally {
      this.mode = 'INPUT';
    }
  }

  result (what) {
    this.println(`\r${chalk.cyan('!')} ${what}`);
  }
}

module.exports = IOInterface;
