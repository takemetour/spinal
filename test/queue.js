var Spinal = require('../').Node
var Broker = require('../').Broker
var redis = new (require('ioredis'))(6379)
var kue = require('kue')
var request = require('supertest')

describe('Queue', function() {
  var broker = null
  var spinal = null
  beforeEach(function(done){
    redis.keys('q:*', function(err, keys){
      if (keys.length > 0)
        redis.del(keys, done)
      else done()
    })
  })
  beforeEach(function(done){
    broker = new Broker({redis: 6379, restapi: 7577})
    broker.start(done)
  })
  beforeEach(function(done){
    spinal = new Spinal('spinal://127.0.0.1:7557', { namespace: 'q-test-client' })
    done()
  })
  afterEach(function(done){ spinal.stop(done) })
  afterEach(function(done){ broker.stop(done) })


  describe.only('Structure', function() {
    it('kue start correctly', function(done){
      broker.queue.q.client.once('connect', function(){
        expect(broker.queue).to.be.an.object
        expect(broker.queue.q.client.connected).to.be.true
        done()
      })
    })
  })

  describe('Worker', function(){
    it('.worker() should create correct env from both node and broker', function(done){
      spinal.worker('workerA', function(arg, res) {
        res.send(true)
      })
      spinal.start(function(){
        expect(spinal._methods['workerA:worker']).to.be.a.function
        var routing = broker.router.routing['q-test-client.workerA:worker']
        expect(routing).to.be.an.object
        expect(routing[0]).to.be.equal(spinal.id)
        done()
      })
    })

    it('worker callback should has correct response struture', function(done){
      spinal.worker('workerB', function(arg, res) {
        expect(res.send).to.be.a.function
        expect(res.error).to.be.a.function
        expect(res.log).to.be.a.function
        done()
      })
      expect(spinal._methods['workerB:worker']).to.be.a.function
      spinal._methods['workerB:worker'](1)
    })
  })

  describe('Job', function(){
    it('Call job().save() should success and return jobID', function(done){
      spinal.start(function(){
        spinal.job('test', {data: 1}).save(function(err, job_id){
          broker.queue.q.inactive(function(err, ids){
            expect(parseInt(ids[0])).to.be.equal(job_id)
            done()
          })
        })
      })
    })

    it('Call job().save() should create a correct job data', function(done){
      spinal.start(function(){
        spinal.job('test', {data: 1}).save(function(err, job_id){
          kue.Job.get(job_id, function(err, job){
            expect(job.type).to.be.equal('q-test-client.test')
            expect(job.data).to.be.deep.equal({data: 1})
            done()
          })
        })
      })
    })

    it('Should support chaining job().priority().attempts()', function(done){
      spinal.start(function(){
        spinal.job('test', {data: 1})
        .priority('high').attempts(3).ttl(700).delay(800).backoff(true)
        .save(function(err, job_id){
          kue.Job.get(job_id, function(err, job){
            expect(parseInt(job._priority)).to.be.equal(-10)
            expect(parseInt(job._max_attempts)).to.be.equal(3)
            expect(parseInt(job._ttl)).to.be.equal(700)
            expect(parseInt(job._delay)).to.be.equal(800)
            expect(job._backoff).to.be.true
            done()
          })
        })
      })
    })

    it('After multiple call job() should wait up in a queue', function(done){
      spinal.start(function(){
        spinal.job('test', {data: 2}).save(function(){
          spinal.job('test', {data: 3}).save(function(){
            spinal.job('test', {data: 4}).save(function(){
              broker.queue.q.inactive(function(err, ids){
                expect(ids).to.have.length(3)
                done()
              })
            })
          })
        })
      })
    })

    it('Should resume a job when worker online', function(done){
      var worker = new Spinal('spinal://127.0.0.1:7557', { namespace: 'q-test-B' })
      spinal.start(function(){
        spinal.job('q-test-B.testB', {data: 1}).save(function(err){
          expect(err).to.be.null
          worker.worker('testB', function(data, res){
            res.log('test logging')
            res.send('ok')
            done()
          })
          worker.start()
        })
      })
    })

    it('Process multiple jobs from different workers', function(done){
      var workerA = new Spinal('spinal://127.0.0.1:7557', { namespace: 'q-test-C' })
      var workerB = new Spinal('spinal://127.0.0.1:7557', { namespace: 'q-test-C' })
      workerA.worker('test', function(data, res){ res.send(1) })
      workerB.worker('test', function(data, res){
        workerA.stop(function(){
          workerB.stop(done)
        })
      })
      workerA.start(function(){
        workerB.start(function(){
          spinal.start(function(){
            spinal.job('q-test-C.test', {no: 1}).save()
            spinal.job('q-test-C.test', {no: 2}).save()
          })
        })
      })
    })
  })


  describe.skip('RestAPI', function() {
    it('/queue/worker', function(done){
      spinal.worker('test', function(data, res){ res.send(1) })
      spinal.start(function(){
        request(broker.restapi.app)
          .get('/queue/worker')
          .expect(200, function(err, res){
            expect(res.body).to.deep.equal({'q-test-client.test': 1})
            expect(err).to.be.null
            done()
          })
      })
    })

    it('/queue/stats', function(done){
      spinal.worker('test', function(data, res){ res.send(1) })
      spinal.start(function(){
        spinal.job('test', {test: true}).save()
        request(broker.restapi.app)
          .get('/queue/stats')
          .expect(200, function(err, res){
            expect(err).to.be.null
            expect(res.body.inactiveCount).to.equal(1)
            done()
          })
      })
    })

  })
})
