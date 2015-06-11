var Spinal = require('../').Node;
var broker = require('../').Broker();

describe('Node', function() {
  var socket;
  before(function(done) {
    broker.start(function(_socket){
      socket = _socket;
      done()
    });
  });

  after(function(done) {
    socket.close(done);
  });

  it('Should added namespace', function() {
    var spinal = new Spinal('spinal://127.0.0.1:7557', {
      namespace: 'bunny', heartbeat_interval: 500
    });
    assert.equal(spinal.namespace, 'bunny');
  });


  it('Should call method', function(done) {

    var spinal = new Spinal('spinal://127.0.0.1:7557', {
      namespace: 'bunny', heartbeat_interval: 500
    });

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
    this.timeout(10000);
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

          }, 1200);

        })
      });
    });
  });


});
