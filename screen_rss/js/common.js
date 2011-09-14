// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Common constants
var MAX_LAUNCH_DELAY_M = 4 * 60 + 1;  // Where 241 actually means never.

var CACHE_REFRESH_FOR_NEWEST_MODE_MS = 30 * 1000;  // 30s
var ENTRIES_NUMBER_FOR_NEWEST_MODE = 7;

var CACHE_REFRESH_FOR_COMPREHENSIVE_MODE_MS = 30 * 60 * 1000;  // 30s
var ENTRIES_NUMBER_FOR_COMPREHENSIVE_MODE = 100;

var IDLE_API_INTERVAL_MS = 5 * 1000;  // For this long we assume idle API,
                                      // can return false idle after
                                      // closing screensaver window.

// Common functions
function $(element) {
  return document.getElementById(element);
}

function silderValueToMinutes(sliderValue) {
  return Math.floor(Math.pow(MAX_LAUNCH_DELAY_M, sliderValue));
}

function addOneEventListener(element, event, callback) {
  var oneExecution = function() {
    element.removeEventListener(event, oneExecution);
    callback();
  }
  element.addEventListener(event, oneExecution);
}

function addClass(element, cssClass) {
  if (element.classList.contains(cssClass)) {
    return false;
  } else {
    element.classList.add(cssClass);
    return true;
  }
}

function removeClass(element, cssClass) {
  if (element.classList.contains(cssClass)) {
    element.classList.remove(cssClass);
    return true;
  } else {
    return false;
  }
}

function str(localeStringName) {
  return chrome.i18n.getMessage(localeStringName);
}

function getUrlSearchParams(url) {
  var params = {};

  if (url) {
    var search = url.split('?')[1] || "";
    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; ++i) {
      var pair =  pairs[i].split('=');
      if (pair.length == 2) {
        params[pair[0]] = decodeURIComponent(pair[1]);
      } else {
        params[pair] = true;
      }
    }
  }

  return params;
}
