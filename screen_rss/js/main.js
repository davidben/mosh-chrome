// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var screenRSS;

function init() {
  console.log("Google RSS feeds API loaded.");
  var optionsSource;
  if (getUrlSearchParams(window.location.href).preview)
    optionsSource = 'temporaryOptions';
  else
    optionsSource = 'permanentOptions';
  screenRSS = new ScreenRSS(JSON.parse(localStorage[optionsSource]));
}


document.addEventListener('DOMContentLoaded', init);
