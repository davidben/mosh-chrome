// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for the VPN
 * configuration dialog.
 */

/**
 * Namespace for VPN dialog.
 */
var vpnDialog = {};

/**
 * Based on current VPN setting, set visible configuration.
 */
vpnDialog.setUiVisibility = function() {
  var setting = $('#vpn-type').val();
  if (setting == 'L2TP-IPsec-PSK') {
    $('#vpn-psk-div').show();
    $('#vpn-cert-div').hide();
  } else if (setting == 'L2TP-IPsec-Cert' || setting == 'OpenVPN') {
    $('#vpn-psk-div').hide();
    $('#vpn-cert-div').show();
  }
  if ($('#vpn-save-credentials').is(':checked'))
    $('#vpn-user-cred').show();
  else
    $('#vpn-user-cred').hide();
  networkDialog.setUiVisibility();
};

/**
 * Gets the username and password for the user from the UI.
 * @param {Object} container The destination container for the credentials.
 */
vpnDialog.getUserCredentialsFromUi = function(container) {
  var saveCredentials = $('#vpn-save-credentials').is(':checked');
  container.SaveCredentials = saveCredentials;
  if (saveCredentials) {
    container.Username = $('#vpn-username').val();
    container.Password = $('#vpn-password').val();
  } else {
    delete container.Username;
    delete container.Password;
  }
};

/**
 * Gets the certificate information from the UI.
 * @param {Object} container The destination container for the certificate info.
 */
vpnDialog.getCertsFromUi = function(container) {
  var serverCa = $('#vpn-server-ca').val();
  if (serverCa != 'empty') {
    container.ServerCARef = serverCa;
  }
  container.ClientCertType = 'Pattern';
  var clientCa = $('#vpn-client-ca').val();
  onc.setUpAssocArray(container, 'ClientCertPattern');
  if (clientCa != 'empty') {
    container.ClientCertPattern.IssuerCARef = clientCa;
  }
  if ($('#vpn-enrollment-uri').val()) {
    container.ClientCertPattern.EnrollmentURI = [
        $('#vpn-enrollment-uri').val() ];
  } else {
    delete container.ClientCertPattern.EnrollmentURI;
  }
};

/**
 * Validate and convert the VPN configuration to ONC.
 * @returns {Object}      ONC NetworkConfiguration object for VPN.
 */
vpnDialog.getFromUi = function() {
  var network = {};
  if (vpnDialog.oncBase)
    network = vpnDialog.oncBase;
  network.GUID = $('#vpn-guid').val();
  network.Name = $('#vpn-name').val();
  network.Type = 'VPN';
  onc.setUpAssocArray(network, 'VPN');
  network.VPN.Host = $('#vpn-host').val();
  var vpnType = $('#vpn-type').val();
  if (vpnType == 'L2TP-IPsec-PSK' || vpnType == 'L2TP-IPsec-Cert') {
    network.VPN.Type = 'L2TP-IPsec';
    onc.setUpAssocArray(network.VPN, 'IPsec');
    network.VPN.IPsec.IKEVersion = 1;
    onc.setUpAssocArray(network.VPN, 'L2TP');
    vpnDialog.getUserCredentialsFromUi(network.VPN.L2TP);
  } else {
    network.VPN.Type = 'OpenVPN';
    onc.setUpAssocArray(network.VPN, 'OpenVPN');
    vpnDialog.getUserCredentialsFromUi(network.VPN.OpenVPN);
  }
  if (vpnType == 'L2TP-IPsec-Cert') {
    network.VPN.IPsec.AuthenticationType = 'Cert';
    vpnDialog.getCertsFromUi(network.VPN.IPsec);
    delete network.VPN.IPsec.PSK;
  } else if (vpnType == 'L2TP-IPsec-PSK') {
    network.VPN.IPsec.AuthenticationType = 'PSK';
    if ($('#vpn-psk').val())
      network.VPN.IPsec.PSK = $('#vpn-psk').val();
    else
      delete network.VPN.IPsec.PSK;
    delete network.VPN.IPsec.ServerCARef;
    delete network.VPN.IPsec.ClientCertPattern;
  } else if ($('#vpn-type').val() == 'OpenVPN') {
    vpnDialog.getCertsFromUi(network.VPN.OpenVPN);
  }
  networkDialog.getFromUi(network);
  return network;
};

/**
 * Handle save button press on the VPN modal dialog.  Responsible for
 * showing errors, blocking save, and dismissing modal dialog.
 */
vpnDialog.onApplyPress = function() {
  var newVpn = vpnDialog.getFromUi();
  var oncTest = onc.createUpdate(newVpn, 'NetworkConfigurations');
  var result = onc.validateNetwork(onc.findNetwork(newVpn.GUID, oncTest),
                                   oncTest);
  ui.showMessagesAndApply(result, oncTest, $('#vpn-dialog')[0]);
};

/**
 * Called to initialize the VPN dialog.
 */
vpnDialog.init = function() {
  $('#vpn-name').val('');
  $('#vpn-host').val('');
  $('#vpn-psk').val('');
  $('#vpn-save-credentials')[0].checked = false;
  $('#vpn-username').val('');
  $('#vpn-password').val('');
  $('#vpn-enrollment-uri').val('');
  $('#vpn-guid').val(main.createGuid());
  ui.updateCertificateDropdown($('#vpn-server-ca')[0], true);
  ui.updateCertificateDropdown($('#vpn-client-ca')[0], true);
  $('#apply-button', '#vpn-dialog').click(vpnDialog.onApplyPress);
  $('#vpn-type').change(vpnDialog.setUiVisibility);
  $('#vpn-save-credentials').change(vpnDialog.setUiVisibility);
  vpnDialog.setUiVisibility();
  networkDialog.init($('#vpn-dialog'));
  $('#vpn-name').focus();
};

/**
 * Set up the UI with an object from ONC that has certificate information.
 * @param {Object} netconfig  VPN ONC object
 **/
vpnDialog.setCertToUi = function(vpnConfig) {
  if (onc.findCert(vpnConfig.ServerCARef, main.oncCurrent) >= 0)
    $('#vpn-server-ca').val(vpnConfig.ServerCARef);
  if (vpnConfig.ClientCertType == 'Pattern') {
    if (onc.findCert(vpnConfig.ClientCertPattern.IssuerCARef,
                     main.oncCurrent) >= 0) {
      $('#vpn-client-ca').val(vpnConfig.ClientCertPattern.IssuerCARef);
    }
    if ('EnrollmentURI' in vpnConfig.ClientCertPattern) {
      // TODO(gspencer): Support multiple entries in the enrollment
      // URI array (since that is how they are specified).
      $('#vpn-enrollment-uri').val(certPattern.EnrollmentURI[0]);
    }
  }
};

/**
 * Set up the UI with an object from ONC that has user credentials.
 * @param {Object} netconfig  VPN ONC object
 **/
vpnDialog.setUserCredentialsToUi = function(vpnConfig) {
  if ('Username' in vpnConfig)
    $('#vpn-username').val(vpnConfig.Username);
  if ('Password' in vpnConfig)
    $('#vpn-password').val(vpnConfig.Password);
  if ('SaveCredentials' in vpnConfig && vpnConfig.SaveCredentials)
    $('#vpn-save-credentials')[0].checked = true;
};

/**
 * Set up the UI with given VPN ONC configuration.
 * @param {Object} netconfig  VPN ONC object
 **/
vpnDialog.setToUi = function(netConfig) {
  vpnDialog.oncBase = netConfig;
  $('#vpn-name').val(netConfig.Name);
  $('#vpn-guid').val(netConfig.GUID);
  var vpnConfig = netConfig.VPN;
  $('#vpn-type').val(vpnConfig.Type);
  $('#vpn-host').val(vpnConfig.Host);
  if (vpnConfig.Type == 'L2TP-IPsec') {
    var ipsecConfig = vpnConfig.IPsec;
    if (ipsecConfig.AuthenticationType == 'PSK') {
      $('#vpn-type').val('L2TP-IPsec-PSK');
      if ('PSK' in ipsecConfig)
        $('#vpn-psk').val(ipsecConfig.PSK);
    } else if (ipsecConfig.AuthenticationType == 'Cert') {
      $('#vpn-type').val('L2TP-IPsec-Cert');
      vpnDialog.setCertToUi(ipsecConfig);
    }
    vpnDialog.setUserCredentialsToUi(vpnConfig.L2TP);
  } else {
    $('#vpn-type').val('OpenVPN');
    vpnDialog.setCertToUi(vpnConfig.OpenVPN);
    vpnDialog.setUserCredentialsToUi(vpnConfig.OpenVPN);
  }
  networkDialog.setToUi(netConfig);
};

