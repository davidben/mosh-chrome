// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for the certificate dialog.
 */

/**
 * Namespace for certificate dialog.
 */
var certDialog = {};

/**
 * Update the certificate summary based on the currently loaded cert.
 */
certDialog.updateBox = function() {
  if (!certDialog.certData || !('X509' in certDialog.certData)) {
    $('#cert-instructions').show();
    $('#cert-summary').hide();
    return;
  }
  $('#cert-instructions').hide();
  $('#cert-summary').show();
  var cert = main.interpretCertFromX509Pem(certDialog.certData.X509);
  function updateEntity(table, entity) {
    var fields = $('.cert-fill', table);
    for (var i = 0; i < fields.length; ++i) {
      if (fields[i].id in entity)
        fields[i].innerText = entity[fields[i].id];
      else
        fields[i].innerText = '';
    }
  }
  updateEntity($('#subject', '#cert-summary'), cert.subject);
  updateEntity($('#issuer', '#cert-summary'), cert.issuer);
};

/**
 * Handle a drag and drop file list.  We validate the certificate
 * file, show a summary of the certificate, and store the
 * contents for later in certData.
 * @param {Array.<Object>} files  drag and drop file list.
 */
certDialog.handleCertFileList = function(files) {
  certDialog.loadedCert = null;
  for (var i = 0; i < files.length; ++i) {
    var file = files[i];
    var reader = new FileReader();
    reader.onload = function(theFile) {
      var derUint8;
      if (file.name.match(/\.pem$/) || file.name.match(/\.crt$/)) {
        var der = Base64.unarmor(this.result);
        derUint8 = main.arrayToUint8Array(der);
      } else if (file.name.match(/\.der/)) {
        // TODO: This is currently broken
        var der = this.result;
        derUint8 = main.arrayToUint8Array(der);
      }
      certDialog.certData = {};
      if (derUint8)
        certDialog.certData.X509 = Base64.encode(derUint8);
      // Create a new ONC object.
      var newCert = certDialog.getFromUi();
      var oncTest = onc.createUpdate(newCert, 'Certificates');
      var results = onc.validateCertificate(
        onc.findCert(newCert.GUID, oncTest), oncTest);
      ui.showMessages(results, '#cert-dialog');
      certDialog.updateBox();
    };
    reader.readAsBinaryString(file);
  }
  return false;
};

/**
 * Set up the UI with the given certificate ONC.  Error checking is
 * not performed.
 * @param {Object} oncCert  Certificate
 */
certDialog.setToUi = function(oncCert) {
  certDialog.oncBase = oncCert;
  certDialog.certData.X509 = oncCert.X509;
  if ('Trust' in oncCert) {
    for (var i = 0; i < oncCert.Trust.length; ++i) {
      if (oncCert.Trust[i] == 'Web')
        $('#web-trust')[0].checked = true;
    }
  }
  $('#cert-type').val(oncCert.Type);
  certDialog.updateBox();
};

/**
 * Called to hide/unhide UI fields.
 */
certDialog.setUiVisibility = function() {
};

/**
 * Validate and convert the certificate configuration to ONC.
 * @returns {Object}  ONC Certificate object.
 */
certDialog.getFromUi = function() {
  // TODO: Handle or deprecate PKCS12 loading (in which case
  // we load PKCS8).
  var oncCert = {};
  if ('oncBase' in certDialog)
    oncCert = certDialog.oncBase;
  onc.setUpArray(oncCert, 'Trust');
  onc.setBitArray(oncCert.Trust, 'Web', $('#web-trust').is(':checked'));
  oncCert.GUID = $('#cert-guid').val();
  oncCert.Type = $('#cert-type').val();
  if ('X509' in certDialog.certData)
    oncCert.X509 = certDialog.certData.X509;
  return oncCert;
};

/**
 * Configure the given DOM id as a drag and drop target for certificates.
 * @param {String} id  DOM id.
 */
certDialog.configureDragDropTarget = function(id) {
  function cancel(event) {
    if (event.preventDefault)
      event.preventDefault();
    return false;
  }
  var drop = $('#' + id)[0];
  drop.addEventListener('dragover', cancel, false);
  drop.addEventListener('dragenter', cancel, false);
  drop.addEventListener('drop', function(event) {
    certDialog.handleCertFileList(event.dataTransfer.files);
  }, false);
};

/**
 * Configure the certificate file picker.
 */
certDialog.configureCertFilePicker = function() {
  $('#cert-files').change(function(event) {
    certDialog.handleCertFileList(event.target.files);
  });
};

/**
 * Handles save of certificate.
 */

certDialog.onApplyPress = function() {
  var newCert = certDialog.getFromUi();
  var oncTest = onc.createUpdate(newCert, 'Certificates');
  var results = onc.validateCertificate(
    onc.findCert(newCert.GUID, oncTest), oncTest);
  ui.showMessagesAndApply(results, oncTest, $('#cert-dialog')[0]);
};

/**
 * Called to initialize the cert dialog.
 */
certDialog.init = function() {
  certDialog.certData = {};
  $('#cert-guid').val(main.createGuid());
  $('#web-trust')[0].checked = false;
  ui.setSelectedI18n('#cert-type', 'certificateTypeAuthority');
  $('#apply-button', '#cert-dialog').click(certDialog.onApplyPress);
  ui.resetFilePicker('#cert-files');
  certDialog.configureDragDropTarget('cert-summary');
  certDialog.configureCertFilePicker();
  $('#cert-files').focus();
  certDialog.updateBox();
};
