var Spinal = require('../').Node;
var broker = require('../').Broker();

describe('Node', function() {
  before(function(done) {
    broker.start(done)
  })

  after(function(done) {
    broker.stop(done)
  })

  var spinal = null
  beforeEach(function(done){
    spinal = new Spinal('spinal://127.0.0.1:7557', {
      namespace: 'bunny', heartbeat_interval: 500
    });
    done()
  })
  afterEach(function(done){
    spinal.stop(done)
  })

  it('Should added namespace', function() {
    assert.equal(spinal.namespace, 'bunny');
  });

  it('Should added mehod', function() {
    spinal.methods('jump', function(){} )
    assert.isFunction(spinal._methods.jump);
  });

  it('Should call method internal namespace', function(done) {
    function jump(place, height, cb) {
      var msg = 'Bunny is jump ' + height + ' cm from ' + place;
      cb(null, msg);
    };
    spinal.methods('jump', jump);
    assert.isFunction(spinal._methods.jump);
    assert.isFunction(spinal.bunny.jump);
    spinal.start(function(){
      spinal.bunny.jump('farm', 12, function(err, msg) {
        assert.isDefined(err);
        assert.equal(msg, 'Bunny is jump 12 cm from farm');
        done()
      })
    })
    assert.isDefined(spinal.bunny.jump);
  });

  it('Should call method between two node', function(done) {
    this.timeout(2500);
    var dogSpinal = new Spinal('spinal://127.0.0.1:7557', {
      namespace: 'dog', heartbeat_interval: 500
    });

    function howl(name, cb) {
      cb(null, name + ' is howl');
    };
    dogSpinal.methods('howl', howl);

    var catSpinal = new Spinal('spinal://127.0.0.1:7557', {
      namespace: 'cat', heartbeat_interval: 500
    });

    function meaw(name, cb) {
      cb(null, name + ' is meaw');
    };
    catSpinal.methods('meaw', meaw);
    dogSpinal.start(function() {
      catSpinal.start(function() {
        catSpinal.dog.howl('John', function(err, msg) {
          assert.isNull(err);
          assert.equal(msg, 'John is howl');
          setTimeout(function() {
            dogSpinal.cat.meaw('Jane', function(err, msg) {
            assert.isNull(err);
            assert.equal(msg, 'Jane is meaw');
              done();
            })
          }, 750);
        })
      });
    });
  });

  it.skip('Should get error after call not exitst method (internal)', function() {} )
  it.skip('Should get error after call not exitst method (external)', function() {} )
  it.skip('Bind specific port', function() {} )
  it.skip('Should auto reconnect and resume a call after connection lost', function() {} )


});
