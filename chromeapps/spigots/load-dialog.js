// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for the load dialog.
 */

/**
 * Namespace for load dialog.
 */
var loadDialog = {};

/**
 * Called to initialize the load dialog.
 */
loadDialog.init = function() {
  $('#load-file-form', '#load-dialog')[0].reset();
  $('#apply-errors', '#load-dialog').html('');
  $('#apply-warnings', '#load-dialog').html('');
  var applyButton = $('#apply-button', '#load-dialog');
  applyButton.click(loadDialog.onApplyPress);
  main.disableInput(applyButton);
  // Reset the file picker.
  ui.resetFilePicker('#load-file');
  loadDialog.configureLoadFilePicker();
  $('#load-file').focus();
};

loadDialog.setUiVisibility = function() {
  return;
};

/**
 * Load the given ONC configuration and show any errors in errorDom.
 * @param {String} config  ONC formatted string.
 */
loadDialog.loadConfig = function(configString) {
  var passphrase = $('#load-passphrase', '#load-dialog');
  var result = { 'errors': [], 'warnings': [], 'hasOpaqueEntity': false };
  // Check and see if the config is encrypted or not, and decrypt it
  // using the passphrase if it is.
  var config;
  try {
    config = JSON.parse(configString);
  } catch(e) {
    result.errors.push(['errorDuringLoad', e.toString()]);
  }
  if (!result.errors.length && onc.isEncrypted(config)) {
    result = onc.validateEncryptedConfiguration(config, result);
    if (!result.errors.length) {
      try {
        config = onc.decryptConfig(passphrase.val(), config);
      } catch(e) {
        result.errors.push(['errorDuringLoad', e.toString()]);
      }
    }
  }
  if (!result.errors.length && typeof(config) != 'object') {
    result.errors.push(['errorLoadUnknown']);
  }
  if (!result.errors.length) {
    result = onc.validateUnencryptedConfiguration(config, result);
  }

  // Display the errors we found (if any)
  if (result.errors.length == 0) {
    $('#apply-header', '#load-dialog').html(chrome.i18n.getMessage
                                            ('loadSucceeded'));
  } else {
    // Clear everything out if we had errors.
    $('#load-file-form')[0].reset();
  }
  ui.showMessages(result, '#load-dialog');

  loadDialog.oncToLoad = config;
  loadDialog.oncToLoadResult  = result;
};

/**
 * Handle ONC file load event.
 * @param {Array.<Object>} files  Array of files in file upload format.
 * @returns {Boolean}  Indicates the event needs to be passed to other objects.
 */
loadDialog.handleLoadFile = function(files) {
  var applyButton = $('#apply-button', '#load-dialog');
  $('#apply-errors').html('');
  for (var i = 0; i < files.length; ++i) {
    var file = files[i];
    var reader = new FileReader();
    reader.onload = function(theFile) {
      // Enable the Load File button when done reading from disk.
      loadDialog.oncToLoad = this.result;
      $('#apply-errors', '#load-dialog').html('');
      $('#apply-warnings', '#load-dialog').html('');
      main.enableInput(applyButton);
    };
    reader.readAsBinaryString(file);
  }
  return false;
};

/**
 * Configures the ONC load file picker.
 */
loadDialog.configureLoadFilePicker = function() {
  $('#load-file').change(function(event) {
    loadDialog.handleLoadFile(event.target.files);
  });
};

/**
 * Handles apply button press in load dialog.
 */
loadDialog.onApplyPress = function() {
  loadDialog.loadConfig(loadDialog.oncToLoad);
  // Ignore apply button if nothing was loaded or there are errors.
  if (!loadDialog.oncToLoadResult || loadDialog.oncToLoadResult.errors.length) {
    // Clear the filename and passphrase out if we had errors.
    $('#load-file-form')[0].reset();
    main.disableInput($('#apply-button', '#load-dialog'));
    ui.showMessages(loadDialog.oncToLoadResult, '#load-dialog');
    return;
  }
  main.oncCurrent = loadDialog.oncToLoad;
  main.externalEntitySet = onc.getEntitySet(main.oncCurrent);
  loadDialog.oncToLoad = undefined;
  loadDialog.oncToLoadResult = undefined;
  ui.dismissDialog();
};

