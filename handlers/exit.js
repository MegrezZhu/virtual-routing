module.exports = ctx => {
  const { io } = ctx;
  io.result('bye~');
  io.print('\r '); // make sure no prompt symbol in the last line
  process.exit(0);
};
