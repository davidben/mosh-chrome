// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for the VPN
 * configuration dialog.
 */

/**
 * Namespace for WiFi dialog.
 */
var wiFiDialog = {};

/**
 * Called to hide/show fields according to settings.
 */
wiFiDialog.setUiVisibility = function() {
  wiFiDialog.setWifiSecurityVisible();
  wiFiDialog.setEapVisible();
  wiFiDialog.setCredentialsVisible();
  networkDialog.setUiVisibility();
};

/**
 * Based on current Wi-Fi security setting, set visible configuration.
 */
wiFiDialog.setWifiSecurityVisible = function() {
  var security = $('#security').val();
  if (security == 'WEP-PSK' || security == 'WPA-PSK') {
    $('#passphrase-div').show();
  } else {
    $('#passphrase-div').hide();
  }
  if (security == 'WPA-EAP') {
    $('#8021x-div').show();
  } else {
    $('#8021x-div').hide();
  }
};

/**
 * Based on current EAP settings, return if password is required for
 * connection.
 * @returns {Boolean}
 */
wiFiDialog.wifiRequiresPassword = function() {
  var security = $('#eap').val();
  return (security == 'EAP-TTLS' || security == 'PEAP' || security == 'LEAP');
};

/**
 * Based on current EAP settings, return if an inner authentication protocol
 * method setting is required.
 * @returns {Boolean}
 */
wiFiDialog.wifiRequiresPhase2Method = function() {
  var security = $('#eap').val();
  return security == 'EAP-TTLS' || security == 'PEAP';
};

/**
 * Based on current EAP settings, return if a server certificate check is
 * required.
 * @returns {Boolean}
 */
wiFiDialog.wifiRequiresServerCertificate = function() {
  var security = $('#eap').val();
  return (security == 'EAP-TTLS' || security == 'PEAP' ||
          security == 'EAP-TLS');
};

/**
 * Based on current EAP settings, return if a client certificate check is
 * required.
 * @returns {Boolean}
 */
wiFiDialog.wifiRequiresClientCertficate = function() {
  return $('#eap').val() == 'EAP-TLS';
};

/**
 * Based on current EAP setting, set visible configuration.
 */
wiFiDialog.setEapVisible = function() {
  if (wiFiDialog.wifiRequiresPhase2Method()) {
    $('#phase2-div').show();
  } else {
    $('#phase2-div').hide();
  }

  if (wiFiDialog.wifiRequiresServerCertificate()) {
    $('#eap-server-ca').show();
  } else {
    $('#eap-server-ca').hide();
  }

  if (wiFiDialog.wifiRequiresClientCertficate()) {
    $('#eap-client-cert').show();
  } else {
    $('#eap-client-cert').hide();
  }
};

/**
 * Set visible credentials based on kind of EAP chosen.
 */
wiFiDialog.setCredentialsVisible = function() {
  if ($('#save-credentials').is(':checked'))
    $('#phase2-auth-cred').show();
  else
    $('#phase2-auth-cred').hide();
  if (wiFiDialog.wifiRequiresPassword())
    $('#div-password', '#phase2-auth-cred').show();
  else
    $('#div-password', '#phase2-auth-cred').hide();
};

/**
 * Validate and convert the WiFi configuration to ONC.
 * @returns {Object}  Result array containing warnings, errors, and the
 *                    ONC NetworkConfiguration object for WiFi.
 */
wiFiDialog.getFromUi = function() {
  var network = {};
  if (wiFiDialog.oncBase)
    network = wiFiDialog.oncBase;
  network.GUID = $('#wifi-guid').val();
  network.Name = $('#ssid').val();
  network.Type = 'WiFi';
  onc.setUpAssocArray(network, 'WiFi');
  network.WiFi.AutoConnect = $('#auto-connect').is(':checked');
  network.WiFi.HiddenSSID = $('#hidden-ssid').is(':checked') != false;
  network.WiFi.Security = $('#security').val();
  network.WiFi.SSID = $('#ssid').val();
  switch (network.WiFi.Security) {
  case 'WEP-PSK':
  case 'WPA-PSK':
    network.WiFi.Passphrase = $('#passphrase').val();
    delete network.WiFi.EAP;
    break;
  case 'WPA-EAP':
    onc.setUpAssocArray(network.WiFi, 'EAP');
    network.WiFi.EAP.Outer = $('#eap').val();
    network.WiFi.EAP.UseSystemCAs = $('#wifi-server-ca').val() != 'ignore';
    if ($('#save-credentials').is(':checked')) {
      network.WiFi.EAP.SaveCredentials = true;
      // Don't bother getting the username/password if save
      // credentials is off.  That would be an inconsistent state.
      network.WiFi.EAP.Identity = $('#wifi-identity').val();
      network.WiFi.EAP.Password = $('#wifi-password').val();
    }
    if (wiFiDialog.wifiRequiresServerCertificate()) {
      if ($('#wifi-server-ca').val() != 'default') {
        network.WiFi.EAP.ServerCARef = $('#wifi-server-ca').val();
      }
    }
    if (wiFiDialog.wifiRequiresClientCertficate()) {
      network.WiFi.EAP.ClientCertType = 'Pattern';
      onc.setUpAssocArray(network.WiFi.EAP, 'ClientCertPattern');
      if ($('#wifi-client-ca').val() != 'empty') {
        network.WiFi.EAP.ClientCertPattern.IssuerCARef =
          $('#wifi-client-ca').val();
      }
      network.WiFi.EAP.ClientCertPattern.EnrollmentUri =
        $('#wifi-enrollment-uri').val();
    }
    delete network.WiFi.Passphrase;
    break;
  }

  if (network.WiFi.Security == 'WEP-PSK') {
    var asciiLengths = [5, 13, 16, 29];
    if (asciiLengths.indexOf(network.WiFi.Passphrase.length) != -1) {
      // Store the WEP passphrase as hex as required by ONC.
      network.WiFi.Passphrase = '0x' + main.toHex(network.WiFi.Passphrase);
    } else {
      var hexNumber = network.WiFi.Passphrase;
      if (hexNumber.substr(0, 2) == '0x')
        hexNumber = hexNumber.substr(2);
      network.WiFi.Passphrase = '0x' + hexNumber.toLowerCase();
    }
  }
  networkDialog.getFromUi(network);
  return network;
};

/**
 * Handle apply button press on the WiFi modal dialog.  Responsible for
 * showing errors, blocking save, and dismissing modal dialog.
 */
wiFiDialog.onApplyPress = function() {
  var newWiFi = wiFiDialog.getFromUi();
  var oncTest = onc.createUpdate(newWiFi, 'NetworkConfigurations');
  var result = onc.validateNetwork(onc.findNetwork(newWiFi.GUID, oncTest),
                                   oncTest);
  ui.showMessagesAndApply(result, oncTest, $('#wifi-dialog')[0]);
};

/**
 * Called to initialize the WiFi dialog.
 */
wiFiDialog.init = function() {
  $('#ssid').val('');
  $('#hidden-ssid')[0].checked = false;
  $('#auto-connect')[0].checked = false;
  ui.setSelectedI18n('#security', 'securityNone');
  $('#passphrase').val('');
  ui.setSelectedI18n('#eap', 'acronymPeap');
  ui.setSelectedI18n('#phase2', 'automatic');
  $('#save-credentials')[0].checked = false;
  $('#wifi-identity').val('');
  $('#wifi-password').val('');
  $('#wifi-server-ca').val('');
  $('#wifi-client-ca').val('');
  $('#wifi-guid').val(main.createGuid());
  var serverCaDom = $('#wifi-server-ca')[0];
  serverCaDom.options.length = 0;
  serverCaDom.options.add(new Option(chrome.i18n.getMessage
                                     ('useAnyDefaultCA'), 'default'));
  ui.updateCertificateDropdown(serverCaDom, false);
  serverCaDom.options.add(new Option(chrome.i18n.getMessage
                                     ('doNotCheckCA'), 'ignore'));
  ui.updateCertificateDropdown($('#wifi-client-ca')[0], true);
  $('#apply-button', '#wifi-dialog').click(wiFiDialog.onApplyPress);
  $('#security').change(function() {
    wiFiDialog.setUiVisibility();
  });
  $('#eap').change(wiFiDialog.setUiVisibility);
  $('#save-credentials').click(function() {
    wiFiDialog.setUiVisibility();
  });
  wiFiDialog.setUiVisibility();
  networkDialog.init($('#wifi-dialog'));
  $('#ssid').focus();
};

/**
 * Set up the UI with given WiFi ONC configuration.
 * @param {Object} netconfig  WiFi ONC object
 **/
wiFiDialog.setToUi = function(netConfig) {
  // Preserve any existing settings.
  wiFiDialog.oncBase = netConfig;
  $('#wifi-guid').val(netConfig.GUID);
  wifiConfig = netConfig.WiFi;
  $('#ssid').val(wifiConfig.SSID);
  if ('AutoConnect' in wifiConfig)
    $('#auto-connect')[0].checked = wifiConfig.AutoConnect != false;
  if ('HiddenSSID' in wifiConfig)
    $('#hidden-ssid')[0].checked = wifiConfig.HiddenSSID != false;
  if ('Passphrase' in wifiConfig) {
    // Strip off any '0x' from hex passphrases.  We'll correctly
    // interpret it as a hex passphrase when we save and add the
    // '0x' back on.
    if (wifiConfig.Security == 'WEP-PSK' &&
        wifiConfig.Passphrase.substr(0, 2) == '0x')
      wifiConfig.Passphrase = wifiConfig.Passphrase.substr(2);
    $('#passphrase').val(wifiConfig.Passphrase);
  }
  $('#security').val(wifiConfig.Security);
  if ('EAP' in wifiConfig && wifiConfig.Security == 'WPA-EAP') {
    var eapConfig = netConfig.WiFi.EAP;
    switch (eapConfig.Outer) {
    case 'PEAP':
    case 'EAP-TTLS':
    case 'EAP-TLS':
    case 'LEAP':
      $('#eap').val(eapConfig.Outer);
      break;
    }
    if ('Identity' in eapConfig) {
      $('#wifi-identity').val(eapConfig.Identity);
    }
    if ('Password' in eapConfig) {
      $('#wifi-password').val(eapConfig.Password);
    }
    if ('SaveCredentials' in eapConfig && eapConfig.SaveCredentials)
      $('#save-credentials')[0].checked = true;
    if (onc.findCert(eapConfig.ServerCARef, main.oncCurrent) >= 0)
      $('#wifi-server-ca').val(eapConfig.ServerCARef);
    else if (!('UseSystemCAs' in eapConfig) || eapConfig.UseSystemCAs) {
      $('#wifi-server-ca').val('default');
    } else {
      $('#wifi-server-ca').val('ignore');
    }
    if ('ClientCertPattern' in eapConfig) {
      // TODO: handle more complex client cert patterns.
      var certPattern = eapConfig.ClientCertPattern;
      if ('IssuerCARef' in certPattern)
        $('#wifi-client-ca').val(certPattern.IssuerCARef);
      if ('EnrollmentUri' in certPattern)
        $('#wifi-enrollment-uri').val(certPattern.EnrollmentUri);
    }
  }
  networkDialog.setToUi(netConfig);
};

