// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/* This code is mostly copy pasted from file_manager. */
function Butter() {
}

Butter.prototype.show = function(message, opt_options) {
  var butter = document.createElement('div');
  butter.className = 'butter-bar';
  butter.style.top = '-30px';
  document.body.appendChild(butter);

  var self = this;

  setTimeout(function () {
    if (self.currentButter_)
      self.hide();

    self.currentButter_ = butter;
    self.currentButter_.style.top = '15px';

    self.update(message, opt_options);
  });

  return butter;
};

Butter.prototype.showError = function(message, opt_options) {
  var butter = this.show(message, opt_options);
  butter.classList.add('butter-error');
  return butter;
};

Butter.prototype.update = function(message, opt_options) {
  if (!opt_options)
    opt_options = {};

  var timeout;
  if ('timeout' in opt_options) {
    timeout = opt_options.timeout;
  } else {
    timeout = 5 * 1000;
  }

  if (this.butterTimer_)
    clearTimeout(this.butterTimer_);

  if (timeout) {
    var self = this;
    this.butterTimer_ = setTimeout(function() {
        self.hide();
        self.butterTimer_ == null;
    }, timeout);
  }

  var butter = this.currentButter_;
  butter.textContent = message;

  if ('actions' in opt_options) {
    for (var label in opt_options.actions) {
      var link = document.createElement('a');
      link.textContent = label;
      link.setAttribute('href', 'javascript://' + label);
      link.addEventListener('click', function () {
          opt_options.actions[label]();
          return false;
      });
      butter.appendChild(link);
    }
  }

  butter.style.left = ((document.body.clientWidth -
                        butter.clientWidth) / 2) + 'px';
};

Butter.prototype.hide = function() {
  if (this.currentButter_) {
    this.currentButter_.style.top = '50px';
    this.currentButter_.style.opacity = '0';

    var butter = this.currentButter_;
    setTimeout(function() {
        butter.parentNode.removeChild(butter);
    }, 1000);

    this.currentButter_ = null;
  }
};
