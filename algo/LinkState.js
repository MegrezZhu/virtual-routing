const Base = require('./Base');
const Router = require('../lib/Router');
const Message = require('../lib/Message');
const io = require('../lib/IOInterface');

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
    setInterval(this.broadcastLinkState.bind(this), 5000);
    this.router.on(Router.NEW_NEIGHBOR, node => {
      this.linkState.get(this.router.name).set(node.info.name, node.info.cost);
      this._calculate();
      node.on(Message.LINK_STATE, msg => {
        // 如果这个广播从来没有收到过
        if (msg.header.path.indexOf(this.router.name) === msg.header.path.length - 1) {
          const oldMap = this.linkState.get(msg.header.from);
          const newMap = new Map(msg.data);
          if (this._isLinkStateChange(oldMap, newMap)) {
            io.result('Link state change, start algorithm');
            this.linkState.set(msg.header.from, newMap);
            this._calculate();
          }
          this.router.broadcast(msg);
        }
      });
    });
    this.router.on(Router.NEIGHBOR_GONE, node => {
      this.linkState.get(this.router.name).delete(node.info.name);
      this.linkState.delete(node.info.name);
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
        prev: null
      });
    }
    for (const [name, length] of this.linkState.get(origin)) {
      if (!queue.has(name)) return io.error('Unstable links, cancel algorithm');
      this.routeTable.set(name, {
        length,
        prev: origin
      });
    }
    while (queue.size) {
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
      if (!nearest) {
        this.routeTable.clear();
        break;
      }
      for (const [name, length] of this.linkState.get(nearest)) {
        if (queue.has(name)) {
          const direct = this.routeTable.get(name).length;
          const bypass = this.routeTable.get(nearest).length + length;
          if (bypass < direct) {
            this.routeTable.set(name, {
              length: bypass,
              prev: nearest
            });
          }
        }
      }
    }
    for (let [name, {length, prev}] of this.routeTable) {
      let by = name;
      while (true) {
        if (prev === origin) break;
        const prevRule = this.routeTable.get(prev);
        if (prevRule.by) {
          by = prevRule.by;
          break;
        }
        by = prev;
        prev = prevRule.prev;
      }
      this.routeTable.set(name, {
        length,
        by
      });
    }
    io.result('Update route table');
  }
  broadcastLinkState () {
    this.router.broadcast(new Message(Message.LINK_STATE, null, Array.from(this.linkState.get(this.router.name))));
  }
  _isLinkStateChange (oldMap, newMap) {
    if (oldMap === newMap) return false;
    if (!oldMap || !newMap) return true;
    if (Array.from(oldMap.keys()).filter(x => !newMap.has(x)).length) {
      return true;
    }
    if (Array.from(newMap.keys()).filter(x => !oldMap.has(x)).length) {
      return true;
    }
    for (const [key, value] of oldMap) {
      if (newMap.get(key) !== value) return true;
    }
    return false;
  }
};

module.exports = LinkState;
