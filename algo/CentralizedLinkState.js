const inq = require('inquirer');
const Base = require('./Base');
const Router = require('../lib/Router');
const Message = require('../lib/Message');
const Server = require('../lib/Server');
const Node = require('../lib/Node');
const io = require('../lib/IOInterface');

const MASTER_NAME = 'MASTER';

class CentralizedLinkState extends Base {
  constructor () {
    super();

    this.name = 'CentralizedLinkState';
  }
  async init (router) {
    this.router = router;
    // for master
    this.linkState = new Map(); // Map: name to Map (name to cost)
    this.nodes = new Set();
    // for others
    this.routeTable = new Map(); // name to {length, by}

    const { isMaster } = await inq.prompt([{
      type: 'confirm',
      name: 'isMaster',
      message: 'Using this router as a central route?',
      default: false
    }]);
    this.isMaster = isMaster;
    this.master = null;

    if (!isMaster) {
      const { host, port } = await inq.prompt([
        {
          name: 'host',
          message: 'master\'s host',
          default: 'localhost'
        },
        {
          name: 'port',
          message: 'master\'s port',
          validate: port => {
            let num = Number(port);
            if (isNaN(num)) return `port must be a number`;
            if (num >= 1 && num <= 65535) return true;
            else return `port must be a number between 1-65535`;
          }
        }
      ]);
      const master = this.master = new Node();
      await new Promise(resolve => master.connect({ port, host }, resolve));
      master.on('close', () => io.error('Master done'));
      master.on('error', () => {});
      master.send(new Message(Message.SELF_INTRODUCTION, MASTER_NAME, {
        name: this.router.name
      }));
      this.router.on(Router.NEW_NEIGHBOR, this._sendLinkStateToMaster.bind(this));
      this.router.on(Router.NEIGHBOR_GONE, this._sendLinkStateToMaster.bind(this));
      this.master.on(Message.ROUTE_UPDATE, msg => {
        console.log('Route table update');
        this.routeTable = new Map(msg.data);
        console.log(this.routeTable);
        this.router.nodes = new Set(this.routeTable.keys());
      });
    } else {
      this.router.name = MASTER_NAME;
      io.result(`Your name is now ${MASTER_NAME}`);
      const server = this.server = this.router.server;
      server.removeAllListeners(Server.NEW_CONNECTION);
      server.on(Server.NEW_CONNECTION, async node => {
        node.on('close', () => {
          this.nodes.delete(node);
          io.result(`Node leave: ${node.name}`);
          this.linkState.delete(node.name);
          this._deleteUnRefNode();
        });
        node.on('error', () => {});
        await new Promise((resolve, reject) => {
          node.on(Message.SELF_INTRODUCTION, msg => {
            node.name = msg.data.name;
            resolve();
          });
        });
        this.nodes.add(node);
        io.result(`New node ${node.name}`);
        node.on(Message.LINK_STATE, msg => {
          console.log('LS from ', node.name);
          console.log(new Map(msg.data));
          this.linkState.set(node.name, new Map(msg.data));
          console.log(this.linkState);
          this._broadcastLinkState();
        });
      });
    }
  }
  getRoute () {
    return this.routeTable;
  }
  _sendLinkStateToMaster () {
    const ls = Array.from(this.router.neighbors).map(([name, node]) => [name, node.info.cost]);
    this.master.send(new Message(Message.LINK_STATE, MASTER_NAME, ls));
  }
  _broadcastLinkState () {
    // this._deleteUnRefNode();
    for (const node of this.nodes) {
      console.log(node.name);
      const routeTable = new Map();
      // 计算nodes
      const nodes = new Set(this.linkState.keys());
      nodes.delete(node.name);

      // 计算路由信息
      const queue = new Set(nodes);
      routeTable.clear();
      let origin = node.name;
      for (const name of queue) {
        routeTable.set(name, {
          length: Infinity,
          by: null
        });
      }
      for (const [name, length] of this.linkState.get(origin)) {
        if (!queue.has(name)) return console.log('链路状态不稳定'); // 链路状态不稳定
        routeTable.set(name, {
          length,
          by: name
        });
      }
      while (queue.size) {
        // 找出最近的一个节点
        let nearest = null;
        let nearestCost = Infinity;
        for (const name of queue) {
          const length = routeTable.get(name).length;
          if (length < nearestCost) {
            nearestCost = length;
            nearest = name;
          }
        }
        queue.delete(nearest);
        for (const [name, length] of this.linkState.get(nearest)) {
          if (queue.has(name)) {
            const direct = routeTable.get(name).length;
            const bypass = routeTable.get(nearest).length + length;
            routeTable.set(name, {
              length: Math.min(direct, bypass),
              by: bypass < direct ? nearest : name
            });
          }
        }
      }
      console.log(routeTable);
      node.send(new Message(Message.ROUTE_UPDATE, node.info.name, Array.from(routeTable)));
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
}

module.exports = CentralizedLinkState;
