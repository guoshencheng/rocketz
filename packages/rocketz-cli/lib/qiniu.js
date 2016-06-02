"use strict";

var fs = require("fs");
var path = require("path");
var readline = require("readline");

var qiniu = require("qiniu");
var _ = require("lodash");

var util = require("./util");
var log = require("./log");

var Qiniu = util.extendsClass(function Qiniu( settings ) {
  _.assign(this, settings);

  qiniu.conf.ACCESS_KEY = this.ACCESS_KEY;
  qiniu.conf.SECRET_KEY = this.SECRET_KEY;

  this.__token = (new qiniu.rs.PutPolicy(this.space)).token();

  this.chunk();
}, require("./cloud"));

Qiniu.prototype.uploadFile = function( file ) {
  var cloud = this;
  var localFile = path.join(cloud.local, file);
  var key = path.join(cloud.remote, file);
  var extra = new qiniu.io.PutExtra();

  cloud.uploading++;

  qiniu.io.putFile(cloud.__token, key, localFile, extra, function( err, ret ) {
    var rl;

    cloud.uploaded++;

    if ( err ) {
      if ( err.code === 614 ) {
        if ( cloud.interactive ) {
          rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          rl.question("文件已经存在，是否仍要上传？[Y/n]", function( answer ) {
            if ( answer.toLowerCase() === "y" ) {
              cloud.remove(key, function() {
                cloud.uploadFile(file);
              });
            }

            rl.close();
          });
        }
        else {
          console.log("!!! " + key + " 已经存在");
        }
      }
      else {
        cloud.failedFiles.push(file);

        console.log("上传到七牛时发生如下错误\n", err);
      }
    }
    else {
      log.uploaded(ret.key, "qiniu");
    }
  });
};

// 删除指定文件
Qiniu.prototype.remove = function( keys, force, callback ) {
  var cloud = this;
  var cl = new qiniu.rs.Client();

  if ( _.isString(keys) ) {
    keys = [keys];
  }

  if ( _.isArray(keys) ) {
    if ( _.isFunction(force) ) {
      callback = force;
    }

    keys.forEach(function( key ) {
      cl.remove(cloud.space, key, function( err, ret ) {
        if ( err ) {
          console.log(err);
        }

        if ( _.isFunction(callback) ) {
          callback.apply(cloud, [err, ret]);
        }
      });
    });
  }
};

module.exports = Qiniu;
