// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

urlGoogleNews = ['http://news.google.com/news?ned=', '&topic=', '&output=rss'];
var infixes = chrome.i18n.getMessage('googleNewsInfixesTop').split(',');

urlGoogleTopNews = urlGoogleNews[0] + infixes[0] + urlGoogleNews[1] +
    infixes[1] + urlGoogleNews[2];
urlExpl1 = chrome.i18n.getMessage('rssSourceExample1URL');
urlExpl2 = chrome.i18n.getMessage('rssSourceExample2URL');
