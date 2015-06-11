var spinal = require('../');
var broker = spinal.Broker();

describe('Broker', function() {
  it('Should start broker', function(done) {
    broker.start(function(socket) {
      assert.equal(socket.port, 7557);
      socket.close(done);
    });
  });
});
