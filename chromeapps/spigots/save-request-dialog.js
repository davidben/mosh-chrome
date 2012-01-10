// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for the save
 * request dialog.
 */

/**
 * Namespace for save request dialog.
 */
var saveRequestDialog = {};

/**
 * Called to hide/unhide UI fields.
 */
saveRequestDialog.setUiVisibility = function() {
};

/**
 * Validates that the passphrase has been set and is reasonably complex.
 */
saveRequestDialog.validatePassphrase = function() {
  var passphraseErrors = $('#apply-errors', '#save-request-dialog');
  var passphraseField = $('#save-passphrase', '#save-request-dialog');
  var encryptButton = $('#encrypt-button', '#save-request-dialog');
  var passphrase = passphraseField.val();
  if (passphrase.length < 8) {
    passphraseErrors[0].innerText =
        chrome.i18n.getMessage('errorPassphraseTooShort');
    passphraseField.focus();
    main.disableInput(encryptButton);
    return;
  }
  // This checks to make sure that the passphrase has at least one
  // non-lowercase letter.
  var noFancyChars = passphrase.replace(/[^a-z]/g, function(str) { return '';});
  if (noFancyChars == passphrase) {
    passphraseErrors[0].innerText =
        chrome.i18n.getMessage('errorPassphraseTooSimple');
    passphraseField.focus();
    main.disableInput(encryptButton);
    return;
  }
  passphraseErrors[0].innerHTML = '&nbsp;';
  main.enableInput(encryptButton);
};

/**
 * Proceeds to the save dialog.
 */
saveRequestDialog.saveFile = function() {
  ui.openDialog('download');
};

/**
 * Toggles the availability of the encryption.
 */
saveRequestDialog.toggleEncryption = function() {
  var passphraseDiv = $('#save-passphrase-div', '#save-request-dialog');
  if ($('#use-encryption', '#save-request-dialog').is(':checked')) {
    main.enableInput($('#save-passphrase', '#save-request-dialog'));
    passphraseDiv.fadeTo('fast', 1.0);
    $('#apply-button', '#save-request-dialog').hide();
    $('#encrypt-button', '#save-request-dialog').show();
  } else {
    main.disableInput($('#save-passphrase', '#save-request-dialog'));
    passphraseDiv.fadeTo('fast', 0.50);
    $('#apply-button', '#save-request-dialog').show();
    $('#encrypt-button', '#save-request-dialog').hide();
  }
};

/**
 * Called to initialize the save request dialog.
 */
saveRequestDialog.init = function() {
  var passphraseField = $('#save-passphrase', '#save-request-dialog');
  var encryptButton = $('#encrypt-button', '#save-request-dialog');
  var applyButton = $('#apply-button', '#save-request-dialog');
  var useEncryptionCheck = $('#use-encryption', '#save-request-dialog');
  passphraseField.val('');
  $('#save-passphrase-div', '#save-request-dialog').show();
  passphraseField.keyup(saveRequestDialog.validatePassphrase);
  encryptButton.click(saveRequestDialog.saveFile);
  applyButton.click(saveRequestDialog.saveFile);
  applyButton.hide();
  useEncryptionCheck.click(saveRequestDialog.toggleEncryption);
  main.disableInput(encryptButton);
  $('#cancel-button', '#save-request-dialog').focus();
  saveRequestDialog.toggleEncryption();  // to set up the initial state.
};

