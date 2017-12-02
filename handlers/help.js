module.exports = ctx => {
  const { io } = ctx;
  io.println(`
    Commands:
        help              ouput commands infomation
        exit              you know what it means
  `);
};
