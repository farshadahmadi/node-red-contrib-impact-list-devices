"use strict";

var request = require('request');

module.exports = function (RED) {

  function HTTPRequest(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    var nodeFollowRedirects = n["follow-redirects"];
    var startOffset = n["start-offset"];
    var endOffset = n["end-offset"];
    this.ret = n.ret || "txt";
    if (RED.settings.httpRequestTimeout) {
      this.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000;
    } else {
      this.reqTimeout = 120000;
    }

    this.on("input", function (msg) {
      var preRequestTimestamp = process.hrtime();
      node.status({
        fill: "blue",
        shape: "dot",
        text: "httpin.status.requesting"
      });

      var groupName = msg.groupName || n["group-name"];
      var url = msg.url || "http://api.iot.nokia.com:9090/m2m/endpoints?startOffset=" + (startOffset || 0) + "&endOffset=" + (endOffset || 0) + "&groupName=" + groupName;
      // url must start http:// or https:// so assume http:// if not set
      if (!((url.indexOf("http://") === 0) || (url.indexOf("https://") === 0))) {
        if (tlsNode) {
          url = "https://" + url;
        } else {
          url = "http://" + url;
        }
      }

      var method = "GET";
      if(msg.method){
        method = msg.method.toUpperCase(); // use the msg parameter
      }

      var opts = {
        method: method,
        url: url,
        timeout: node.reqTimeout,
        followRedirect: nodeFollowRedirects,
        headers: {
          "content-type":"application/json"
        },
        auth: {
          user: "farshadahmadighohandizi",
          pass: "Farshad@71!",
        }
      };

      if (msg.headers) {
        for (var v in msg.headers) {
          if (msg.headers.hasOwnProperty(v)) {
            var name = v.toLowerCase();
            if (name !== "content-type" && name !== "content-length") {
              // only normalise the known headers used later in this
              // function. Otherwise leave them alone.
              name = v;
            }
            opts.headers[name] = msg.headers[v];
          }
        }
      }

      request(opts, function (error, response, body) {
        node.status({});
        if (error) {
          if (error.code === 'ETIMEDOUT') {
            node.error(RED._("common.notification.errors.no-response"), msg);
            setTimeout(function () {
              node.status({
                fill: "red",
                shape: "ring",
                text: "common.notification.errors.no-response"
              });
            }, 10);
          } else {
            node.error(error, msg);
            msg.payload = error.toString() + " : " + url;
            msg.statusCode = error.code;
            node.send(msg);
            node.status({
              fill: "red",
              shape: "ring",
              text: error.code
            });
          }
        } else {
          msg.payload = body;
          msg.headers = response.headers;
          msg.statusCode = response.statusCode;
          if (node.metric()) {
            // Calculate request time
            var diff = process.hrtime(preRequestTimestamp);
            var ms = diff[0] * 1e3 + diff[1] * 1e-6;
            var metricRequestDurationMillis = ms.toFixed(3);
            node.metric("duration.millis", msg, metricRequestDurationMillis);
            if (response.connection && response.connection.bytesRead) {
              node.metric("size.bytes", msg, response.connection.bytesRead);
            }
          }
          if (node.ret === "bin") {
            msg.payload = new Buffer(msg.payload, "binary");
          } else if (node.ret === "obj") {
            try {
              msg.payload = JSON.parse(msg.payload);
            } catch (e) {
              node.warn(RED._("httpin.errors.json-error"));
            }
          }
          node.send(msg);
        }
      })
    });
  }

  RED.nodes.registerType("list-devices", HTTPRequest);
}
