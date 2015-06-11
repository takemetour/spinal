var spinal = require('../')
var broker = spinal.Broker()
var client = require('../').Node

describe('Broker', function() {

  it('Should start broker', function(done) {
    broker.start(function(socket) {
      assert.equal(socket.port, 7557)
      socket.close(done)
    })
  })

  it('Should start broker with specific port', function(done) {
    broker.start(71537, function(socket) {
      assert.equal(socket.port, 71537)
      socket.close(done)
    })
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
