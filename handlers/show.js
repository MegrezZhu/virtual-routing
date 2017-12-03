const assert = require('assert');
const router = require('../lib/Router');

module.exports = args => {
  const [, what] = args._;
  assert(what, 'what do you want to show?');
  switch (what) {
    case 'member':
      console.log(`\t${router.name} @ localhost : ${router.port} (you)`);
      for (const member of router.members.values()) {
        console.log(`\t${member.name} @ ${member.address} : ${member.port}`);
      }
      break;
    case 'peer':
      for (const peer of router.peers.values()) {
        console.log(`\t${peer.info.name} @ ${peer.info.address} : ${peer.info.port}`);
      }
      break;
    default:
      throw new Error(`unknown "${what}"`);
  }
};
