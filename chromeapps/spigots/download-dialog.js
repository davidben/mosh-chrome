// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for the download dialog.
 */

/**
 * Namespace for download dialog.
 */
var downloadDialog = {};

/**
 * Update the download link to contain the current configuration.
 */
downloadDialog.updateDownloadLink = function() {
  if (!('Type' in main.oncCurrent)) {
    main.oncCurrent.Type = 'UnencryptedConfiguration';
  }
  var config = main.oncCurrent;
  if ($('#use-encryption', '#save-request-dialog').is(':checked')) {
    var passphrase = $('#save-passphrase', '#save-request-dialog').val();
    config = onc.encryptConfig(passphrase, config);
  }

  var base64Data = btoa(JSON.stringify(config, null, "  "));
  $('#download-link').attr(
      'href',
      'data:application/octet-stream;base64,' + base64Data);
};

/**
 * Called to initialize the download dialog.
 */
downloadDialog.init = function() {
  downloadDialog.updateDownloadLink();
  $('#cancel-button', '#download-dialog').focus();
};

/**
 * Called to hide/unhide UI fields.
 */
downloadDialog.setUiVisibility = function() {
};
