const inq = require('inquirer');
const router = require('../lib/Router');

module.exports = async () => {
  const { name } = await inq.prompt([{
    name: 'name',
    message: 'to: ',
    validate: name => {
      if (router.neighbors.has(name)) return true;
      return 'Not a direct-connected neighbor';
    }
  }]);
  const { len } = await inq.prompt([{
    name: 'len',
    message: `Set length to (current ${router.algo.route.edges.get(name)})`,
    validate: len => {
      return Number(len) >= 0 ? true : 'Length must be positive';
    }
  }]);

  router.setEdge(name, Number(len));
};
