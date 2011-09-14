// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function save() {
  localStorage['permanentOptions'] = JSON.stringify(getOptionsObject());
  chrome.extension.sendRequest({
    'method' : 'updateOptions',
  });
  $('optionsSavedMessage').className='saved-visible';
  setTimeout(function() {
    $('optionsSavedMessage').className='saved-hidden';
  }, 1500);
}

function preview() {
  localStorage['temporaryOptions'] = JSON.stringify(getOptionsObject());
  chrome.extension.sendRequest({
    'method' : 'openPreview',
  });
}

function str(localeStringName) {
  return chrome.i18n.getMessage(localeStringName);
}

function onSourceSelected(event) {
  $('googleNewsCategory').disabled = !$('sourceGoogleNews').checked;
  $('RssFeedUrl').disabled = !$('sourceCustom').checked;
}

function onLunchTimeAdjusted() {
  var value = $('lunch-time-range').value;
  var textUnderSlider = $('lunch-time-text');
  textUnderSlider.innerHTML = '';
  var functionValue = silderValueToMinutes(value);
  var timeUnderSlider = '';
  if (functionValue == 1) {
    timeUnderSlider = str('sliderOneMinute');
  } else if (functionValue < MAX_LAUNCH_DELAY_M) {
    var hours = Math.floor(functionValue / 60);
    var minutes = functionValue % 60;
    if (hours && minutes) {
      timeUnderSlider = str('sliderHoursAndMinutes').replace('$1', hours)
                                                    .replace('$2', minutes);
    } else if (hours) {
      timeUnderSlider = str('sliderHours').replace('$1', hours);
    } else {
      timeUnderSlider = str('sliderMinutes').replace('$1', minutes);
    }
  } else {
    timeUnderSlider = str('sliderNever');
  }
  textUnderSlider.appendChild(document.createTextNode(timeUnderSlider));
}

function getOptionsObject() {
  // options
  var rssSource;
  var lunchScreensaverAfter;
  var articleRefresh;
  var displayMode;

  if ($('sourceGoogleNews').checked) {
    var newsType =
        str($('googleNewsCategory').value).split(',');
    rssSource = urlGoogleNews[0] + newsType[0] + urlGoogleNews[1] +
        newsType[1] + urlGoogleNews[2];
  } else if ($('sourceExpl1').checked) {
    rssSource = urlExpl1;
  } else if ($('sourceExpl2').checked) {
    rssSource = urlExpl2;
  } else if ($('sourceCustom').checked) {
    rssSource = $('RssFeedUrl').value;
  }

  articleRefreshRadio = document.getElementsByName('articleRefresh');
  for (var i = 0; i < articleRefreshRadio.length; i++) {
    if (articleRefreshRadio[i].checked)
      articleRefresh = articleRefreshRadio[i].value;
  }

  displayModeRadio = document.getElementsByName('displayMode');
  for (var i = 0; i < displayModeRadio.length; i++) {
    if (displayModeRadio[i].checked)
      displayMode = displayModeRadio[i].value;
  }

  lunchScreensaverAfter = $('lunch-time-range').value;
  return {
    'articleRefresh' : articleRefresh,
    'displayMode' : displayMode,
    'lunchScreensaverAfter' : lunchScreensaverAfter,
    'rssSource' : rssSource
  };
}

function initializeValues() {
  var currentOptions = JSON.parse(localStorage['permanentOptions']);

  var googleNewsOptions = $('googleNewsCategory').options;
  var IsSourceGoogleNews = false;
  for (var i = 0; i < googleNewsOptions.length; i++) {
    var newsType = str(googleNewsOptions[i].value).split(',');
    if (currentOptions.rssSource == urlGoogleNews[0] + newsType[0] +
        urlGoogleNews[1] + newsType[1] + urlGoogleNews[2]) {
      $('sourceGoogleNews').checked = true;
      googleNewsOptions[i].selected = true;
      IsSourceGoogleNews = true;
    }
  }
  if (currentOptions.rssSource == urlExpl1) {
    $('sourceExpl1').checked = true;
  } else if (currentOptions.rssSource == urlExpl2) {
    $('sourceExpl2').checked = true;
  } else if (!IsSourceGoogleNews) {
    $('sourceCustom').checked = true;
    $('RssFeedUrl').value = currentOptions.rssSource;
  }
  onSourceSelected();

  $('lunch-time-range').value =
      currentOptions.lunchScreensaverAfter;
  onLunchTimeAdjusted();

  var articleRefreshRadio = document.getElementsByName('articleRefresh');
  for (var i = 0; i< articleRefreshRadio.length; i++) {
    if (articleRefreshRadio[i].value == currentOptions.articleRefresh)
      articleRefreshRadio[i].checked = true;
  }

  var displayModeRadio = document.getElementsByName('displayMode');
  for (var i = 0; i< displayModeRadio.length; i++) {
    if (displayModeRadio[i].value == currentOptions.displayMode)
      displayModeRadio[i].checked = true;
  }
}

function translateText() {
  var i18nNodes = document.querySelectorAll('[i18n]');
  for (var i = 0; i < i18nNodes.length; ++i) {
    var i18nId = i18nNodes[i].getAttribute('i18n');
    var translation = chrome.i18n.getMessage(i18nId);
    if (translation == '') {
      translation = 'NO TRANSLATION FOR: ' + i18nId;
    }
    i18nNodes[i].textContent = translation;
  }
};

function init() {
  $('sourceGoogleNews').addEventListener('change', onSourceSelected);
  $('sourceExpl1').addEventListener('change', onSourceSelected);
  $('sourceExpl2').addEventListener('change', onSourceSelected);
  $('sourceCustom').addEventListener('change', onSourceSelected);
  $('lunch-time-range').addEventListener('change', onLunchTimeAdjusted)
  $('save-button').addEventListener('click', save);
  $('preview-button').addEventListener('click', preview);
  $('cancel-button').addEventListener('click', function() {
    self.close();
  });
  translateText();
  initializeValues();
}

document.addEventListener('DOMContentLoaded', init);
