let routerName = 'Unknown';

class Message {
  constructor (type, to, data) {
    this.header = {
      type,
      from: routerName,
      to,
      path: [routerName]
    };
    this.data = data;
  }
  addSelfToPath () {
    this.header.path.push(routerName);
  }
};

Message.init = name => {
  routerName = name;
};

Message.fromObject = msg => {
  let instance = new Message();
  instance.header = msg.header;
  instance.data = msg.data;
  return instance;
};

Message.SELF_INTRODUCTION = 'MESSAGE.SELF_INTRODUCTION';
Message.CONNECTION_REFUSE = 'MESSAGE.CONNECTION_REFUSE';
Message.CONNECTION_ACCEPT = 'MESSAGE.CONNECTION_ACCEPT';
Message.DISTANCE_VECTOR = 'MESSAGE.DISTANCE_VECTOR';
Message.MESSAGE = 'MESSAGE.MESSAGE';
Message.LINK_STATE = 'MESSAGE.LINK_STATE';
Message.ROUTE_UPDATE = 'MESSAGE.ROUTE_UPDATE';

module.exports = Message;
