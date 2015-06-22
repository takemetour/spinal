var Broker = require('../').Broker
var Spinal = require('../').Node
var _ = require('lodash')

describe('Broker', function() {
  var broker = null
  beforeEach( function(){ broker = new Broker() })
  afterEach( function(done){ broker.stop(done) })

  describe('Structure', function() {
    it('Should start broker with default port', function(done) {
      broker.start(function() {
        assert.equal(this.port, 7557)
        done()
      })
    })

    it('Should start broker with specific port', function(done) {
      broker.start(37557, function() {
        assert.equal(this.port, 37557)
        done()
      })
    })
  })

  describe('Connection', function() {

    it('After node start() Broker should knows a new node', function(done) {
      var spinal = new Spinal('spinal://127.0.0.1:7557', {
        namespace: 'foobar', heartbeat_interval: 500
      })

      spinal.provide('foo', function(data, res){
        res.send(data)
      })

      broker.start(function() {
        spinal.start(function(){
          setTimeout(function(){
            expect(_.keys(broker.router.routing)).eql(['foobar.foo'])
            spinal.stop(done)
          }, 500)
        })
      })
    })

    it('After node stop() Broker should remove a node', function(done) {
      var spinal = new Spinal('spinal://127.0.0.1:7557', {
        namespace: 'foobar', heartbeat_interval: 500
      })

      spinal.provide('foo', function(data, res){
        res.send(data)
      })

      broker.start(function() {
        spinal.start(function(){
          spinal.stop(function(){
            expect(broker.router.node).empty
            done()
          })
        })
      })
    })

  })

  describe('Nodes', function() {
    it('add multiple nodes with a single method and a single namespace', function(done) {

      var spinalA = new Spinal('spinal://127.0.0.1:7557', { namespace: 'foobar' })
      var spinalB = new Spinal('spinal://127.0.0.1:7557', { namespace: 'foobar' })

      spinalA.provide('foo', function(data, res){ res.send(data) })
      spinalB.provide('foo', function(data, res){ res.send(data) })

      broker.start(function() {
        spinalA.start(function(){
          spinalB.start(function(){
            expect(_.keys(broker.router.nodes)).have.to.length(2)
            expect(_.keys(broker.router.namespace)).have.to.length(1)
            expect(_.keys(broker.router.routing)).have.to.length(1)
            expect(broker.router.namespace).have.property('foobar')
            expect(_.keys(broker.router.routing)).eql(['foobar.foo'])

            spinalA.stop(function(){
              spinalB.stop(function(){
                broker.stop(done)
              })
            })
          })
        })
      })

    })

    it('add multiple nodes with multiple methods in a single namespace', function(done) {

      var spinalA = new Spinal('spinal://127.0.0.1:7557', { namespace: 'foobar' })
      var spinalB = new Spinal('spinal://127.0.0.1:7557', { namespace: 'foobar' })

      spinalA.provide('foo', function(data, res){ res.send(data) })
      spinalB.provide('bar', function(data, res){ res.send(data) })

      broker.start(function() {
        spinalA.start(function(){
          spinalB.start(function(){
            expect(_.keys(broker.router.nodes)).have.to.length(2)
            expect(_.keys(broker.router.namespace)).have.to.length(1)
            expect(_.keys(broker.router.routing)).have.to.length(2)
            expect(broker.router.namespace).have.property('foobar')
            expect(_.keys(broker.router.routing)).eql(['foobar.foo', 'foobar.bar'])
            spinalA.stop(function(){
              spinalB.stop(done) 
            })
          })
        })
      })

    })
    it.skip('loadbalance method between nodes', function(done) {})
  })

  // it.skip('_ping service', function(done) {
  //   var spinalA = new Spinal('spinal://127.0.0.1:7557', {
  //     namespace: 'foobar', heartbeat_interval: 500
  //   })
  //   assert.equal('pong', 'pong')
  //   done()
  // })

  // it.skip('_handshake service', function(done) {
  //   assert.equal('pong', 'pong')
  //   done()
  // })

  // it.skip('_heartbeat service', function(done) {
  //   assert.equal('pong', 'pong')
  //   done()
  // })

})
