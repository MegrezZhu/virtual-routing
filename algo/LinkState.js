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

  getRoute () {
    return this.routeTable;
  }

  _attachHooks () {
    this.router.on(Router.NEW_NEIGHBOR, node => {
      this.linkState.get(this.router.name).set(node.info.name, node.info.cost);
      this.broadcastLinkState();
      this._calculate();
      node.on(Message.LINK_STATE, msg => {
        // 如果这个广播从来没有收到过
        if (msg.header.path.indexOf(this.router.name) === msg.header.path.length - 1) {
          this._applyLinkState(msg.data);
          this._deleteUnRefNode();
          this.router.broadcast(msg);
          this._calculate();
        }
      });
    });
    this.router.on(Router.NEIGHBOR_GONE, node => {
      this.linkState.get(this.router.name).delete(node.info.name);
      this.linkState.delete(node.info.name);
      this._deleteUnRefNode();
      this.broadcastLinkState();
      this._calculate();
    });
  }
  _calculate () {
    // 计算nodes
    this.router.nodes = new Set(this.linkState.keys());
    this.router.nodes.delete(this.router.name);

    // 计算路由信息
    const queue = new Set(this.router.nodes);
    this.routeTable.clear();
    let origin = this.router.name;
    for (const name of queue) {
      this.routeTable.set(name, {
        length: Infinity,
        by: null
      });
    }
    for (const [name, length] of this.linkState.get(origin)) {
      if (!queue.has(name)) return; // 链路状态不稳定
      this.routeTable.set(name, {
        length,
        by: name
      });
    }
    let n = 10;
    while (queue.size && n--) {
      // 找出最近的一个节点
      let nearest = null;
      let nearestCost = Infinity;
      for (const name of queue) {
        const length = this.routeTable.get(name).length;
        if (length < nearestCost) {
          nearestCost = length;
          nearest = name;
        }
      }
      queue.delete(nearest);
      for (const [name, length] of this.linkState.get(nearest)) {
        if (queue.has(name)) {
          const direct = this.routeTable.get(name).length;
          const bypass = this.routeTable.get(nearest).length + length;
          this.routeTable.set(name, {
            length: Math.min(direct, bypass),
            by: bypass < direct ? nearest : name
          });
        }
      }
    }
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
