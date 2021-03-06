const assert = require('assert');
const router = require('../lib/Router').getInstance();

module.exports = args => {
  const [, what] = args._;
  assert(what, 'what do you want to show?');
  switch (what) {
    case 'nodes':
      console.log('\tname');
      console.log(`\t${router.name} (you)`);
      for (const node of router.nodes) {
        console.log(`\t${node}`);
      }
      break;
    case 'neighbors':
      console.log('\tname\tcost');
      for (const neighbor of router.neighbors.values()) {
        console.log(`\t${neighbor.info.name}\t${neighbor.info.cost}`);
      }
      break;
    case 'route':
      console.log(`\tname\tdistance\tnext_hop`);
      for (const [name, { length, by }] of router.algo.getRoute().entries()) {
        console.log(`\t${name}\t${length === 16 ? 'Inf' : length}\t\t${by}`);
      }
      break;
    default:
      throw new Error(`unknown "${what}"`);
  }
};
