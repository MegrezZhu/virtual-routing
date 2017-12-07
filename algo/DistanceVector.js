const { EventEmitter } = require('events');
const Base = require('./Base');

class DistanceVector extends Base {
  constructor (router) {
    super();

    this.name = 'DistanceVector';
  }

  install (router) {
    return this;
  }
}

class Vector extends EventEmitter {

}

module.exports = DistanceVector;
