// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview This file contains implementation for Open Network
 * Configuration format querying and manipulation.
 *
 * See http://dev.chromium.org/chromium-os/chromiumos-design-docs/open-network-configuration.
 */

/**
 * Namespace for ONC manipulation.
 */
var onc = {};

/**
 * Create an onc blob based on the input onc blob, updating with the
 * given entity.  The entities within the blob will be references to
 * (not copies of) the original blob and entity.
 * @param {Object} entity  ONC entity to use as a replacement
 * @param {Object} type  Either NetworkConfigurations or Certificates.
 * @param {Object} oncData  ONC to update
 * @returns {Boolean}  Indicates if successful.
 */
onc.createUpdate = function(entity, type, oncData) {
  if (oncData == null)
    oncData = main.oncCurrent;
  var resultOnc = {
    'NetworkConfigurations': [],
    'Certificates': []
  };
  resultOnc.NetworkConfigurations = oncData.NetworkConfigurations.slice(0);
  resultOnc.Certificates = oncData.Certificates.slice(0);
  if (!('GUID' in entity)) {
    // Issue warning?
    return resultOnc;
  }
  function replaceGuid(array) {
    for (var i = 0; i < array.length; ++i) {
      if (array[i].GUID == entity.GUID) {
        array[i] = entity;
        return;
      }
    }
    array.push(entity);
  }
  if (type == 'NetworkConfigurations')
    replaceGuid(resultOnc.NetworkConfigurations);
  if (type == 'Certificates')
    replaceGuid(resultOnc.Certificates);
  return resultOnc;
};

/**
 * Create an empty associative array (JSON object) in the given ONC
 * object.  If there is already one, leave it alone.
 * @param {Object} outer  parent ONC object
 * @param {String} newAssocArray  String name of associative array.
 */
onc.setUpAssocArray = function(outer, newAssocArray) {
  if (!(newAssocArray in outer) || !(outer[newAssocArray] instanceof Object)) {
    outer[newAssocArray] = {};
  }
};

/**
 * Set up an associative array (JSON object) in the given ONC object.
 * If there is already one, leave it alone.
 * @param {Object} outer  parent ONC object
 * @param {String} newAssocArray  String name of associative array.
 */
onc.setUpArray = function(outer, newArray) {
  if (newArray in outer || !(outer[newArray] instanceof Array))
    outer[newArray] = [];
};

/**
 * Update array in place so that it has name in it iff value is non-zero.
 * @param {Array} array  input/output array.
 * @param {Scalar} name  name to find in array.
 * @param {Integer} value  value to use to determine if name should appear.
 */
onc.setBitArray = function(array, name, value) {
  if (value) {
    if (array.indexOf(name) < 0)
      array.push(name);
  } else {
    var index = array.indexOf(name);
    if (index >= 0)
      array.splice(index, 1);
  }
};

/**
 * Returns an associative array of entity GUIDs to "true".  This
 * enables quickly looking up if aan entity is in the given ONC file.
 * @param {Object} onc  ONC file.
 */
onc.getEntitySet = function(onc) {
  var map = {};
  for (var i = 0; i < main.oncCurrent.Certificates.length; ++i) {
    var oncCert = main.oncCurrent.Certificates[i];
    map[oncCert.GUID] = true;
  }
  for (var i = 0; i < main.oncCurrent.NetworkConfigurations.length; ++i) {
    var oncNetwork = main.oncCurrent.NetworkConfigurations[i];
    map[oncNetwork.GUID] = true;
  }
  return map;
};

/**
 * Find a cert in the cert list by GUID.
 * @returns {Integer}  index into certificate array or -1 if not found.
 */
onc.findCert = function(guid, oncData) {
  for (var i = 0; i < oncData.Certificates.length; ++i) {
    if (oncData.Certificates[i].GUID == guid)
      return i;
  }
  return -1;
};

/**
 * Find a network in the network list by GUID.
 * @returns {Integer}  index into certificate array or -1 if not found.
 */
onc.findNetwork = function(guid, oncData) {
  for (var i = 0; i < oncData.NetworkConfigurations.length; ++i) {
    if (oncData.NetworkConfigurations[i].GUID == guid)
      return i;
  }
  return -1;
};

/**
 * Finds an entity (a network or certificate) by GUID.
 * @param {String} guid  GUID of entity
 * @param {Object} oncData  ONC data.
 * @returns {Object}  Object containing 'entityList' and 'index'.  entityList
 *                    is the top level list (Certificates or
 *                    NetworkConfigurations).  index is the index into that
 *                    list.  If none is found, return null.
 */
onc.findEntity = function(guid, oncData) {
  var index = onc.findCert(guid, oncData);
  if (index >= 0) {
    return { 'entityList': 'Certificates', 'index': index };
  }
  index = onc.findNetwork(guid, oncData);
  if (index >= 0) {
    return { 'entityList': 'NetworkConfigurations',
             'index': index };
  }
  return null;
};

/**
 * Removes an entity by GUID.  Returns false if entity did not exist.
 * @params {String} guid  GUID of entity (cert or network) to remove.
 * @params {Object} oncData  ONC blob to update.
 * @returns {Boolean}  Indicates if successful.
 */
onc.removeEntity = function(guid, oncData) {
  var entityLocation = onc.findEntity(guid, oncData);
  if (!entityLocation)
    return false;
  var array = oncData[entityLocation.entityList];
  var index = entityLocation.index;
  array = array.slice(0, index).concat(array.slice(index + 1));
  oncData[entityLocation.entityList] = array;
  return true;
};

/**
 * Marks an entity for removal by GUID.  Entity must already exist.
 * Returns false if entity did not exist.
 * @params {String} guid  GUID of entity (cert or network) to remove.
 * @params {Object} oncData  ONC blob to update.
 * @returns {Boolean}  Indicates if successful.
 */
onc.markRemoveEntity = function(guid, oncData) {
  var entityLocation = onc.findEntity(guid, oncData);
  if (!entityLocation)
    return false;
  var entity = oncData[entityLocation.entityList][entityLocation.index];
  var removeEntity = {
    'GUID': guid,
    'Remove': true
  };
  if ('Name' in entity) {
    // Preserve the Name if it exists for better diagnostics.
    removeEntity.Name = entity.Name;
  }
  oncData[entityLocation.entityList][entityLocation.index] = removeEntity;
  return true;
};

/**
 * Determines if a entity has already been marked for removal.
 * @params {Object} oncEntity  ONC blob to update.
 * @returns {Boolean}  Indicates if marked for removal.
 */
onc.isMarkedForRemoval = function(oncEntity) {
  return ('Remove' in oncEntity && oncEntity.Remove);
};

/**
 * Validate an ONC Client Certificate.  This handles both the client
 * certificate reference and certificate pattern cases.
 * @param {Object} network  NetworkConfiguration ONC object.
 * @param {Object} result  Result object indicating errors and warnings.
 */
onc.validateClientCert = function(outer, index, oncData, result) {
  var network = oncData.NetworkConfigurations[index];
  if (!('ClientCertType' in outer)) {
    result.errors.push(['errorLoadRequiredObjectMissing', 'ClientCertType']);
    return result;
  }

  if (outer.ClientCertType == 'Ref') {
    if (!('ClientCertRef' in outer)) {
      result.errors.push(['errorLoadRequiredObjectMissing', 'ClientCertRef']);
      return result;
    }
    if (onc.findCert(outer.ClientCertRef, oncData) < 0) {
      result.errors.push(['errorBadCertReference',
                          network.Name, 'ClientCertRef', outer.ClientCertRef]);
    }
  } else if (outer.ClientCertType == 'Pattern') {
    if (!('ClientCertPattern' in outer)) {
      result.errors.push(['errorLoadRequiredObjectMissing',
                          'ClientCertPattern']);
      return result;
    }
    var pattern = outer.ClientCertPattern;
    if (!('IssuerCARef' in pattern) &&
        !('Subject' in pattern)) {
      result.errors.push(['errorMissingClientCA', network.Name]);
      return result;
    }
    if ('IssuerCARef' in pattern &&
        onc.findCert(pattern.IssuerCARef, oncData) < 0) {
      result.errors.push(['errorBadCertReference',
                          network.Name, 'IssuerCARef', pattern.IssuerCARef]);
    }
  } else {
    result.errors.push(['errorLoadRequiredObjectMissing', 'ClientCertType']);
  }
  return result;
};

onc.validateUnencryptedConfiguration = function(oncData, result) {
  if (!result)
    result = { 'errors': [], 'warnings': [], 'hasOpaqueEntity': false };
  var hasOne;
  for (var field in oncData) {
    if (field == 'NetworkConfigurations' ||
        field == 'Certificates') {
      hasOne = true;
    } else if (field != 'Type') {
      result.warnings.push(['warningUnrecognizedTopLevelField', field]);
    }
  }
  if (!hasOne) {
    result.errors.push(['errorEmptyOnc']);
  }
  if (!('Type' in oncData)) {
    result.warnings.push(['warningConfigurationTypeMissing']);
  }
  if ('Type' in oncData && oncData.Type != 'UnencryptedConfiguration') {
    result.errors.push(['errorInvalidConfigurationType', oncData.Type]);
  }
  if (!('NetworkConfigurations' in oncData))
    oncData.NetworkConfigurations = [];
  for (var i = 0; i < oncData.NetworkConfigurations.length; ++i)
    onc.validateNetwork(i, oncData, result);
  if (!('Certificates' in oncData))
    oncData.Certificates = [];
  for (var i = 0; i < oncData.Certificates.length; ++i)
    onc.validateCertificate(i, oncData, result);
  return result;
};

/**
 * Returns true if the given config has all the required fields for an
 * encrypted configuration.  Does not decrypt anything to check inside
 * the encrypted payload.
 * @param {Object} config An ONC configuration dictionary.
 * @param {Array} result An array of errors and warnings to add to.
 * @returns {Array} the result passed in, plus any new errors or warnings.
 */
onc.validateEncryptedConfiguration = function(config, result) {
  if (!config) {
    result.errors.push(['errorEmptyOnc']);
    return result;
  }
  var requiredFields = { 'Cipher': 'AES256',
                         'Ciphertext': null,
                         'HMAC': null,
                         'HMACMethod': 'SHA1',
                         'IV': null,
                         'Iterations': null,
                         'Salt': null,
                         'Stretch': 'PBKDF2',
                         'Type': 'EncryptedConfiguration' };
  for (field in requiredFields) {
    if (!(field in config)) {
      result.errors.push(['errorMissingEncryptionField', field]);
      continue;
    }
    if (requiredFields[field] && config[field] != requiredFields[field]) {
      result.errors.push(['errorUnsupportedEncryptionMode',
                          config[field], field]);
    }
  }
  return result;
}

/**
 * Returns true if the given config is an encrypted ONC file.
 * @param {Object} config An ONC configuration dictionary.
 * @returns {Boolean} True if this ONC file is an encrypted one.
 */
onc.isEncrypted = function(config) {
  return (config &&
          ('Type' in config) &&
          config.Type == "EncryptedConfiguration");
};

/**
 * Actually does the config encryption.  Encrypt the result using
 * AES256 using a CBC block cipher, with an HMAC-SHA1 and using a
 * salted, SHA1-iterated stretched key (PBKDF2).  This is what NSS can
 * decrypt on the other side, so using other parameters is probably
 * not going to work, but we keep the file format flexible.
 *
 * @param {String} passphrase Passphrase for encrypting config.
 * @param {String} plaintextConfig Plaintext ONC file JSON string.
 * @returns {String} Encrypted ONC string (JSON format).
 */
onc.encryptConfig = function(passphrase, config) {
  try {
    var plaintextConfig = JSON.stringify(config, null, "  ");
    var salt = Crypto.util.randomBytes(8);
    // TODO(gspencer): There is an asyncronous version of PBKDF2 that
    // would allow the UI to not be locked (so we can put up a wait
    // spinner) that we should use.  It locks for about a second
    // for 20000 iterations, so it's not a huge problem, but still...
    var iterations = 20000;
    var iv = Crypto.util.randomBytes(16);
    var stretchedPassphrase = Crypto.PBKDF2(passphrase,
                                             salt,
                                             32,
                                             { iterations: iterations,
                                               hasher: Crypto.SHA1,
                                               asBytes:true });
    var ciphertext = Crypto.AES.encrypt(
        plaintextConfig,
        stretchedPassphrase,
        { iv: iv,
          mode: new Crypto.mode.CBC(Crypto.pad.pkcs7),
          asBytes: true });

    var hmac = Crypto.HMAC(Crypto.SHA1,
                           ciphertext,
                           stretchedPassphrase,
                           { asBytes: true });

    // Note that the reason the "output" object doesn't follow style
    // guide naming conventions is because the objects are used in the
    // JSON ONC output, and we want the naming to be consistent with
    // the rest of the ONC output.
    var output = {
      'Cipher': 'AES256',
      'Ciphertext': Crypto.util.bytesToBase64(ciphertext),
      'HMAC': Crypto.util.bytesToBase64(hmac),
      'HMACMethod': 'SHA1',
      'IV': Crypto.util.bytesToBase64(iv),
      'Iterations': iterations,
      'Salt': Crypto.util.bytesToBase64(salt),
      'Stretch': 'PBKDF2',
      'Type': 'EncryptedConfiguration',
    };

    return output;
  } catch(e) {
    console.error(e);
  }
  return "";
};

/**
 * Actually does the config decryption and parsing.  Uses same
 * decryption parameters as encryption code.
 * @param {String} passphrase  Passphrase for decrypting config.
 * @param {String} cyphertext  Encrypted ONC file contents.
 * @returns {Object} Configuration blob.
 */
onc.decryptConfig = function(passphrase, encryptedConfig) {
  var salt = Crypto.util.base64ToBytes(encryptedConfig.Salt);
  var iv = Crypto.util.base64ToBytes(encryptedConfig.IV);
  var hmac = Crypto.util.base64ToBytes(encryptedConfig.HMAC)
  var ciphertext = Crypto.util.base64ToBytes(encryptedConfig.Ciphertext);
  var stretchedPassphrase = Crypto.PBKDF2(
      passphrase,
      salt,
      32,
      { iterations: encryptedConfig.Iterations,
        hasher: Crypto.SHA1,
        asBytes:true });
  var calculatedHMAC = Crypto.HMAC(Crypto.SHA1,
                                   ciphertext,
                                   stretchedPassphrase,
                                   { asBytes: true });
  var hmacPassed = false;
  if (calculatedHMAC && calculatedHMAC.length == hmac.length) {
    hmacPassed = true;
    for (var i = 0; i < calculatedHMAC.length; i++) {
      if (calculatedHMAC[i] != hmac[i]) {
        hmacPassed = false;
      }
    }
  }

  var plaintext = Crypto.AES.decrypt(
      ciphertext,
      stretchedPassphrase,
      { iv: iv,
        mode: new Crypto.mode.CBC(Crypto.pad.pkcs7),
        asString: true });

  // Defer testing hmac until here to avoid leaking timing info.
  // Probably futile in Javascript, but still...
  if (!plaintext || hmacPassed != true) {
    throw chrome.i18n.getMessage('errorUnableToDecrypt');
  }

  return JSON.parse(plaintext);
};

/**
 * Validate the given certificate ONC data.
 * @param {String} index  index into Certificates array in ONC.
 * @param {Object} oncData  ONC data
 * @param {Object} result  Validation results data that will be update.
 */
onc.validateCertificate = function(index, oncData, result) {
  if (!result)
    result = { 'errors': [], 'warnings': [], 'hasOpaqueEntity': false };
  var certificate = oncData.Certificates[index];
  if (!('GUID' in certificate)) {
    result.errors.push(['errorCertificateMissingGUID']);
    return result;
  }
  if ('Remove' in certificate) {
    // Certificate marked for removal.  Ignore the rest.
    return result;
  }
  if (!('Type' in certificate)) {
    result.errors.push(['errorLoadRequiredObjectMissing', 'Type']);
    return result;
  }
  if ('X509' in certificate) {
    var der = Base64.unarmor(certificate.X509);
    var asn1Data = asn1.parseAsn1(der);
    if (!asn1Data) {
      result.errors.push(['errorX509CertificateIsInvalid', certificate.GUID]);
      return result;
    }
    var cert = asn1.interpretCert(asn1Data);
    if (!asn1Data) {
      result.errors.push(['errorX509CertificateIsInvalid', certificate.GUID]);
    }
  } else if ('PKCS12' in certificate) {
    // TODO: support or deprecate PKCS12.
    result.errors.push(['errorPKCS12CertificatesNotYetSupported',
                        certificate.GUID]);
    result.hasOpaqueEntity = true;
  } else {
    result.errors.push(['errorCertificateMissingPayloadField',
                        certificate.GUID]);
    result.hasOpaqueEntity = true;
  }
  return result;
};

/**
 * Validate the ProxyLocation object field.
 * @param {Object} oncManualProxy  ManualProxySettings ONC object
 * @param {String} name  Name optionally associated with ProxyLocation.
 * @param {Object} result  Validation results
 * @returns {Object}  Results object
 */
onc.validateProxyLocation = function(oncManualProxy, name, result) {
  if (!(name in oncManualProxy))
    return;
  var proxyLocation = oncManualProxy[name];
  var path = 'ProxySettings.Manual.' + name;
  if (!('Host' in proxyLocation))
    result.errors.push(['errorLoadRequiredObjectMissing', path + '.Host']);
  if (!('Port' in proxyLocation)) {
    result.errors.push(['errorLoadRequiredObjectMissing', path + '.Port']);
  } else {
    if (typeof(proxyLocation.Port) != 'number')
      result.errors.push(['errorExpectedInt', path + '.Port']);
    if (proxyLocation.Host == '') {
      result.errors.push(['errorEmptyProxyHost'])
    }
  }
};

/**
 * Validate the ProxySettings ONC object.
 * @param {Object} oncProxy  ProxySettings ONC object.
 * @param {Object} result  Validation results.
 * @returns {Object}  Results object
 */
onc.validateProxySettings = function(oncProxy, result) {
  if (!('Type' in oncProxy)) {
    result.errors.push(['errorLoadRequiredObjectMissing',
			'ProxySettings.Type']);
  }
  if (oncProxy.Type == 'Direct' || oncProxy.Type == 'WPAD') {
    // No expectations for these.
  } else if (oncProxy.Type == 'Manual') {
    if (!('Manual' in oncProxy)) {
      result.errors.push(['errorLoadRequiredObjectMissing',
			  'ProxySettings.Manual']);
      return result;
    }
    onc.validateProxyLocation(oncProxy.Manual, 'HTTPProxy', result);
    onc.validateProxyLocation(oncProxy.Manual, 'SecureHTTPProxy', result);
    onc.validateProxyLocation(oncProxy.Manual, 'FTPProxy', result);
    onc.validateProxyLocation(oncProxy.Manual, 'SOCKS', result);
  } else if (oncProxy.Type == 'PAC') {
    // A PAC name must be present in the object.  It also must be
    // non-empty.  An empty PAC likely was meaning to convey using
    // WPAD, but we expect a separate 'WPAD' type for that.
    if (!('PAC' in oncProxy))
      result.errors.push(['errorLoadRequiredObjectMissing',
                          'ProxySettings.PAC']);
    else if (oncProxy.PAC == '')
      result.errors.push(['errorEmptyProxyURL']);
  } else {
    result.errors.push(['errorLoadUnknownProxyType', oncProxy.Type]);
  }
};

/**
 * Validate the given NetworkConfiguration ONC object.
 * @param {Integer} index  Index into NetworkConfigurations.
 * @param {Object} oncData  Complete ONC
 * @param {Object} result  Incoming results of validation, updated.
 * @returns {Object}  Results object
 */
onc.validateNetwork = function(index, oncData, result) {
  var netConfig = oncData.NetworkConfigurations[index];
  if (!result)
    result = { 'errors': [], 'warnings': [], 'hasOpaqueEntity': false };
  if (!('GUID' in netConfig)) {
    result.errors.push(['errorLoadRequiredObjectMissing', 'GUID']);
    return result;
  }
  if ('Remove' in netConfig) {
    // Network marked for removal.  Ignore the rest.
    return result;
  }
  if (!('Type' in netConfig)) {
    result.errors.push(['errorLoadRequiredObjectMissing', 'Type']);
    return result;
  }
  if (!('Name' in netConfig) || netConfig.Name == '') {
    result.errors.push(['errorMissingNetworkName', netConfig.Type]);
    return result;
  }
  if ('ProxySettings' in netConfig) {
    onc.validateProxySettings(netConfig.ProxySettings, result);
  }
  if (netConfig.Type == 'WiFi') {
    onc.validateWiFiNetwork(index, oncData, result);
  } else if (netConfig.Type == 'VPN') {
    onc.validateVpnNetwork(index, oncData, result);
  } else {
    result.warnings.push(['errorLoadUnknownNetworkConfigType',
                          netConfig.Type]);
    result.hasOpaqueEntity = true;
  }
  return result;
};

/**
 * Validate a WiFi NetworkConfiguration ONC object.
 * @param {Integer} index  Index into NetworkConfiguration ONC object.
 * @param {Object} oncData  ONC configuration
 * @param {Object} result  Result object indicating errors and warnings.
 * @returns {Object}  Result of validation.
 */
onc.validateWiFiNetwork = function(index, oncData, result) {
  var netConfig = oncData.NetworkConfigurations[index];
  if (!('WiFi' in netConfig)) {
    result.errors.push(['errorLoadRequiredObjectMissing', 'WiFi']);
    return result;
  }
  var wifiConfig = netConfig.WiFi;
  if (!('SSID' in wifiConfig) || wifiConfig.SSID == '') {
    result.errors.push(['errorWiFiNetworkMissingSSID', 'SSID']);
    return result;
  }
  if (!('Security' in wifiConfig)) {
    result.errors.push(['errorLoadRequiredObjectMissing', 'Security']);
    return result;
  }
  switch (wifiConfig.Security) {
  case 'None':
    break;
  case 'WEP-PSK':
    result.warnings.push(['warningWEPInherentlyUnsafe', netConfig.Name]);
    if ('Passphrase' in netConfig.WiFi) {
      // 5/13/16/29 characters are needed for 64/128/152/256-bit WEP ascii keys
      // 10/26/32/58 characters are needed for 64/128/152/256-bit WEP hex keys
      // Note that the actual bits supplied here are only
      // 40/104/128/232 bits, respectively, but WEP adds some
      // randomness to make up the rest of the bits.
      var hexLengths = [10, 26, 32, 58];
      var passphrase = netConfig.WiFi.Passphrase;
      if (passphrase.substr(0, 2) != '0x' ||
          hexLengths.indexOf(passphrase.length - 2) == -1)
        result.errors.push(['errorWEPKeyInvalidLength',
                            netConfig.Name]);
    } else {
      result.error.push(['errorPassphraseMissing',
                         netConfig.Name]);
    }
    break;
  case 'WPA-PSK':
    if ('Passphrase' in netConfig.WiFi) {
      if (netConfig.WiFi.Passphrase.length < 8) {
        result.warnings.push(['warningShortWPAPassphraseUnsafe',
                              netConfig.WiFi.Security,
                              netConfig.Name,
                              netConfig.WiFi.Passphrase.length]);
      }
    } else {
      result.errors.push(['errorPassphraseMissing',
                          netConfig.Name]);
    }
    break;
  case 'WPA-EAP':
    if (!('EAP' in netConfig.WiFi)) {
      result.errors.push(['errorLoadRequiredObjectMissing', 'EAP']);
      break;
    }
    var eapConfig = netConfig.WiFi.EAP;
    if (wiFiDialog.wifiRequiresServerCertificate()) {
      if ('ServerCARef' in eapConfig &&
          onc.findCert(eapConfig.ServerCARef, oncData) < 0) {
        result.errors.push(['errorBadCertReference',
                            netConfig.Name, 'ServerCARef',
                            eapConfig.ServerCARef]);
      }
    }
    if (wiFiDialog.wifiRequiresClientCertficate()) {
      onc.validateClientCert(eapConfig, index, oncData, result);
    }
    if (wiFiDialog.wifiRequiresPassword()) {
      if (!('Password' in eapConfig))
        result.warnings.push(['warningEAPPasswordEmpty',
                              netConfig.Name]);
    }
    if (!('Outer' in eapConfig)) {
      result.errors.push(['errorLoadRequiredObjectMissing',
                          'WiFi.EAP.Outer']);
      return result;
    }
    switch (eapConfig.Outer) {
    case 'PEAP':
    case 'EAP-TTLS':
    case 'EAP-TLS':
    case 'LEAP':
      break;
    default:
      result.errors.push(['errorLoadUnhandledEapType',
                          eapConfig.Outer, netConfig.Name]);
      return result;
    }
    if (!('Identity' in eapConfig) || eapConfig.Identity == '') {
      result.warnings.push(['warningIdentityMissing', netConfig.Name]);
    }
    break;
  default:
    result.errors.push(['errorLoadUnhandledSecurityType',
                        wifiConfig.Security, netConfig.Name]);
  }
  return result;
};

/**
 * Validate a VPN NetworkConfiguration ONC object's user credentials.
 * @param (Object) container  ONC container for user credentials.
 * @param {Integer} index  Index into NetworkConfiguration ONC object.
 * @param {Object} oncData  ONC configuration
 * @param {Object} result  Result object indicating errors and warnings.
 * @returns {Object}  Result of validation.
 */
onc.validateVpnUserCredentials = function(container, index,
                                          oncData, result) {
  var netConfig = oncData.NetworkConfigurations[index];
  if (!('Username' in container) || container.Username == '') {
    result.warnings.push(['warningIdentityMissing', netConfig.Name]);
  }
  if (!('Password' in container) || container.Password == '') {
    result.warnings.push(['warningPasswordMissing', netConfig.Name]);
  }
};

/**
 * Validate a VPN NetworkConfiguration ONC object's certificates.
 * @param (Object) container  ONC container for certificates.
 * @param {Integer} index  Index into NetworkConfiguration ONC object.
 * @param {Object} oncData  ONC configuration
 * @param {Object} result  Result object indicating errors and warnings.
 * @returns {Object}  Result of validation.
 */
onc.validateVpnCerts = function(container, index, oncData, result) {
  var netConfig = oncData.NetworkConfigurations[index];
  if (!('ServerCARef' in container))
    result.errors.push(['errorMissingVPNServerCA', netConfig.Name]);
  else if (onc.findCert(container.ServerCARef, oncData) < 0) {
    result.errors.push(['errorBadCertReference',
                        netConfig.Name, 'ServerCARef',
                        container.ServerCARef]);
  }
  onc.validateClientCert(container, index, oncData, result);
};
 /**
 * Validate a VPN NetworkConfiguration ONC object.
 * @param {Integer} index  Index into NetworkConfiguration ONC object.
 * @param {Object} oncData  ONC configuration
 * @param {Object} result  Result object indicating errors and warnings.
 * @returns {Object}  Result of validation.
 */
onc.validateVpnNetwork = function(index, oncData, result) {
  var netConfig = oncData.NetworkConfigurations[index];
  if (!('VPN' in netConfig)) {
    result.errors.push(['errorLoadRequiredObjectMissing', 'VPN']);
    return result;
  }
  var vpnConfig = netConfig.VPN;
  if (!('Type' in vpnConfig)) {
    result.errors.push(['errorLoadRequiredObjectMissing', 'VPN.Type']);
  }
  if (!('Host' in vpnConfig) || vpnConfig.Host == '') {
    result.errors.push(['errorLoadRequiredObjectMissing', 'VPN.Host']);
  }
  if (vpnConfig.Type == 'L2TP-IPsec') {
    if (!('L2TP' in vpnConfig)) {
      result.errors.push(['errorLoadRequiredObjectMissing',
                          'VPN.L2TP']);
      return result;
    }
    onc.validateVpnUserCredentials(vpnConfig.L2TP, index,
                                   oncData, result)
    if (!('IPsec' in vpnConfig)) {
      result.errors.push(['errorLoadRequiredObjectMissing',
                          'VPN.IPsec']);
      return result;
    }
    var ipsecConfig = vpnConfig.IPsec;
    if (!('IKEVersion' in ipsecConfig)) {
      result.errors.push(['errorLoadRequiredObjectMissing',
                          'VPN.IPsec.IKEVersion']);
      return result;
    }
    if (!('AuthenticationType' in ipsecConfig)) {
      result.errors.push(['errorLoadRequiredObjectMissing',
                          'VPN.IPsec.AuthenticationType']);
      return result;
    }
    if (ipsecConfig.AuthenticationType != 'PSK' &&
        ipsecConfig.AuthenticationType != 'Cert') {
      result.errors.push(['errorUnsupportedValue',
                          'VPN.IPsec.AuthenticationType',
                          ipsecConfig.AuthenticationType]);
    }
    if (ipsecConfig.AuthenticationType == 'PSK') {
      if (!('PSK' in ipsecConfig))
        result.warnings.push(['warningPreSharedKeyMissing', netConfig.Name]);
    } else {
      onc.validateVpnCerts(ipsecConfig, index, oncData, result);
    }
  } else if (vpnConfig.Type == 'OpenVPN') {
    onc.validateVpnUserCredentials(vpnConfig.OpenVPN, index,
                                   oncData, result)
    onc.validateVpnCerts(vpnConfig.OpenVPN, index, oncData, result);
  } else {
    result.warnings.push(['errorUnsupportedVPNType', netConfig.Name,
                          vpnConfig.Type]);
    result.hasOpaqueEntity = true;
    return result;
  }
  return result;
};

