const { EventEmitter } = require('events');
const Base = require('./Base');

class DistanceVector extends Base {
  constructor (router) {
    super();

    this.name = 'DistanceVector';
  }

  install (router) {
    this.router = router;

    this.nodes = router.nodes;
    this.nodes.add(router.name);

    this.route = new Route(router.name);

    this._attachHooks();
    this._startRegularBroadcast();

    return this;
  }

  _attachHooks () {
    const router = this.router;
    const server = router.server;

    router.on(router.NEW_NEIGHBOR, node => {
      this.nodes.add(node.info.name);
      this.route.setEdge(node.info.name, node.info.cost);

      node.on(node.DISTANCE_VECTOR, vector => {
        require('../lib/IOInterface').result(`dv from ${node.info.name}: ${JSON.stringify(vector)}`); // FIXME: debug
        this.route.setVector(node.info.name, vector);
      });

      node.on(node.EDGE_LENGTH_CHANGED, len => {
        this.route.setEdge(node.info.name, len);
      });
    });

    server.on(server.LOST_CONNECTION, node => {
      this.nodes.delete(node.info.name);
      this.route.setEdge(node.info.name, Infinity);
    });

    this.route.on(Route.ROUTE_CHANGED, () => {
      require('../lib/IOInterface').result(`route changed: ${JSON.stringify(Array.from(this.route.routeInfo, ([name, info]) => ({ name, info })))}`); // FIXME: debug
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
      node.send({
        type: node.DISTANCE_VECTOR,
        content: this.route.createVectorTo(node.info.name)
      });
    }
  }
}

class Route extends EventEmitter {
  constructor (selfName) {
    super();

    this.name = selfName;

    this.vectors = new Map(); // name to {[name]: len}
    this.routeInfo = new Map(); // name to {len, by}
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
    if (vector instanceof Object) {
      // plain Object to Map, converting "null" to "Infinity"
      vector = new Map(Array.from(Object.entries(vector)).map(([name, len]) => ([name, len || Infinity])));
    }

    this.vectors.set(name, vector);
    this._calculate();
  }

  /**
   * update routeInfo, emit ROUTE_CHANGED for any change
   */
  _calculate () {
    // init with direct edges
    const result = new Map(Array.from(this.edges.entries(), ([name, len]) => [name, { len, by: name }]));

    for (const [byName, vector] of this.vectors.entries()) {
      const len1 = this.edges.get(byName) || Infinity;

      for (const [toName, len] of vector.entries()) {
        if (toName === this.name) continue;

        const to = result.get(toName);
        if (!to || len1 + len < to.len) {
          result.set(toName, {
            len: len1 + len,
            by: byName
          });
        }
      }
    }

    if (this._compare(this.routeInfo, result)) {
      this.routeInfo = result;
      this.emit(Route.ROUTE_CHANGED);
    }
  }

  /**
   * check any difference
   */
  _compare (newRoute, oldRoute) {
    // any deleted
    for (const name of oldRoute.keys()) {
      if (!newRoute.get(name)) return true;
    }

    // any new name
    for (const name of newRoute.keys()) {
      if (!oldRoute.get(name)) return true;
    }

    // any changed
    for (const [name, info] of newRoute.entries()) {
      const _info = oldRoute.get(name);
      if (_info.len !== info.len || _info.by !== info.by) return true;
    }

    return false;
  }

  _startGC () {
    // TODO:
  }

  /**
   * create a poison-reversed vector
   * @param {String} name to whom the vector be sent
   */
  createVectorTo (name) {
    const result = {};
    for (const [_name, { len, by }] of this.routeInfo.entries()) {
      result[_name] = by === name ? Infinity : len;
    }
    return result;
  }
}

Route.ROUTE_CHANGED = Route.prototype.ROUTE_CHANGED = 'ROUTE_CHANGED';

module.exports = DistanceVector;
