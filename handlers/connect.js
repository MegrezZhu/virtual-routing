const config = require('../config');
const inq = require('inquirer');
const router = require('../lib/Router');

module.exports = async args => {
  const { host, port, cost } = await inq.prompt([
    {
      name: 'host',
      message: 'host',
      default: 'localhost'
    },
    {
      name: 'port',
      message: 'port',
      default: config.port,
      validate: port => {
        let num = Number(port);
        if (isNaN(num)) return `port must be a number`;
        if (num >= 1 && num <= 65535) return true;
        else return `port must be a number between 1-65535`;
      }
    },
    {
      name: 'cost',
      message: 'cost',
      validate: cost => {
        return parseInt(cost) >= 0 ? true : 'cost must be positive';
      }
    }
  ]);

  await router.connect(host, port, cost);
};
