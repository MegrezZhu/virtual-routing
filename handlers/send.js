const inq = require('inquirer');
const router = require('../lib/Router').getInstance();

module.exports = async () => {
  const { name } = await inq.prompt([{
    name: 'name',
    message: 'to: ',
    validate: name => {
      if (router.algo.route.routeInfo.has(name)) return true;
      return `Route to ${name} not exists!`;
    }
  }]);

  const { data } = await inq.prompt([{
    name: 'data',
    message: `Say:`,
    validate: data => {
      if (data.length) return true;
      return `Hey don't be shy just say something!`;
    }
  }]);

  router.send(name, data);
};
