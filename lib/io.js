const chalk = require('chalk');
const inq = require('inquirer');

class IOInterface {
  constructor (context) {
    this.context = context;
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
        this.handler && await this.handler(this.context, inst.trim());
      } catch (err) {
        this.error(err.message);
      }
    }
  }

  registInputHandler (fn) {
    this.handler = fn;
  }

  error (err) {
    console.log(`${chalk.red('×')}  ${err.message || err}`);
  }

  result (what) {
    console.log(`${chalk.cyan('!')}  ${what}`);
  }
}

module.exports = IOInterface;
