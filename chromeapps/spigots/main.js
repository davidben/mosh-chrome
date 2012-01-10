// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for the main.html page.
 */

/**
 * Namespace for all other functions in main.js.
 */
var main = {
  /**
   * Current content of onc.  We expect this to be validated when it
   * is updated and to thus always be valid.  This means at load time
   * and at "save changes" time in the modal dialogs, it will be
   * validated.  And it also means that at save time the value can be
   * written directly out without any further validation.
   */
  'externalEntitySet': {
  },
  'oncCurrent': {
    'Type': 'UnencryptedConfiguration',
    'NetworkConfigurations': [],
    'Certificates': []
  }
};

/**
 * Dictionary from identifier to dialog objects.
 */
main.dialogs = {
  'cert': certDialog,
  'load': loadDialog,
  'download': downloadDialog,
  'save-request': saveRequestDialog,
  'vpn':  vpnDialog,
  'wifi': wiFiDialog,
  'remove': removeDialog,
};

/**
 * Disables an input object (fades it out and disables it).
 * @param {Object} input  The input object to disable.
 */
main.disableInput = function(input) {
  input[0].disabled = true;
  input.fadeTo('fast', 0.50);
};

/**
 * Enables an input object (fades it in and enables it).
 * @param {Object} input  The input object to enable.
 */
main.enableInput = function(input) {
  input[0].disabled = false;
  input.fadeTo('fast', 1.00);
};

/**
 * Create GUID.
 * @returns {String}  Returns a GUID string of format
 *                   {XXXXXXXX-XXXX-XXXX-XXXXXXXXXXXXXXXX}.
 */
main.createGuid = function() {
  var guidData = new Uint8Array(16);
  crypto.getRandomValues(guidData);
  var intervals = [ 4, 2, 2, 8 ];
  var guid = '{';
  var offset = 0;
  for (var i = 0; i < intervals.length; ++i) {
    if (i > 0)
      guid += '-';
    for (var j = 0; j < intervals[i]; ++j) {
      var hex = guidData[offset].toString(16);
      if (hex.length == 1)
        guid += '0';
      guid += hex;
      ++offset;
    }
  }
  guid += '}';
  return guid;
};

/**
 * Convert a data string into hex representation.
 * @param {String} str  Data string
 * @returns {String}  Hex representation of data string.
 */
main.toHex = function(str) {
  var result = '';
  for (var i = 0; i < str.length; i++) {
    var byte = str.charCodeAt(i).toString(16);
    if (byte.length == 1)
      byte = '0' + byte;
    result += byte;
  }
  return result;
};

/**
 * Validate the given string is a valid hex number.
 * @param {String} str  Hex string.
 * @returns {Boolean}  Indicates if a valid hex string
 */
main.isAllHex = function(str) {
  var allHex = true;
  var validHexChars = ['a', 'b', 'c', 'd', 'e', 'f',
                       '0', '1', '2', '3', '4', '5',
                       '6', '7', '8', '9'];
  var lowercaseString = str.toLowerCase();
  for (var i = 0; i < str.length; i++) {
    if (validHexChars.indexOf(lowercaseString[i]) == -1) {
      allHex = false;
      break;
    }
  }
  return allHex;
};

/**
 * Convert an array of numbers to the equivalent Uint8Array.
 * @param {Array.<Number>} array  Array of numbers to convert.
 * @returns {Uint8Array}  Equivalent Uint8Array.
 */
main.arrayToUint8Array = function(array) {
  var uint8array = new Uint8Array(array.length);
  for (var i = 0; i < array.length; ++i) {
    uint8array[i] = array[i];
  }
  return uint8array;
};

/**
 * Takes an X509 PEM-formatted certificate and interprets its contents.
 * @param {String} x509  base64 X509 certificate
 * @returns {Object}  Result of asn1.interpretCert on certificate.
 */
main.interpretCertFromX509Pem = function(x509Pem) {
  var der = Base64.unarmor(x509Pem);
  var asn1Data = asn1.parseAsn1(der);
  return asn1.interpretCert(asn1Data);
};

$(document).ready(function() {
  ui.translateText();
  $('div.selectable').click(function() {
    var id = $(this)[0].id;
    var lastDash = id.lastIndexOf('-');
    if (lastDash != -1) {
      ui.openDialog(id.slice(0, lastDash));
    }
  });
  // Allow clicking anywhere on the text next to a checkbox to toggle
  // the checkbox.
  $('.checkable').mousedown(function(event) {
    if (event.target.type != 'checkbox')
      $(':checkbox', this).trigger('click');
  });
});
