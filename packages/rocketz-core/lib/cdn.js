"use strict";

const path = require("path");
const EventEmitter = require("events");

const _ = require("lodash");

const DEFAULTS = {
    uploading: 0,
    uploaded: 0,
    waiting: false
  };

class CdnEvent extends EventEmitter {}

/**
 * 上传文件
 *
 * @param files
 * @param completed
 * @private
 */
function upload( files, cloud, completed ) {
  cloud.waiting = true;

  files.forEach(function( file ) {
    cloud.uploadFile(path.isAbsolute(file) ? file.replace(`${cloud.local}/`, "") : file);
  });

  cloud.timer = setInterval(function() {
    if ( !(cloud.uploading === cloud.uploaded && cloud.uploaded === files.length) ) {
      return;
    }

    cloud.__reset();

    if ( _.isFunction(completed) ) {
      completed(cloud);
    }
  }, 200);
}

/**
 * 直接上传文件
 *
 * @param cloud
 */
function send( cloud ) {
  upload(cloud.files, cloud, retry);
}

/**
 * 分组上传的文件
 *
 * @param cloud
 */
function sendChunked( cloud ) {
  if ( cloud.chunkedFiles.length === 0 ) {
    retry(cloud);
  }
  else {
    upload(cloud.chunkedFiles.shift(), cloud, function( cloud ) {
      sendChunked(cloud);
    });
  }
}

/**
 * 重新上传失败的文件
 *
 * @param cloud
 */
function retry( cloud ) {
  let files = cloud.failedFiles;

  if ( files.length === 0 ) {
    return;
  }

  console.log("\n[WARN] 以下 " + files.length + " 个文件上传失败\n" + files.join("\n"));

  if ( cloud.retryCount > 0 ) {
    console.log("\n[INFO] 将要重新上传以上文件");

    cloud.failedFiles = [];
    cloud.retryCount--;

    upload(files, cloud, retry);
  }
}

module.exports = class CdnFactory {
  constructor( settings ) {
    _.assign(this, DEFAULTS, {
      // fragment: 1,
      // retryCount: 0,
      files: [],
      failedFiles: [],
    }, settings);

    this.__e = new CdnEvent();

    this.chunk();
  }

  /**
   * 重置状态
   *
   * @private
   */
  __reset() {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      delete this.timer;
    }

    return _.assign(this, DEFAULTS);
  }

  /**
   * 碎片化资源文件
   * 将大批量文件切割
   *
   * @returns {*}
   */
  chunk() {
    let f = this.fragment;

    if (!(_.isNumber(f) && f > 1)) {
      return false;
    }

    return this.chunkedFiles = _.chunk(this.files, f);
  }

  // /**
  //  * 上传单个文件的处理逻辑
  //  */
  // uploadFile() {}

  /**
   * 上传文件
   */
  upload() {
    if ( _.isString(this.files) ) {
      this.files = [this.files];
    }

    if ( !_.isArray(this.files) ) {
      return false;
    }

    if ( _.isArray(this.chunkedFiles) ) {
      sendChunked(this);
    }
    else {
      send(this);
    }
  }

  /**
   * 删除文件
   */
  remove() {}

  /**
   * 监听事件
   *
   * @param args
   * @returns {*}
   */
  on(...args) {
    return this.__e.on(...args);
  }

  /**
   * 监听事件（只触发一次）
   *
   * @param args
   * @returns {*|Function}
   */
  once(...args) {
    return this.__e.once(...args);
  }

  /**
   * 触发事件
   *
   * @param args
   * @returns {*}
   * @private
   */
  emit(...args) {
    return this.__e.emit(...args);
  }
}
