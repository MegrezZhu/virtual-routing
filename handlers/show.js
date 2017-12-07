const assert = require('assert');
const router = require('../lib/Router');

module.exports = args => {
  const [, what] = args._;
  assert(what, 'what do you want to show?');
  switch (what) {
    case 'nodes':
      console.log('\tname');
      for (const node of router.nodes.values()) {
        console.log(`\t${node}${node === router.name ? '(you)' : ''}`);
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
      for (const [name, { len, by }] of router.algo.route.routeInfo.entries()) {
        console.log(`\t${name}\t${len}\t\t${by}`);
      }
      break;
    default:
      throw new Error(`unknown "${what}"`);
  }
};
