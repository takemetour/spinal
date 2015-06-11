var Spinal = require('../').Node;


describe('Node', function() {
  it('Should added namespace', function() {
    var spinal = new Spinal('spinal://127.0.0.1:7557', {
      namespace: 'bunny'
    });
    assert.equal(spinal.namespace, 'bunny');
  });


  it('Should call method', function() {
    var spinal = new Spinal('spinal://127.0.0.1:7557', {
      namespace: 'bunny'
    });

    function jump(place, height, done) {
      var msg = 'Bunny is jump ' + height + 'cm from ' + place;
      return msg;
    };
    spinal.methods('jump', jump);
    assert.isFunction(spinal._methods['bunny.jump']);
    assert.equal(spinal._methods['bunny.jump']('park',12), jump('park',12));
    assert.isDefined(spinal.bunny.jump);
  });



});
