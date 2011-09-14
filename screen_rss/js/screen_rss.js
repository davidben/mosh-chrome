// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function shouldExecuteNow(functionScope) {
  if (functionScope.executing) {
    functionScope.executionsRemaining++;
    if (functionScope.executionsRemaining > 4)
      functionScope.executionsRemaining = 4;
    return false;
  } else {
    if (!functionScope.executionsRemaining)
      functionScope.executionsRemaining = 1;
    functionScope.executing = true;
    return true;
  }
}

function shouldExecuteAgain(functionScope) {
  functionScope.executionsRemaining--;
  functionScope.executing = false;
  return functionScope.executionsRemaining > 0;
}

/*
 * Both methods below returns true if any actual change was made.
 */

function ScreenRSS(options) {
  var self = this;
  this.options = options;
  this.butter = new Butter();
  setTimeout(function() {
    document.addEventListener('keydown', self.onKeyDown.bind(self));
    document.addEventListener('mousemove', self.onMouseMove.bind(self));
  }, 1000);
  window.addEventListener('online', self.onOnline.bind(self));
  window.addEventListener('offline', self.onOffline.bind(self));

  this.init();
}

ScreenRSS.prototype.loadFeeds = function(callback) {
  var self = this;
  chrome.extension.sendRequest({
    'method' : 'getFeed',
    'options' : this.options
  }, function(result) {
    if (result.error) {
      self.butter.showError(result.message, { 'timeout' : null });
    } else {
      self.feed = result;
      callback();
    }
  });
};

ScreenRSS.prototype.maybeShowIntro = function() {
  var self = this;
  function showUpdate() {
    var lastUpdated = new Date(self.feed.entries[0].publishedDate);
    self.butter.show(str('lastUpdated')
                      .replace('$1', lastUpdated.toLocaleDateString())
                      .replace('$2', lastUpdated.toLocaleTimeString()));
    self.lastUpdated = self.feed.entries[0].publishedDate;
  }

  if (!this.alreadyShowedIntro) {
    var introductoryMessage;
    if (self.feed.author) {
      introductoryMessage = str('introMessage')
          .replace('$1', self.feed.title)
          .replace('$2', self.feed.author);
    } else {
      introductoryMessage = str('introMessageNoAuthor')
          .replace('$1', self.feed.title);
    }
    self.butter.show(introductoryMessage);
    if (self.feed.entries.length > 0)
      setTimeout(showUpdate, 5000);
    this.alreadyShowedIntro = true;
  } else if (self.feed.entries.length > 0 &&
             self.feed.entries[0].publishedDate !=
             this.lastUpdated) {
    showUpdate();
  }
};

ScreenRSS.prototype.init = function() {
  var self = this;
  this.loadFeeds(function() {
    self.maybeShowIntro();
    if (self.feed.entries.length == 0) {
      self.butter.show(str('errorRssFeedEmpty'));
      self.reloadNow = true;
      setTimeout(self.maybeReload.bind(self), 5000);
      return;
    }
    self.entries = [];
    for (var i = 0; i < self.feed.entries.length; i++)
      self.entries[i] = self.feedTitleEntry(i);
    // Invariant: currentFeed always points to vaild feed.
    self.currentFeed = 0;
    // Ignore it at the beginning (don't make preview hard!).
    self.populateHeader();
    self.populateFeedsColumn();
    self.displayFeedContent(self.currentFeed);
    addClass($('screensaver'), 'visible');
    self.startSwapping();
  });
};

ScreenRSS.prototype.destroy = function(callback) {
  var self = this;
  if (this.startSwapping.handle)
    clearTimeout(this.startSwapping.handle);
  removeClass($('screensaver'), 'visible');
  setTimeout(function() {
    $('feeds-header').innerHTML = '';
    $('feeds-column').innerHTML = '';
    $('feeds-content').innerHTML = '';
    self.feed = null;
    self.entries = [];
    if (callback)
      callback();
  }, 500);
};

ScreenRSS.prototype.maybeReload = function() {
  var self = this;
  function reload() {
    self.destroy(function() {
      self.init();
    });
  }
  if (this.reloadNow) {
    this.reloadNow = false;
    reload();
    return true;
  }
  if (this.options.displayMode == 'newest') {
    if (this.currentFeed == this.entries.length - 1) {
      reload();
      return true;
    }
  } else { // comprehensive
    var now = new Date();
    if (!this.lastReloaded)
      this.lastReloaded = now.getTime();
    if (now.getTime() - this.lastReloaded > 60 * 60 * 1000) { // one hour
      this.lastReloaded = now.getTime();
      reload();
      return true;
    }
  }
  return false;
};

ScreenRSS.prototype.sendCloseRequest = function() {
  chrome.extension.sendRequest({
    'method' : 'closeScreensaver',
  });
};

ScreenRSS.prototype.onKeyDown = function(event) {
  switch (event.keyCode) {
    case 13: // enter => Close screen saver and open tab with current feed.
      if(typeof this.currentFeed != undefined) {
        chrome.extension.sendRequest({
          'method' : 'openTab',
          'url' : this.feed.entries[this.currentFeed].link
        });
      }
      // intentionally left out "break;"
    default:
      this.sendCloseRequest();
  }
};

ScreenRSS.prototype.onMouseMove = function(event) {
  this.sendCloseRequest();
};

ScreenRSS.prototype.onOnline = function(event) {
  this.butter.show(str('connectionEstablished'));
  this.reloadNow = true;
  this.advance();
};

ScreenRSS.prototype.onOffline = function(event) {
  this.butter.show(str('connectionProblems'));
  this.reloadNow = true;
  this.advance();
};


ScreenRSS.prototype.populateHeader = function() {
  var feedsHeader = $('feeds-header');
  if (this.currentFeed + 1 < this.entries.length) {
    var secondary = this.entries[this.currentFeed+1];
    addClass(secondary, 'secondary');
    feedsHeader.appendChild(secondary);
  }
  var primary = this.entries[this.currentFeed];
  primary.className = 'feed-title-large';
  feedsHeader.appendChild(primary);
};

ScreenRSS.prototype.populateFeedsColumn = function() {
  for (var i = this.currentFeed + 2; i < this.feed.entries.length; i++) {
    addClass(this.entries[i], 'hidden');
    $('feeds-column').appendChild(this.entries[i]);
  }
  this.updateFeedsColumnVisibility();
};

ScreenRSS.prototype.displayFeedContent = function(feedNumber) {
  if (feedNumber < 0 || feedNumber > this.feed.entries.length) {
    console.log("Invalid feed number.");
    return false;
  }
  var container = $('feeds-content');
  container.innerHTML = '';
  var center = document.createElement('center');
  center.innerHTML = this.feed.entries[feedNumber].content;
  container.appendChild(center);
};

ScreenRSS.prototype.feedTitleEntry = function(feedNumber) {
  if (!this.feed) {
    console.log("No feeds loaded? That should not happen!");
    return false;
  }
  var feedTitle = document.createElement("div");
  feedTitle.className = 'feed-title';
  var titleText = document.createElement('font');
  addClass(titleText, 'title');
  titleText.appendChild(document.createTextNode(
      this.feed.entries[feedNumber].title));
  feedTitle.appendChild(titleText);
  feedTitle.appendChild(document.createElement('br'));
  var descText = document.createElement('font');
  addClass(descText, 'desc');
  descText.appendChild(document.createTextNode(
      this.feed.entries[feedNumber].contentSnippet));
  feedTitle.appendChild(descText);
  return feedTitle;
};

ScreenRSS.prototype.updateFeedsColumnVisibility = function(hideAll,
    callback) {
  var columnEntries = $('feeds-column').
      getElementsByTagName('div');
  var lastChangedEntry;
  for (var i = 0; i < columnEntries.length; i++) {
    if (columnEntries[i].offsetTop + columnEntries[i].offsetHeight >
        window.innerHeight || hideAll) {
      if(addClass(columnEntries[i], 'hidden'))
        lastChangedEntry = columnEntries[i];
    } else {
      if(removeClass(columnEntries[i], 'hidden'))
        lastChangedEntry = columnEntries[i];
    }
  }
  if(callback) {
    if (lastChangedEntry) {
      // This event will only be tiggered once.
      addOneEventListener(lastChangedEntry, 'webkitTransitionEnd',
          function(event) {
        callback();
      });
    } else {
      callback();
    }
  }
};

ScreenRSS.prototype.updateMainFeed = function() {
  var self = this;
  var mainFeed = $('feeds-main');
  addClass(mainFeed, 'rotated');
  addOneEventListener(mainFeed, 'webkitTransitionEnd', function() {
    self.displayFeedContent(self.currentFeed);
    removeClass(mainFeed, 'rotated');
  });
};

ScreenRSS.prototype.advance = function() {
  if (this.maybeReload())
    return;
  if (this.entries.length < 2 || !shouldExecuteNow(this.advance))
    return;
  var self = this;

  function maybeAdvance() {
    if (shouldExecuteAgain(self.advance)) {
      setTimeout(function() {
        self.advance();
      }, 0);
    }
  }

  var previousMain = this.entries[this.currentFeed];
  this.currentFeed++;
  if (this.currentFeed == this.entries.length) {
    this.currentFeed = 0;
  }
  var newMain = this.entries[this.currentFeed];
  nextFeed = (this.currentFeed + 1) % this.entries.length;
  var newSecondary = this.entries[nextFeed];


  var header = $('feeds-header');
  var feedsColumn = $('feeds-column');

  // Swap main titles (and add old main to bottom of the column).
  newMain.className = 'feed-title-large';
  addClass(previousMain, 'fade-out');
  addOneEventListener(previousMain, 'webkitTransitionEnd', function() {
    header.removeChild(previousMain);
    previousMain.className = 'feed-title hidden';
    if (self.entries.length > 2) {
      feedsColumn.appendChild(previousMain);
      self.updateFeedsColumnVisibility();
    } else {
      header.appendChild(previousMain);
      setTimeout(function() {
        removeClass(previousMain, 'hidden');
      }, 0);
      maybeAdvance();
    }
  });

  this.updateMainFeed();

  if (self.entries.length > 2) {
    this.updateFeedsColumnVisibility(true, function() {
      if (self.entries.length > 2)
        feedsColumn.removeChild(newSecondary);
      addClass(newSecondary, 'hidden');
      addClass(newSecondary, 'secondary');
      header.appendChild(newSecondary);
      // I had to add this hack, because there's no way to say if the
      // appendChild operation was compled.
      setTimeout(function() {
        removeClass(newSecondary, 'hidden');
      }, 0);
      self.updateFeedsColumnVisibility();
      maybeAdvance();
    });
  }
};

ScreenRSS.prototype.retreat = function() {
  // TODO(sidor): Make it work.
  // Once this is working we can allow user to use arrow keys to switch feeds.
};

ScreenRSS.prototype.startSwapping = function() {
  var self = this;
  function setNext() {
    if (self.startSwapping.handle)
      clearTimeout(self.startSwapping.handle);
    self.startSwapping.handle =
        setTimeout(swapNow, self.options.articleRefresh*1000);
  }
  function swapNow() {
    self.advance();
    setNext();
  }
  setNext();
};
