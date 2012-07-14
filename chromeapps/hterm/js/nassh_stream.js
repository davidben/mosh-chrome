// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview: The NaCl plugin leans on its host to provide some basic
 * stream-like objects for /dev/random. The interface is likely to change
 * in the near future, so documentation in this file is a bit sparse.
 */

/**
 * Base class for streams required by the plugin.
 */
nassh.Stream = function(table, id, path) {
  this.table_ = table;
  this.id = id;
  this.path = path;
  this.open = false;
};

/**
 * Errors we may raise.
 */
nassh.Stream.ERR_STREAM_CLOSED = 'Stream closed';
nassh.Stream.ERR_STREAM_OPENED = 'Stream opened';
nassh.Stream.ERR_NOT_IMPLEMENTED = 'Not implemented';

/**
 * Collection of currently open stream instances.
 */
nassh.StreamTable = function() {
  this.openStreams_ = {};
  // HACK: Terminal IO is special-cased as stdout/stdin/stderr's
  // streams.
  this.nextId_ = 3;
};

/**
 * Look up a stream instance.
 */
nassh.StreamTable.prototype.getStreamById = function(id) {
  return this.openStreams_[id];
};

/**
 * Open a new stream of a given class.
 */
nassh.StreamTable.prototype.openStream = function(streamClass, arg, onOpen) {
  var id = this.nextId_++;
  var stream = new streamClass(this, id, arg);
  var self = this;

  stream.asyncOpen_(arg, function(success) {
      if (success) {
        self.openStreams_[id] = stream;
        stream.open = true;
      }

      onOpen(success ? stream.id : -1);
    });

  return stream;
};

/**
 * Clean up after a stream is closed.
 */
nassh.StreamTable.prototype.onClose_ = function(stream, reason) {
  if (stream.open)
    throw nassh.Stream.ERR_STREAM_OPENED;

  if (this.onClose)
    this.onClose(stream, reason);

  delete this.openStreams_[stream.id];
};

/**
 * Open a stream, calling back when complete.
 */
nassh.Stream.prototype.asyncOpen_ = function(path, onOpen) {
  setTimeout(function() { onOpen(false) }, 0);
};

/**
 * Read from a stream, calling back with the result.
 */
nassh.Stream.prototype.asyncRead = function(size, onRead) {
  throw nassh.Stream.ERR_NOT_IMPLEMENTED;
};

/**
 * Write to a stream.
 */
nassh.Stream.prototype.asyncWrite = function(data, onSuccess) {
  throw nassh.Stream.ERR_NOT_IMPLEMENTED;
};

/**
 * Close a stream.
 */
nassh.Stream.prototype.close = function(reason) {
  if (!this.open)
    return;

  this.open = false;

  this.table_.onClose_(this, reason || 'closed');
};

/**
 * The /dev/random stream.
 *
 * This special case stream just returns random bytes when read.
 */
nassh.Stream.Random = function(table, id) {
  nassh.Stream.apply(this, [table, id]);
};

nassh.Stream.Random.prototype = {
  __proto__: nassh.Stream.prototype
};

nassh.Stream.Random.prototype.asyncOpen_ = function(path, onOpen) {
  this.path = path;
  setTimeout(function() { onOpen(true) }, 0);
};

nassh.Stream.Random.prototype.asyncRead = function(size, onRead) {
  if (!this.open)
    throw nassh.Stream.ERR_STREAM_CLOSED;

  var bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  Array.prototype.map.apply(
      bytes, [function(el) { return String.fromCharCode(el) }]);

  var b64bytes = btoa(Array.prototype.join.apply(bytes, ['']));

  setTimeout(function() { onRead(b64bytes) }, 0);
};
