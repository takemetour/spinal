var fs = require('fs')
var debug = require('debug')('spinal:nock')
var qs = require('qs')

function file_id(method, data){
  var json = JSON.stringify(data)
  if (typeof data == 'function') data = null
  if (data) {
    if (json.length > 64)
      return method + '?'
        + require('crypto').createHash('md5').update(json).digest("hex")
        + '.json'
    else
      return method + '?' + qs.stringify(data) + '.json'
  } else {
    return method + '.json'
  }
}

function nock(node){
  this.node = node
  this.directory = null
  this.state = null
  this._call = null
  var that = this
  function api(dir){
    that.directory = dir

    if (!fs.existsSync(that.directory))
      throw new Error('Nock need an exists directory for save all data.')
  }

  api.rec = function(){
    if (that.state) {
      if (that.state === 'record') debug('already record')
      else if (that.state === 'nocking') throw new Error('you cannot record while nocking')
    }
    that.state = 'record'
    that._call = that.node.call
    if (!that.directory)
      throw new Error('Nock need a directory for save all fixtures.' +
                      'eg: spinal.nock(\'/path/to/fixture\')')

    debug('start recording')
    that.node.call = function nockRecCall(method, data){
      if (method.indexOf('.') == -1) method = that.node.namespace + '.' + method
      arguments = [].slice.call(arguments)
      var filename = file_id(method, data)
      var fn = arguments.pop()
      arguments.push(function nockInterceptRecord(err, result, options){
        var content = {
          err: err,
          result: result,
          options: options
        }
        var filepath = that.directory + '/' + filename
        try {
          fs.writeFileSync(filepath,
            JSON.stringify(content, null, '\t'),
            { encoding: 'utf8', flag: 'w' }
          )
          debug('recorded `' + filename + '`')
        } catch (e) {
          /* istanbul ignore next */
          (function(){
            debug('cannot recorded `' + filename + '`')
            console.error(e.message)
          })()
        }
        // call real a callback
        arguments = [].slice.call(arguments)
        fn.apply(null, arguments)
      })
      that._call.apply(that.node, arguments)
    }
    return api
  }

  api.start = function(mode){
    if (that.state) {
      if (that.state === 'nocking') debug('already nocking')
      else if (that.state === 'record') throw new Error('you cannot start nock while recording')
      return null
    }
    that.state = 'nocking'
    that._call = that.node.call
    if (typeof mode == 'undefined') mode = {}
    if (!that.directory)
      throw new Error('Nock need a directory for replay all fixtures.' +
                      'eg: spinal.nock(\'/path/to/fixture\')')
    debug('start nock requests')
    that.node.call = function nockReplayCall(method, data){
      if (method.indexOf('.') == -1) method = that.node.namespace + '.' + method
      arguments = [].slice.call(arguments)
      var filename = file_id(method, data)
      var fn = arguments.pop()
      var filepath = that.directory + '/' + filename
      if (fs.existsSync(filepath)){
        try {
          data = JSON.parse(fs.readFileSync(filepath))
          fn.apply(null, [data.err, data.result, data.options])
        } catch (e) {
          /* istanbul ignore next */
          (function(){
            debug('Cannot replay `' + filename + '`')
            fn.apply(null, [e, data.result, data.options])
          })()
        }
      } else {
        if (mode.strict === false){
          arguments.push(fn)
          that._call.apply(that.node, arguments)
        } else {
          debug('No data exists to replay `' + filename + '`')
          fn.apply(null, [new Error('No data exists to replay')])
        }
      }
    }
    return api
  }

  api.stop = function(){
    debug('stop nocking/recording')
    that.state = null
    that.node.call = that._call
    return api
  }
  return api
}
module.exports = nock
// JSON.stringify(a,null,'\t')
