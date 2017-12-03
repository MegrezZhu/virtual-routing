const assert = require('assert');
const router = require('../lib/Router');

module.exports = args => {
  const [, what] = args._;
  assert(what, 'what do you want to show?');
  switch (what) {
    case 'nodes':
      for (const node of router.nodes.values()) {
        console.log(`\t${node}`);
      }
      break;
    case 'neighbors':
      for (const neighbor of router.neighbors.keys()) {
        console.log(`\t${neighbor}`);
      }
      break;
    default:
      throw new Error(`unknown "${what}"`);
  }
};
