const Base = require('./Base');
const Router = require('../lib/Router');
const Node = require('../lib/Node');
const Server = require('../lib/Server');
const Message = require('../lib/Message');

class LinkState extends Base {
  constructor () {
    super();

    this.name = 'LinkState';
  }
  init (router) {
    this.router = router; // router instance
    this.neighborTable = new Map(); // Map: name to Map (name to length)
    this.routeTable = new Map(); // name to {length, by}

    // init with self
    this.neighborTable.set(this.router.name, new Map(Array.from(this.router.neighbors.entries()).map(([name, node]) => [name, node.info.cost])));

    this._attachHooks();
  }
  _attachHooks () {
    this.router.on(Router.NEW_NEIGHBOR, node => {
      // log
      console.log(`NEW_NEIGHBOR`);
      // log
      this.neighborTable.get(this.router.name).set(node.info.name, node.info.cost);
      this.broadcastLinkState();
      this._calculate();
      node.on(Message.LINK_STATE, msg => {
        // log
        console.log(`New LS from ${msg.header.from}:`);
        console.log(msg.data);
        // log
        const newMap = new Map(msg.data.linkState);
        const oldMap = this.neighborTable.get(msg.data.name);
        if (this._isChange(newMap, oldMap)) {
          // log
          console.log(`LinkState Change`);
          this.neighborTable.set(msg.data.name, newMap);
          // log
          this.broadcastLinkState(msg);
          this._deleteUnRefNode();
          this._calculate();
          // log
          console.log(this.neighborTable);
          // log
        }
      });
    });
    this.router.on(Router.NEIGHBOR_GONE, node => {
      // log
      console.log(`NEIGHBOR_GONE`);
      // log
      this.neighborTable.get(this.router.name).delete(node.info.name);
      this.neighborTable.delete(node.info.name);
      this.broadcastLinkState();
      this._deleteUnRefNode();
      this._calculate();
    });
  }
  _calculate () {
    console.log('计算开始');
    console.log(this.router.nodes);

    // 计算nodes
    this.router.nodes = new Set(this.neighborTable.keys());
    console.log('计算结束');
    console.log(this.router.nodes);
  }
  _deleteUnRefNode () {
    console.log('删除开始');
    console.log(this.neighborTable);
    // 所有记录过的节点
    const keys = [...this.neighborTable.keys()];
    // 所有被引用（有邻居）的节点
    const hasRef = [];
    for (const val of this.neighborTable.values()) {
      hasRef.push(...val.keys());
    }
    // 如果有节点在记录中，但是已经没有邻居，则判断这个节点消失了
    const leaveNodes = new Set(keys.filter(x => !hasRef.includes(x)));
    leaveNodes.delete(this.router.name);
    leaveNodes.forEach(node => this.neighborTable.delete(node));
    console.log('删除结束');
    console.log(this.neighborTable);
  }
  _isChange (newMap, oldMap) {
    if (newMap === oldMap) return false;
    if (!newMap || !oldMap) return true;
    const newMapKeys = Array.from(newMap.keys());
    const oldMapKeys = Array.from(oldMap.keys());
    const added = newMapKeys.filter(x => !oldMapKeys.includes(x));
    if (added.length) return true;
    const deleted = oldMapKeys.filter(x => !newMapKeys.includes(x));
    if (deleted.length) return true;
    for (const [key, value] of newMap) {
      if (oldMap.get(key) !== value) {
        return true;
      }
    }
    return false;
  }
  broadcastLinkState (msg) {
    // log
    console.log(`Broadcast LS:`);
    console.log(msg ? msg.data : {
      name: this.router.name,
      linkState: Array.from(this.neighborTable.get(this.router.name).entries())
    });
    // log
    this.router.broadcast(msg || new Message(Message.LINK_STATE, null, {
      name: this.router.name,
      linkState: Array.from(this.neighborTable.get(this.router.name).entries())
    }));
  }
};

module.exports = LinkState;
