const config = require('../config');
const inq = require('inquirer');

module.exports = async (ctx, args) => {
  const { host, port } = await inq.prompt([
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
    }
  ]);

  const { io, router } = ctx;
  await router.establish(host, port); // TODO add edge length
};
