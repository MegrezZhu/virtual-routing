const io = require('../lib/IOInterface');

module.exports = () => {
  io.result('bye~');
  process.exit(0);
};
