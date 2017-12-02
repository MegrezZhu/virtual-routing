const assert = require('assert');

module.exports = (ctx, args) => {
  const [, what] = args._;
  assert(what, 'what do you want to show?');
  switch (what) {
    case 'member':
      console.log(`\t${ctx.name} @ localhost : ${ctx.port} (you)`);
      for (const member of ctx.members.values()) {
        console.log(`\t${member.name} @ ${member.address} : ${member.port}`);
      }
      break;
    case 'peer':
      for (const peer of ctx.peers.values()) {
        console.log(`\t${peer.info.name} @ ${peer.info.address} : ${peer.info.port}`);
      }
      break;
    default:
      throw new Error(`unknown "${what}"`);
  }
};
