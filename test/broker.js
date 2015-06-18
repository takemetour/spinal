var Broker = require('../').Broker
var Spinal = require('../').Node

describe('Broker', function() {
  var broker = new Broker()

  describe('Structure', function() {
    it('Should start broker with default port', function(done) {
      broker.start(function() {
        assert.equal(this.port, 7557)
        broker.stop(done)
      })
    })

    it('Should start broker with specific port', function(done) {
      broker.start(37557, function() {
        assert.equal(this.port, 37557)
        broker.stop(done)
      })
    })
  })

  describe('Connection', function() {
    it.skip('After node start() Broker should knows a new node', function(done) {})
    it.skip('After node stop() Broker should remove a node', function(done) {})
  })

  describe('Nodes', function() {
    it.skip('add multiple nodes with a single method and a single namespace', function(done) {})
    it.skip('add multiple nodes with multiple methods in a single namespace', function(done) {})
    it.skip('loadbalance method between nodes', function(done) {})
  })

  it.skip('_ping service', function(done) {
    assert.equal('pong', 'pong')
    done()
  })

  it.skip('_handshake service', function(done) {
    assert.equal('pong', 'pong')
    done()
  })

  it.skip('_heartbeat service', function(done) {
    assert.equal('pong', 'pong')
    done()
  })

})
