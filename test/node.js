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

    spinal.methods('jump', function(place, height, done){
      var msg = 'Bunny is jump ' + height + 'cm from ' + place;
      done(null, msg);
    });
    assert.isDefined(spinal.bunny.jump);
  });


});
