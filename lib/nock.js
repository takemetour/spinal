var fs = require('fs')
var debug = require('debug')('spinal:nock')
var qs = require('querystring')

module.exports = function nock(){
  var node, directory, state, _call
  function api(dir){
    directory = dir
  }

  api.attach = function(_node){
    node = _node
  }

  api.rec = function(){
    if (state) {
      if (state === 'record') debug('already record')
      else if (state === 'nocking') throw new Error('you cannot record while nocking')
      return null
    }
    state = 'record'
    _call = node.call
    if (typeof directory === 'undefined')
      throw new Error('Nock need a directory for saving any fixtures.' +
                      'eg: nock.direct(\'/path/to/fixture\')')

    debug('start recording')
    node.call = function nockRecCall(method, data){
      if (method.indexOf('.') == -1) method = node.namespace + '.' + method
      arguments = [].slice.call(arguments)
      var filename = method + '?' + qs.stringify(data)
      var fn = arguments.pop()
      arguments.push(function nockInterceptRecord(err, result, options){
        var content = {
          err: err,
          result: result,
          options: options
        }
        var filepath = directory + '/' + filename + '.json'
        try {
          fs.writeFileSync(filepath,
            JSON.stringify(content, null, '\t'),
            { encoding: 'utf8', flag: 'w' }
          )
          debug('recorded `' + filename + '`')
        } catch (e) {
          debug('cannot recorded `' + filename + '`')
          console.error(e.message)
        }
        // call real a callback
        arguments = [].slice.call(arguments)
        fn.apply(null, arguments)
      })
      _call.apply(node, arguments)
    }
  }

  api.start = function(mode){
    if (state) {
      if (state === 'nocking') debug('already nocking')
      else if (state === 'record') throw new Error('you cannot start nock while recording')
      return null
    }
    state = 'nocking'
    _call = node.call
    if(typeof mode == 'undefined') mode = {}
    debug('start nock requests')
    node.call = function nockReplayCall(method, data){
      if (method.indexOf('.') == -1) method = node.namespace + '.' + method
      arguments = [].slice.call(arguments)
      var filename = method + '?' + qs.stringify(data)
      var fn = arguments.pop()
      var filepath = directory + '/' + filename + '.json'
      if (fs.existsSync(filepath)){
        try {
          data = JSON.parse(fs.readFileSync(filepath))
          fn.apply(null, [data.err, data.result, data.options])
        } catch (e) {
          debug('Cannot replay `' + filename + '`')
          fn.apply(null, [e, data.result, data.options])
        }
      } else {
        if (mode.strict === false){
          arguments.push(fn)
          _call.apply(node, arguments)
        } else {
          debug('No data exists to replay `' + filename + '`')
          fn.apply(null, [new Error('No data exists to replay')])
        }
      }
    }
  }

  api.stop = function(){
    debug('stop nocking/recording')
    state = null
    node.call = _call
  }
  return api
}

// JSON.stringify(a,null,'\t')
