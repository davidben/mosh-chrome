// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Offline login implementation.
 */

function load() {
  var params = getUrlSearchParams(location.search);

  // Setup localized strings.
  var signInTitle = document.getElementById('sign-in-title');
  var emailLabel = document.getElementById('email-label');
  var passwordLabel = document.getElementById('password-label');
  var submitButton = document.getElementById('submit-button');
  var errorSpan = document.getElementById('errormsg-alert');

  signInTitle.textContent = decodeURIComponent(params['stringSignIn']);
  emailLabel.textContent = decodeURIComponent(params['stringEmail']);
  passwordLabel.textContent = decodeURIComponent(params['stringPassword']);
  submitButton.value = decodeURIComponent(params['stringSignIn']);
  errorSpan.textContent = decodeURIComponent(params['stringError']);

  // Setup actions.
  var form = document.getElementById('offline-login-form');
  form.addEventListener('submit', function(e) {
    var msg = {
      'method': 'offlineLogin',
      'email': form.email.value,
      'password': form.password.value
    };
    window.parent.postMessage(msg, 'chrome://oobe/');
    e.preventDefault();
  });

  var email = params['email'];
  if (email) {
    // Email is present, which means that unsuccessful login attempt has been
    // made. Try to mimic Gaia's behaviour.
    form.email.value = email;
    form.password.classList.add('form-error');
    form.password.focus();
  } else {
    form.email.focus();
  }
  window.parent.postMessage({'method': 'loginUILoaded'}, 'chrome://oobe/');
}

document.addEventListener('DOMContentLoaded', load);
