// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Namespace for any networking (WiFi or VPN) dialog.  Think of this like
 * a base class of wiFiDialog and vpnDialog.
 */
var networkDialog = {};

/**
 * Initializes the parts of Wi-Fi/VPN dialogs that are shared.
 * @param {Object} derived
 */
networkDialog.init = function(dialogDom) {
  networkDialog.dialogDom = dialogDom;
  var proxyPoint = $('#proxy-insertion-point', dialogDom);
  // Copy in the proxy template if it's not yet there.
  if ($('#proxy-settings-section', proxyPoint).length == 0) {
    proxyPoint.append($('#proxy-settings-section'));
    $('#proxy-settings-section', proxyPoint).show();
  }
  ui.setSelectedI18n($('#proxy-type', proxyPoint), 'proxyDirect');
  networkDialog.manualProxySettings = [
    { selectorPrefix: '#http',
      oncName: 'HTTPProxy' },
    { selectorPrefix: '#secure-http',
      oncName: 'SecureHTTPProxy' },
    { selectorPrefix: '#ftp',
      oncName: 'FTPProxy' },
    { selectorPrefix: '#socks',
      oncName: 'SOCKS' }
  ];
  for (var i = 0; i < networkDialog.manualProxySettings.length; ++i) {
    var setting = networkDialog.manualProxySettings[i];
    $(setting.selectorPrefix + '-proxy-host').val('');
    $(setting.selectorPrefix + '-proxy-port').val('');
  }
  $('#auto-configuration-url', proxyPoint).val('');
  $('#proxy-type', proxyPoint).change(function(event) {
    networkDialog.setUiVisibility();
  });
};

/**
 * Sets visibility of common network dialog elements.
 */
networkDialog.setUiVisibility = function() {
  var type = $('#proxy-type', networkDialog.dialogDom);
  if (type.val() == 'Manual')
    $('#proxy-manual-div', networkDialog.dialogDom).show();
  else
    $('#proxy-manual-div', networkDialog.dialogDom).hide();
  if (type.val() == 'PAC')
    $('#proxy-automatic-div', networkDialog.dialogDom).show();
  else
    $('#proxy-automatic-div', networkDialog.dialogDom).hide();
};

/**
 * Sets up common network UI based on oncNetwork.
 */
networkDialog.setToUi = function(oncNetwork) {
  if ('ProxySettings' in oncNetwork && 'Type' in oncNetwork.ProxySettings) {
    var oncProxy = oncNetwork.ProxySettings;
    $('#proxy-type', networkDialog.dialogDom).val(oncProxy.Type);
    if (oncProxy.Type == 'Direct') {
    } else if (oncProxy.Type == 'Manual') {
      for (var i = 0; i < networkDialog.manualProxySettings.length; ++i) {
        var setting = networkDialog.manualProxySettings[i];
        $(setting.selectorPrefix + '-proxy-host').val(
          oncProxy.Manual[setting.oncName].Host)
        $(setting.selectorPrefix + '-proxy-port').val(
          oncProxy.Manual[setting.oncName].Port);
      }
    } else if (oncProxy.Type == 'PAC') {
      $('#auto-configuration-url', networkDialog.dialogDom).val(
        oncProxy.PAC);
    } else if (oncProxy.Type == 'WPAD') {
      // WPAD is separately called out in the ONC format, but displayed
      // here as in Chrome, multiplexed into the Automatic PAC setting
      // when the PAC URL is empty.
      $('#proxy-type', networkDialog.dialogDom).val('PAC');
    }
  }
};

/**
 * Reads from the common network UI and stores into oncNetwork.
 * @param {Object} oncNetwork  Network to store into.
 */
networkDialog.getFromUi = function(oncNetwork) {
  var dialogDom = networkDialog.dialogDom;
  var type = $('#proxy-type', dialogDom);
  var oncProxy = {
    'Type': type.val()
  };
  if (type.val() == 'Manual') {
    oncProxy.Manual = {};
    for (var i = 0; i < networkDialog.manualProxySettings.length; ++i) {
      var setting = networkDialog.manualProxySettings[i];
      var hostString = $(setting.selectorPrefix + '-proxy-host',
                         dialogDom).val();
      var portString = $(setting.selectorPrefix + '-proxy-port',
                         dialogDom).val();
      // Skip any empty settings.
      if (hostString == '' && portString == '')
        continue;
      var portVal = portString;
      // If we cannot preserve value as int, keep it as a string and
      // get a validation error later.
      if (parseInt(portVal) == portVal)
        portVal = parseInt(portVal);
      oncProxy.Manual[setting.oncName] = { 'Host': hostString,
                                           'Port': portVal };
    }
  } else if (type.val() == 'PAC') {
    var pacValue = $('#auto-configuration-url', dialogDom).val();
    if (pacValue == '') {
      oncProxy.Type = 'WPAD';
    } else {
      oncProxy.PAC = pacValue;
    }
  }
  oncNetwork.ProxySettings = oncProxy;
};


