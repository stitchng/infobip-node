'use strict'

const querystring = require('querystring')
const _ = require('lodash')
const got = require('got')

const getHttpBasicAuthString = (username, passcode) => {
  let buffer = Buffer.from(username + ':' + passcode)
  let encoded = buffer.toString('base64')
  return ('Basic ' + encoded)
}

const getHttpCustomAuthString = (apikey) => {
  return ('App ' + apikey)
}

/*!
 *
 * Provides a convenience extension to _.isEmpty which allows for
 * determining an object as being empty based on either the default
 * implementation or by evaluating each property to undefined, in
 * which case the object is considered empty.
 */
_.mixin(function () {
  // reference the original implementation
  var _isEmpty = _.isEmpty
  return {
    // If defined is true, and value is an object, object is considered
    // to be empty if all properties are undefined, otherwise the default
    // implementation is invoked.
    isEmpty: function (value, defined) {
      if (defined && _.isObject(value)) {
        return !_.some(value, function (value, key) {
          return value !== undefined
        })
      }
      return _isEmpty(value)
    }
  }
}())

const isTypeOf = (_value, type) => {
  let value = Object(_value)
  return (value instanceof type)
}

const setPathName = (config = { path: '' }, params = {}, values = {}) => {
  if (!config.route_params) {
    return config.path
  }

  return config.path.replace(/\{:([\w]+)\}/g, function (
    match,
    string,
    offset) {
    let _value = null

    if (config.path.indexOf('/sms/1/text/') + 1) {
      _value = Array.isArray(params.to) ? values['m_' + string] : values['s_' + string]
    }

    if (config.path.indexOf('/numbers/1/numbers/') + 1) {
      _value = params[string]
    }

    return isTypeOf(
      _value,
      config.route_params[string]
    )
      ? _value
      : null
  })
}

const _jsonify = (data) => {
  return !data ? 'null'
    : (typeof data === 'object'
      ? (data instanceof Date ? data.toISOString().replace(/Z$/, '') : (('toJSON' in data) ? data.toJSON().replace(/Z$/, '') : JSON.stringify(data)))
      : String(data))
}

const setInputValues = (config, inputs) => {
  let httpReqOptions = {}
  let inputValues = {}
  let label = ''

  switch (config.method) {
    case 'GET':
    case 'HEAD':
      label = 'query'
      break

    case 'POST':
    case 'PUT':
    case 'PATCH':
      label = 'body'
      break
  }

  httpReqOptions[label] = {}

  if (config.param_defaults) {
    inputs = Object.assign({}, config.param_defaults, inputs)
  }

  for (var input in config.params) {
    if (config.params.hasOwnProperty(input)) {
      let param = input.replace('$', '')
      let _input = inputs[param]
      let _type = config.params[input]
      let _required = false

      if ((input.indexOf('$') + 1) === (input.length)) {
        _required = true
      }

      if (_input === void 0 || _input === '' || _input === null) {
        if (_required) { throw new Error(`param: "${param}" is required but not provided; please provide as needed`) }
      } else {
        httpReqOptions[label][param] = isTypeOf(_input, _type)
          ? (label === 'query'
            ? querystring.escape(_jsonify(_input))
            : _jsonify(_input))
          : null

        if (httpReqOptions[label][param] === null) {
          throw new Error(`param: "${param}" is not of type ${_type.name}; please provided as needed`)
        }
      }
    }
  }

  inputValues[label] = (label === 'body'
    ? (config.send_form
      ? httpReqOptions[label]
      : JSON.stringify(httpReqOptions[label])
    )
    : querystring.stringify(httpReqOptions[label]))

  return inputValues
}

class InfoBip {
  constructor (apiKey, isProduction = false, config = {}) {
    this.api_base = {
      sandbox: 'https://api.infobip.com',
      live: 'https://api.infobip.com'
    }

    this.baseUrl = isProduction ? this.api_base.live : this.api_base.sandbox

    this.httpConfig = {
      headers: {
        'Cache-Control': 'no-cache',
        'Accept': 'application/json'
      },
      json: true
    }

    this.httpConfig.headers['Authorization'] = (config.authType === 'basic'
      ? getHttpBasicAuthString(config.username, config.password)
      : getHttpCustomAuthString(apiKey))
  }

  numbers (params = {}) {
    let config = {
      send_json: false,
      method: 'GET',
      path: '/numbers/1/numbers/available',
      route_params: null,
      params: { limit: Number, page$: Number, number$: String, capabilities$: String, country$: String },
      param_defaults: { country: 'NG', capabilities: 'SMS,VOICE', page: 0 }
    }

    if (config.route_params !== null ||
      config.params !== null) {
      if (_.isEmpty(params)) {
        throw new Error('infobip api: route/input parameter(s) required')
      }
    }

    let data = setInputValues(config, params)
    let pathname = setPathName(config, params)

    this.httpConfig.query = data.query

    let reqVerb = config.method.toLowerCase()

    return got[reqVerb](
      `${this.baseUrl}${pathname}`,
      this.httpConfig
    )
  }

  getNumber (params = {}) {
    let config = {
      send_json: false,
      method: 'GET',
      path: '/numbers/1/numbers/{:numberKey}',
      route_params: { numberKey: String },
      params: null
    }

    if (config.route_params !== null ||
      config.params !== null) {
      if (_.isEmpty(params)) {
        throw new Error('infobip api: route/input parameter(s) required')
      }
    }

    let data = setInputValues(config, params)
    let pathname = setPathName(config, params)

    this.httpConfig.query = data.query

    let reqVerb = config.method.toLowerCase()

    return got[reqVerb](
      `${this.baseUrl}${pathname}`,
      this.httpConfig
    )
  }

  purchaseNumber (params = {}) {
    let config = {
      send_json: true,
      method: 'POST',
      path: '/numbers/1/numbers',
      route_params: null,
      params: { numberKey$: String }
    }

    if (config.route_params !== null ||
      config.params !== null) {
      if (_.isEmpty(params)) {
        throw new Error('infobip api: route/input parameter(s) required')
      }
    }

    let data = setInputValues(config, params)
    let pathname = setPathName(config, params)

    if (config.send_json) {
      this.httpConfig.headers['Content-Type'] = this.httpConfig.headers['Accept']
    } else if (config.send_form) {
      this.httpConfig.headers['Content-Type'] = 'x-www-form-urlencoded'
    }

    this.httpConfig.body = data.body

    let reqVerb = config.method.toLowerCase()

    return got[reqVerb](
      `${this.baseUrl}${pathname}`,
      this.httpConfig
    )
  }

  send (params = {}) {
    let config = {
      send_json: true,
      method: 'POST',
      path: '/sms/1/text/{:type}',
      route_params: { type: String },
      params: { to$: String, text$: String }
    }

    if (config.route_params !== null ||
      config.params !== null) {
      if (_.isEmpty(params)) {
        throw new Error('infobip api: route/input parameter(s) required')
      }
    }

    let data = setInputValues(config, params)
    let pathname = setPathName(config, params, { m_type: 'multi', s_type: 'single' })

    if (config.send_json) {
      this.httpConfig.headers['Content-Type'] = this.httpConfig.headers['Accept']
    } else if (config.send_form) {
      this.httpConfig.headers['Content-Type'] = 'x-www-form-urlencoded'
    }

    this.httpConfig.body = data.body

    let reqVerb = config.method.toLowerCase()

    return got[reqVerb](
      `${this.baseUrl}${pathname}`,
      this.httpConfig
    )
  }
}

module.exports = InfoBip
