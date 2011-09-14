// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function CacheManager() {
  this.updateOptions();
}

CacheManager.prototype.updateOptions = function() {
  localStorage['cachedFeed'] = null;
  this.options = JSON.parse(localStorage['permanentOptions']);
  if (this.options.displayMode == 'newest') {
    this.refreshRateMS = CACHE_REFRESH_FOR_NEWEST_MODE_MS;
  } else {
    this.refreshRateMS = CACHE_REFRESH_FOR_COMPREHENSIVE_MODE_MS;
  }
  if (this.refresh.handle)
    window.clearInterval(this.refresh.handle);
  this.refresh();
  this.refresh.handle = window.setInterval(this.refresh.bind(this),
                                           this.refreshRateMS);
}

CacheManager.prototype.refresh = function() {
  if (window.navigator.onLine) {
    this.getFeedFromWeb(this.options, function(result) {
      if (!result.error)
        localStorage['cachedFeed'] = JSON.stringify(result);
    });
  }
}

CacheManager.prototype.ensureFeedsAPIloaded = function(callback) {
  var self = this;
  if (this.feedsAPIloaded) {
    callback();
  } else {
    google.load("feeds", "1", {
      'callback' : function() {
        console.log("Google RSS feeds API loaded.");
        self.feedsAPIloaded = true;
        callback();
      }
    });
  }
}

CacheManager.prototype.getFeedFromWeb = function(options, callback) {
  this.ensureFeedsAPIloaded(function() {
    var feed = new google.feeds.Feed(options.rssSource);
    if (options.displayMode == 'newest') {
      feed.setNumEntries(ENTRIES_NUMBER_FOR_NEWEST_MODE);
    } else {
      feed.setNumEntries(ENTRIES_NUMBER_FOR_COMPREHENSIVE_MODE);
      feed.includeHistoricalEntries();
    }
    feed.setResultFormat(google.feeds.Feed.JSON_FORMAT);
    feed.load(function(result) {
      if (!result.error) {
        callback(result.feed);
      } else {
        callback({
          error : 'cannot_load_feeds',
          message : chrome.i18n.getMessage('errorCannotLoadFeeds')
        });
      }
    });
  });
}


CacheManager.prototype.getFeed = function(options, callback) {
  var self = this;
  if (!options) {
    console.log("Invalid options object");
    return;
  }
  if (window.navigator.onLine) {
    self.getFeedFromWeb(options, function(result) {
      callback(result);
    });
  } else {
    // If cache exists and options haven't changed.
    var cachedFeed = localStorage['cachedFeed'];
    if (cachedFeed && JSON.stringify(this.options) ==
        JSON.stringify(options)) {
      callback(JSON.parse(cachedFeed));
    } else {
      callback({
        error : 'offline_no_cache',
        message : chrome.i18n.getMessage('errorNoInternetConnection')
      });
    }
  }
}
