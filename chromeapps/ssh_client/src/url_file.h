// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef URL_FILE_H
#define URL_FILE_H

#include <set>

#include "ppapi/utility/completion_callback_factory.h"
#include "ppapi/cpp/url_loader.h"

#include "file_interfaces.h"
#include "pthread_helpers.h"
#include "pepper_file.h"

class UrlFileHandler : public PathHandler {
 public:
  explicit UrlFileHandler(const char* url);
  virtual ~UrlFileHandler();

  virtual void addref();
  virtual void release();

  virtual FileStream* open(int fd, const char* pathname, int oflag);
  virtual int stat(const char* pathname, nacl_abi_stat* out);

  // The bare minimum necessary for opening a directory to give
  // something that fstats correctly. Needed for glibc to load locales
  // right.
  void AddDirectory(const char* pathname);

 private:
  int ref_;
  std::string url_;
  std::set<std::string> directories_;

  DISALLOW_COPY_AND_ASSIGN(UrlFileHandler);
};

class UrlFile : public FileRefStream {
 public:
  UrlFile(int fd, int oflag, const std::string& base_url);
  virtual ~UrlFile();

 protected:
  virtual void GetFileRef(const char* pathname, int32_t* pres);
  virtual void CleanupOnMainThread();

 private:
  void OnUrlOpen(int32_t result, int32_t* pres);
  void OnUrlFinished(int32_t result, int32_t* pres);

  pp::CompletionCallbackFactory<UrlFile, ThreadSafeRefCount> factory_;
  std::string base_url_;
  pp::URLLoader *loader_;

  DISALLOW_COPY_AND_ASSIGN(UrlFile);
};

#endif  // URL_FILE_H
