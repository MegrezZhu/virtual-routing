const context = {
  // io: null,
  // router: null,
  name: null,
  // config,
  // port: null, // currently listening port
  peers: new Map(), // name to Peer
  members: new Map() // name to all members' info (name, ip, port...)
};

module.exports = context;
