// Copyright (c) 2011 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview  Provide way to encode binary data to base64.
 */

/**
 * Encode given binary data to base64 format.
 * @param {Uint8Array} bytes  Binary data to encode.
 * @returns {String}  Base64 representation of binary data.
 */
Base64.encode = function(bytes) {
  var map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var result = [];
  for (var i = 0; i < bytes.length; i += 3) {
    result.push(map[(bytes[i] >> 2) & 0x3f]);
    var x1 = ((bytes[i] << 4) & 0x3f);
    if (i + 1 >= bytes.length) {
      result.push(map[x1]);
      result.push('=');
      result.push('=');
      break;
    }
    x1 |= (bytes[i + 1] >> 4) & 0x3f;
    result.push(map[x1]);
    x2 = (bytes[i + 1] << 2) & 0x3f;
    if (i + 2 >= bytes.length) {
      result.push(map[x2]);
      result.push('=');
      break;
    }
    x2 |= (bytes[i+2] >> 6) & 3;
    result.push(map[x2]);
    result.push(map[bytes[i+2] & 0x3f]);
  }
  return result.join('');
};
