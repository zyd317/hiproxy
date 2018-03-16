/**
 * @file HTTP server REQUEST handler
 * @author zdying
 */
'use strict';

var proxyFlow = require('../../proxy');
var utils = require('../../../helpers/utils');

module.exports = function (req, res) {
  var hiproxy = this;
  var ctx = {
    req: req,
    res: res,
    proxy: null
  };

  req.requestId = utils.randomId();
  req._startTime = Date.now();
  req.res = res;

  /* Emitted each time there is a request.
   * @event ProxyServer#request
   * @property {http.IncomingMessage} request request object
   * @property {http.ServerResponse} response response object
   */
  this.emit('request', req, res);

  // 缓存res原始的write和end方法
  var oldWrite = res.write;
  var oldEnd = res.end;
  // 数据是否为string
  var isString = false;
  // 缓存数据
  var body = [];
  var collectChunk = function (chunk) {
    if (!chunk) {
      return;
    }

    if (typeof chunk === 'string') {
      isString = true;
    }

    body.push(chunk);
  };

  res.write = function (chunk, encoding) {
    collectChunk(chunk);
    /**
     * Emitted whenever the response stream received some chunk of data.
     * @event ProxyServer#data
     * @property {Object} detail event detail data
     * @property {Buffer|String} detail.data response data
     * @property {http.IncomingMessage} detail.req request object
     * @property {http.ServerResponse} detail.res response object
     * @property {Object|Null} detail.proxy proxy info
     * @property {String|Undefined} detail.encoding data encoding
     */
    hiproxy.emit('data', {
      data: chunk,
      req: req,
      res: res,
      proxy: ctx.proxy,
      encoding: encoding
    });
  };

  res.end = function (chunk, encoding) {
    collectChunk(chunk);
    body = isString ? body.join('') : Buffer.concat(body);

    /**
     * Emitted when a response is end. This event is emitted only once.
     * @event ProxyServer#response
     * @property {Object} detail event detail data
     * @property {Buffer|String} detail.data response data
     * @property {http.IncomingMessage} detail.req request object
     * @property {http.ServerResponse} detail.res response object
     * @property {Object|Null} detail.proxy proxy info
     * @property {String|Undefined} detail.encoding data encoding
     */
    hiproxy.emit('response', {
      data: body,
      req: req,
      res: res,
      proxy: ctx.proxy,
      encoding: encoding
    });

    // oldEnd会再次调用write，所以这里要还原write方法
    res.write = oldWrite;
    // 最后一次性推送数据到浏览器
    oldEnd.call(res, body);
  };

  proxyFlow.run(ctx, null, this);
};
