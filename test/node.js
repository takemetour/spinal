  // it.skip('Bind specific port', function() {} )
var Spinal = require('../').Node;
var Broker = require('../').Broker;

describe('Node', function() {
  var broker = new Broker
  before(function(done){ broker.start(done) })
  after(function(done){ broker.stop(done) })

  var spinal = null
  beforeEach(function(done){
    spinal = new Spinal('spinal://127.0.0.1:7557', {
      namespace: 'bunny', heartbeat_interval: 500
    });
    done()
  })
  afterEach(function(done){
    spinal.stop(function(){done()})
  })

  describe('Structure', function() {
    it('Should throw error when init withour a broker url', function() {
      expect(function(){new Spinal()}).to.throw(/url/)
    })

    it('Should throw error when init Spinal without options.namespace', function() {
      expect(function(){new Spinal('spinal://127.0.0.1:7557')}).to.throw(/options.namespace/)
    })

    it('Should throw error when init Spinal with reserved namespace', function() {
      expect(function(){
        new Spinal('spinal://127.0.0.1:7557', {namespace: 'broker'})
      }).to.throw(/broker/)
    })

    it('Should start with namespace', function() {
      assert.equal(spinal.namespace, 'bunny')
    })

    it('Should add method', function() {
      spinal.provide('jump', function(){} )
      expect(spinal._methods.jump).to.be.a('function')
      assert.isFunction(spinal._methods.jump)
    })

    it('Should throw error when add a duplicate method name', function() {
      spinal.provide('jump', function(){} )
      expect(spinal._methods.jump).to.be.a('function')
      expect(function(){
        spinal.provide('jump', function(){} )
      }).to.throw(/already exists/)
    })

    it('Should removed method', function() {
      spinal.provide('jump', function(){} )
      assert.isFunction(spinal._methods.jump)
      expect(spinal.unprovide('jump', function(){})).to.be.true
      expect(spinal._methods.jump).to.not.a('function')
    })
  })

  describe('Connection', function() {
    it('Should auto reconnect when lost connection from a broker', function(done) {
      broker.start(37557, function(){
        var spinal = new Spinal('spinal://127.0.0.1:37557', {namespace: 'bunny', heartbeat_interval: 200})
        spinal.start(function(){
          broker.stop()
          setTimeout(function(){
            expect(spinal.stats.reconnected).to.be.above(0)
            spinal.stop(done)
          }, 400)
        })
      })
    })
    it.skip('Should able to stop() even a node cannot send `_bye` message to a broker', function(done) {})
  })

  describe('Response', function() {
    it('Correct response object structure', function(done) {
      spinal.provide('jump', function(arg, res){
        assert.isFunction(res.send)
        assert.isFunction(res.error)
        // assert.isFunction(res.cache)
        done()
      })
      spinal._methods.jump()
    })

    it('Should send data thru res.send', function(done) {
      spinal.provide('jump', function(arg, res){
        assert.isFunction(res.send)
        res.send('Bunny is jump ' + arg.height + ' cm from ' + arg.place)
      })
      spinal.start(function(){
        spinal.call('jump', {place: 'farm', height: 12}, function(err, msg) {
          assert.isNull(err)
          assert.equal(msg, 'Bunny is jump 12 cm from farm');
          done()
        })
      })
    })

    it('Should send error thru res.error (with string)', function(done) {
      spinal.provide('jump', function(arg, res){
        assert.isFunction(res.error)
        res.error('Error message')
      })
      spinal.start(function(){
        spinal.call('jump', 'ok', function(err, data) {
          assert.isNotNull(err)
          assert.equal(err.message, 'Error message');
          done()
        })
      })
    })

    it('Should send error thru res.error (with Error object)', function(done) {
      spinal.provide('jump', function(arg, res){
        assert.isFunction(res.error)
        res.error(new Error('Error message'))
      })
      spinal.start(function(){
        spinal.call('jump', 'ok', function(err, data) {
          assert.isNotNull(err)
          assert.equal(err.message, 'Error message');
          done()
        })
      })
    })

  })

  describe('Call', function() {
    it('Should get error after call not exist method (internal)', function(done) {
      spinal.start(function(){
        spinal.call('_not_found', {place: 'farm', height: 12}, function(err, msg) {
          assert.isNotNull(err)
          done()
        })
      })
    })

    it('Should call internal method via broker (without namespace)', function(done) {
      spinal.provide('jump', function(data, res) {
        res.send('Bunny is jump ' + data.height + ' cm from ' + data.place)
      })
      spinal.start(function(){
        spinal.call('jump', {place: 'farm', height: 12}, function(err, msg) {
          assert.isNull(err)
          assert.equal(msg, 'Bunny is jump 12 cm from farm');
          done()
        })
      })
    })

    it('Should call internal method via broker (with namespace)', function(done) {
      spinal.provide('jump', function(data, res) {
        res.send('Bunny is jump ' + data.height + ' cm from ' + data.place)
      })
      spinal.start(function(){
        spinal.call('bunny.jump', {place: 'farm', height: 12}, function(err, msg) {
          assert.isNull(err)
          assert.equal(msg, 'Bunny is jump 12 cm from farm');
          done()
        })
      })
    })

    it('Should call method between two node', function(done) {
      this.timeout(1500);
      var dogSpinal = new Spinal('spinal://127.0.0.1:7557', {
        namespace: 'dog', heartbeat_interval: 500
      })

      dogSpinal.provide('howl', function(name, res) {
        res.send(name + ' is howl')
      })

      var catSpinal = new Spinal('spinal://127.0.0.1:7557', {
        namespace: 'cat', heartbeat_interval: 500
      })

      catSpinal.provide('meaw', function(name, res) {
        res.send(name + ' is meaw')
      })
      dogSpinal.start(function() {
        catSpinal.start(function() {
          catSpinal.call('dog.howl', 'John', function(err, msg) {
            assert.isNull(err)
            assert.equal(msg, 'John is howl')
            dogSpinal.call('cat.meaw', 'Jane', function(err, msg) {
            assert.isNull(err);
            assert.equal(msg, 'Jane is meaw')
              dogSpinal.stop()
              catSpinal.stop()
              done()
            })
          })
        });
      });
    });
  });

  // it.skip('Should get error after call not exitst method (external)', function() {} )
  // it.skip('Should auto reconnect and resume a call after connection lost', function() {} )


});
