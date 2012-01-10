// Copyright (c) 2011 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Provides basic ability to read ASN.1 format into a
 * JSON object.
 */

const ASN1_SEQUENCE = 0x30;
const ASN1_SET = 0x31;
const ASN1_OBJECT_ID = 0x6;
const ASN1_PRINTABLE = 0x13;

/**
 * Namespace for ASN.1 functions.
 */
var asn1 = {};

/**
 * Parse object id out of byte ASN.1 byte stream.
 *
 * @param {String} bytes  Byte stream of ASN.1
 * @param {Number} offset  Offset within bytes where object ID begins.
 * @param {Number} len  Length of object ID.
 * @return {String}  Human readable object ID with dots.
 */
asn1.parseObjectId = function(bytes, offset, len) {
  var oid = '';
  var accumulated = 0;
  for (var i = 0; i < len; ++i) {
    var byte = bytes[offset + i];
    accumulated <<= 7;
    accumulated |= (byte & ~0x80);
    if (!(byte & 0x80)) {
      if (oid == '') {
        oid = Math.floor(accumulated / 40) + '.' + (accumulated % 40);
      } else {
        oid = oid + '.' + accumulated;
      }
      accumulated = 0;
    }
  }
  return oid;
};

/**
 * Parse entire ASN.1 byte stream.
 *
 * @param {String} bytes  Byte stream of ASN.1
 * @return {Object}  Parsed JSON representation of ASN.1
 */
asn1.parseAsn1 = function(bytes) {
  if (typeof(bytes) == 'string') {
    bytes = bytes.split('').map(function(c) { return c.charCodeAt(0) });
  }
  var offset = 0;
  var result = [];
  while (offset < bytes.length) {
    var kind = bytes[offset];
    var len = bytes[offset+1];
    var prefix_length = 2;
    if (len & 0x80) {
      len &= ~0x80;
      prefix_length += len;
      if (len == 1)
        len = bytes[offset+2];
      else if (len == 2)
        len = (bytes[offset+2] << 8) | bytes[offset+3];
      else
        return false;
    }
    var inner_result;
    switch(kind) {
      case ASN1_SEQUENCE:
      case ASN1_SET:
        inner_result = asn1.parseAsn1(bytes.slice(offset + prefix_length,
                                                  offset + prefix_length + len))
        if (typeof(inner_result) == 'boolean' && inner_result == false)
          return false;
        result.push(inner_result);
        break;
      case ASN1_OBJECT_ID:
        inner_result = asn1.parseObjectId(bytes, offset + prefix_length, len);
        if (typeof(inner_result) == 'boolean' && inner_result == false)
          return false;
        result.push({'object_id': inner_result});
        break;
      case ASN1_PRINTABLE:
        var string = '';
        for (var i = 0; i < len; ++i) {
          string += String.fromCharCode(bytes[offset + prefix_length + i]);
        }
        result.push(string);
        break;
    }
    offset += prefix_length + len;
  }
  return result;
};

/**
 * Convert OID to a mnemonic identifier if possible.
 *
 * @param {String} oid  Human readable form of object id.
 * @returns {String}  Mnemonic identifier or original dot form if not known.
 */
asn1.convertOID = function(oid) {
  if (!oid.object_id) return false;
  switch(oid.object_id) {
    case '2.5.4.3': return 'commonName';
    case '2.5.4.5': return 'serialNumber';
    case '2.5.4.6': return 'countryName';
    case '2.5.4.7': return 'localityName';
    case '2.5.4.8': return 'stateOrProvidenceName';
    case '2.5.4.10': return 'organizationName';
    case '2.5.4.11': return 'organizationalUnit';
    default: return oid;
  }
};

/**
 * Interpret given ASN.1 JSON object as an X.520 name.
 *
 * @param {Object} name  JSON ASN.1 that should be a X.520 name.
 * @returns {Object}  Dictionary of name attributes (like commonName) to values.
 */
asn1.interpretName = function(name) {
  // See structure below.
  if (!(name instanceof Array))
    return false;
  var result = {};
  for (i = 0; i < name.length; ++i) {
    if (!(name[i] instanceof Array)) {
      continue;
    }
    if (!(name[i][0] instanceof Array)) {
      continue;
    }
    var pair = name[i][0];
    result[asn1.convertOID(pair[0])] = pair[1];
  }
  return result;
};

/**
 * Interpret a given ASN.1 JSON object as an X.509 certificate.
 *
 * @param {Object} asn1  JSON ASN.1 that should be a X.509 certificate.
 * @returns {Object}  A dictionary including issuer and subject name
 * information.
 */
asn1.interpretCert = function(asn1Data) {
  // See RFC5280.  Expect asn of format somewhat like:
  // struct Certificate {
  //   struct TbsCertificate {
  //     int version;
  //     int serialNumber;
  //     OID algorithm;
  //     struct Name {
  //       struct RNSequence {
  //         struct AttributeTypeAndValue {
  //           OID attribute;
  //           string value;
  //         } attributesAndValues[];
  //       } rnSequence;
  //     } issuer;
  //     struct Validity {
  //       UTCTime;
  //       GeneralizedTime;
  //     };
  //     struct Name subject;
  //     ...
  //   } tbsCertificate;
  //   ...
  // }
  // We are interested in the issuer and subject attributes and values.
  //
  if (!(asn1Data instanceof Array) ||
      !(asn1Data[0] instanceof Array) ||
      !(asn1Data[0][0] instanceof Array)) {
    return false;
  }
  var tbsCertificate = asn1Data[0][0];
  var result;
  // Find issuer - currently always at the same offset since
  // we ignore integer types currently. 0 is signing algorithm,
  // 1 is issuer, 2 is timestamps, 3 is subject.
  if (tbsCertificate.length < 5)
    return false;
  return {
    'issuer': asn1.interpretName(tbsCertificate[1]),
    'subject': asn1.interpretName(tbsCertificate[3])
  };
};
