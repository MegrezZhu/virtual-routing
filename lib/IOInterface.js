const chalk = require('chalk');
const inq = require('inquirer');

class IOInterface {
  constructor () {
    this.handler = null;
  }

  async run () {
    while (true) {
      try {
        const { inst } = await inq.prompt([{
          message: `\b `,
          name: 'inst',
          prefix: `${chalk.gray('λ')}`
        }]);
        this.handler && await this.handler(inst.trim());
      } catch (err) {
        this.error(err.message);
      }
    }
  }

  registInputHandler (fn) {
    this.handler = fn;
  }

  error (err) {
    console.log(`\r${chalk.red('×')}  ${err.message || err}`);
  }

  result (what) {
    console.log(`\r${chalk.cyan('!')}  ${what}`);
  }
}

module.exports = new IOInterface();
