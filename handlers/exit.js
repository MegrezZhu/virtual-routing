module.exports = ctx => {
  const { io } = ctx;
  io.result('bye~');
  process.exit(0);
};
