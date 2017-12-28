const { EventEmitter } = require('events');
const Base = require('./Base');
const Router = require('../lib/Router');
const Message = require('../lib/Message');
const Node = require('../lib/Node');
const Server = require('../lib/Server');
const io = require('../lib/IOInterface');

class DistanceVector extends Base {
  constructor (router) {
    super();

    this.name = 'DistanceVector';
  }

  init (router) {
    this.router = router;

    this.nodes = new Set();
    this.route = new Route(router.name);

    this._attachHooks();
    this._startRegularBroadcast();

    return this;
  }

  _attachHooks () {
    this.router.on(Router.NEW_NEIGHBOR, node => {
      this.nodes.add(node.info.name);
      this.route.setEdge(node.info.name, node.info.cost);

      node.on(Message.DISTANCE_VECTOR, msg => {
        io.result(`dv from ${node.info.name}: ${JSON.stringify(msg.data.vector)}`);
        this.route.setVector(node.info.name, msg.data.vector);
      });

      node.on(Node.EDGE_LENGTH_CHANGED, msg => {
        io.result(`cost of ${node.info.name} change to ${msg.data.length}`);
        this.route.setEdge(node.info.name, msg.data.length);
      });
    });

    this.router.server.on(Server.LOST_CONNECTION, node => {
      this.nodes.delete(node.info.name);
      this.route.setEdge(node.info.name, Infinity);
    });

    this.route.on(Route.ROUTE_CHANGED, () => {
      // io.result(`route changed: ${JSON.stringify(Array.from(this.route.routeInfo, ([name, info]) => ({ name, info })))}`);
      this._broadcastVector();

      // add nodes
      for (const name of this.route.routeInfo.keys()) {
        this.nodes.add(name);
      }
      this.nodes.add(this.router.name); // self name
    });
  }

  /**
   * broadcast distance vector
   */
  _startRegularBroadcast () {
    // TODO: set interval
  }

  _broadcastVector () {
    for (const node of this.router.neighbors.values()) {
      node.send(new Message(Message.DISTANCE_VECTOR, node.info.name, {
        vector: this.route.createVectorTo(node.info.name)
      }));
    }
  }
}

class Route extends EventEmitter {
  constructor (selfName) {
    super();

    this.name = selfName;

    this.vectors = new Map(); // name to [name, length]
    this.routeInfo = new Map(); // name to {length, by}
    this.edges = new Map(); // name to edge length (direct-connected)
  }

  /**
   *
   * @param {String} name
   * @param {Number} length
   */
  setEdge (name, length) {
    const oldLength = this.edges.get(name);
    if (oldLength === length) return;

    this.edges.set(name, length);
    this._calculate();
  }

  /**
   *
   * @param {String} name
   */
  deleteEdge (name) {
    this.edges.delete(name);
    this._calculate();
  }

  /**
   *
   * @param {String} name
   * @param {Map|Object} vector
   */
  setVector (name, vector) {
    if (!(vector instanceof Map)) {
      // plain Object to Map, converting "null" to "Infinity"
      vector = new Map(Array.from(Object.entries(vector)).map(([name, length]) => ([name, length || Infinity])));
    }

    this.vectors.set(name, vector);
    this._calculate();
  }

  /**
   * update routeInfo, emit ROUTE_CHANGED for any change
   */
  _calculate () {
    // init with direct edges
    let result = new Map(Array.from(this.edges.entries(), ([name, length]) => [name, { length, by: name }]));

    for (const [byName, vector] of this.vectors.entries()) {
      const length1 = this.edges.get(byName) || Infinity;

      for (const [toName, length2] of vector.entries()) {
        if (toName === this.name) continue;

        // to: {length, by}
        const to = result.get(toName);
        if (!to || length1 + length2 < to.length) {
          result.set(toName, {
            length: length1 + length2,
            by: byName
          });
        }
      }
    }

    result = new Map(Array.from(result.entries()).filter(([, {length}]) => length !== Infinity));
    if (this._compare(this.routeInfo, result)) {
      this.routeInfo = result;
      this.emit(Route.ROUTE_CHANGED);
    }
  }

  /**
   * check any difference
   */
  _compare (oldRoute, newRoute) {
    // any deleted
    let deleted = false;
    for (const name of oldRoute.keys()) {
      if (!newRoute.get(name)) {
        io.error(`${name} disconnected.`);
        deleted = true;
      }
    }
    if (deleted) return true;

    // any new name
    for (const name of newRoute.keys()) {
      if (!oldRoute.get(name)) return true;
    }

    // any changed
    for (const [name, info] of newRoute.entries()) {
      const _info = oldRoute.get(name);
      if (_info.length !== info.length || _info.by !== info.by) return true;
    }

    return false;
  }

  /**
   * create a poison-reversed vector
   * @param {String} name to whom the vector be sent
   */
  createVectorTo (name) {
    const result = {};
    for (const [_name, { length, by }] of this.routeInfo.entries()) {
      result[_name] = by === name ? Infinity : length;
    }
    return result;
  }
}

Route.ROUTE_CHANGED = 'ROUTE.ROUTE_CHANGED';

module.exports = DistanceVector;
