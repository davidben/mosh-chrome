// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for the remove
 * entity dialog.
 */

/**
 * Namespace for remove (certificate or network) dialog.
 */
var removeDialog = {};

removeDialog.setOncData = function(oncData) {
  removeDialog.oncData = oncData;
};

removeDialog.onRemovePress = function() {
  onc.removeEntity(removeDialog.oncData.GUID, main.oncCurrent);
  ui.updateSummary();
  ui.dismissDialog();
};

removeDialog.onMarkRemovePress = function() {
  onc.markRemoveEntity(removeDialog.oncData.GUID, main.oncCurrent);
  ui.updateSummary();
  ui.dismissDialog();
};

removeDialog.init = function() {
  var GUID = removeDialog.oncData.GUID;
  var oncEntityInfo = onc.findEntity(GUID, main.oncCurrent);
  var isExternalEntity = GUID in main.externalEntitySet;
  var entity = main.oncCurrent[oncEntityInfo.entityList][oncEntityInfo.index];
  var replacementI18n;
  var shortDescription;
  if (oncEntityInfo.entityList == 'Certificates') {
    replacementI18n = chrome.i18n.getMessage('certificate');
    shortDescription = ui.formatCertificate(entity, 1);
  } else {
    replacementI18n = chrome.i18n.getMessage('network');
    shortDescription = ui.formatNetwork(entity, 1);
  }
  if (isExternalEntity && !onc.isMarkedForRemoval(entity)) {
    $('#remove-content').hide();
    $('#mark-remove-content').show();
    $('#help-mark-remove-content')[0].innerText =
      chrome.i18n.getMessage('helpMarkRemoveContent',
                             [ replacementI18n,
                               shortDescription ]);
    $('#mark-remove-button', '#remove-dialog').show();
  } else {
    $('#remove-content').show();
    $('#mark-remove-content').hide();
    $('#help-remove-content')[0].innerText =
      chrome.i18n.getMessage('helpRemoveContent',
                             [ replacementI18n,
                               shortDescription ]);
    $('#mark-remove-button', '#remove-dialog').hide();
  }
  $('#mark-remove-button', '#remove-dialog').click(
      removeDialog.onMarkRemovePress);
  $('#remove-button', '#remove-dialog').click(
      removeDialog.onRemovePress);
};
