const Base = require('./Base');
const Router = require('../lib/Router');
const Message = require('../lib/Message');

class LinkState extends Base {
  constructor () {
    super();

    this.name = 'LinkState';
  }
  init (router) {
    this.router = router; // router instance
    this.linkState = new Map(); // Map: name to Map (name to length)
    this.routeTable = new Map(); // name to {length, by}

    // init with self
    this.linkState.set(this.router.name, new Map(Array.from(this.router.neighbors.entries()).map(([name, node]) => [name, node.info.cost])));

    this._attachHooks();
  }
  _attachHooks () {
    this.router.on(Router.NEW_NEIGHBOR, node => {
      // log
      console.log(`NEW_NEIGHBOR`);
      // log
      this.linkState.get(this.router.name).set(node.info.name, node.info.cost);
      this.broadcastLinkState();
      this._calculate();
      node.on(Message.LINK_STATE, msg => {
        // log
        console.log(`New LS from ${msg.header.from}:`);
        for (const one of msg.data) console.log(one);
        // log
        // 如果这个广播从来没有收到过
        if (msg.header.path.indexOf(this.router.name) === msg.header.path.length - 1) {
          // log
          console.log(`Accept LinkState`);
          this._applyLinkState(msg.data);
          // this.linkState.set(msg.header.from, new Map(msg.data));
          // log
          this._deleteUnRefNode();
          this.router.broadcast(msg);
          this._calculate();
          // log
          console.log('Link State: ', this.linkState);
          // log
        }
      });
    });
    this.router.on(Router.NEIGHBOR_GONE, node => {
      // log
      console.log(`NEIGHBOR_GONE`);
      // log
      this.linkState.get(this.router.name).delete(node.info.name);
      this.linkState.delete(node.info.name);
      this._deleteUnRefNode();
      this.broadcastLinkState();
      this._calculate();
    });
  }
  _calculate () {
    // 计算路由信息
    // 计算nodes
    this.router.nodes = new Set(this.linkState.keys());
    this.router.nodes.delete(this.router.name);
    console.log('计算结束');
    console.log('Nodes: ', this.router.nodes);
  }
  _deleteUnRefNode () {
    // 所有记录过的节点
    const keys = [...this.linkState.keys()];
    // 所有被引用（有邻居）的节点
    const hasRef = [];
    for (const val of this.linkState.values()) {
      hasRef.push(...val.keys());
    }
    // 如果有节点在记录中，但是已经没有邻居，则判断这个节点消失了
    const leaveNodes = new Set(keys.filter(x => !hasRef.includes(x)));
    leaveNodes.delete(this.router.name);
    leaveNodes.forEach(node => this.linkState.delete(node));
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
  broadcastLinkState () {
    const result = [];
    for (const [name, ls] of this.linkState) {
      result.push({
        name,
        linkState: Array.from(ls.entries())
      });
    }
    // log
    console.log(`Broadcast LS:`);
    for (const one of result) console.log(one);
    // log
    // this.router.broadcast(msg || new Message(Message.LINK_STATE, null, Array.from(this.linkState.get(this.router.name).entries())));
    this.router.broadcast(new Message(Message.LINK_STATE, null, result));
  }
  _serializeLinkState () {
    const result = [];
    for (const [name, ls] of this.linkState) {
      result.push({
        name,
        linkState: Array.from(ls.entries())
      });
    }
    return result;
  }
  _applyLinkState (ls) {
    for (const {name, linkState} of ls) {
      if (name === this.router.name) continue;
      this.linkState.set(name, new Map(linkState));
    }
  }
};

module.exports = LinkState;
