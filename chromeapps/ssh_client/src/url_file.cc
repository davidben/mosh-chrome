// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "url_file.h"

#include <assert.h>

#include "ppapi/c/pp_errors.h"
#include "ppapi/cpp/url_request_info.h"
#include "ppapi/cpp/url_response_info.h"

#include "file_system.h"

class UrlDirectory : public FileStream {
 public:
  UrlDirectory() : ref_(1) { }
  virtual ~UrlDirectory() { }

  virtual void addref() { ++ref_; }
  virtual void release() {
    if (!--ref_)
      delete this;
  }
  virtual FileStream* dup(int fd) {
    assert(0);
    return NULL;
  }

  virtual void close() { }
  virtual int read(char* buf, size_t count, size_t* nread) { return ENOSYS; }
  virtual int write(const char* buf, size_t count, size_t* nwrote) {
    return EPERM;
  }

  virtual int fstat(nacl_abi_stat* out) {
    memset(out, 0, sizeof(nacl_abi_stat));
    out->nacl_abi_st_mode = S_IFDIR;
    return 0;
  }

  virtual int getdents(dirent* buf, size_t count, size_t* nread) {
    return ENOSYS;
  }

 private:
  int ref_;
};

//------------------------------------------------------------------------------

UrlFileHandler::UrlFileHandler(const char* url)
  : ref_(1), url_(url) {
}

UrlFileHandler::~UrlFileHandler() {
  assert(!ref_);
}

void UrlFileHandler::addref() {
  ++ref_;
}

void UrlFileHandler::release() {
  if (!--ref_)
    delete this;
}

FileStream* UrlFileHandler::open(int fd, const char* pathname, int oflag) {
  if (directories_.find(pathname) != directories_.end()) {
    return new UrlDirectory();
  }

  UrlFile* file = new UrlFile(fd, oflag, url_);
  if (file->open(pathname)) {
    return file;
  } else {
    file->release();
    return NULL;
  }
}

int UrlFileHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

void UrlFileHandler::AddDirectory(const char* pathname) {
  directories_.insert(pathname);
}

//------------------------------------------------------------------------------

UrlFile::UrlFile(int fd, int oflag, const std::string& base_url)
  : FileRefStream(fd, oflag), factory_(this), base_url_(base_url),
    loader_(NULL) {
}

UrlFile::~UrlFile() {
}

void UrlFile::GetFileRef(const char* pathname, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  loader_ = new pp::URLLoader(sys->instance());

  pp::URLRequestInfo request(sys->instance());
  request.SetURL(base_url_ + pathname);
  request.SetMethod("GET");
  request.SetStreamToFile(true);

  int ret = loader_->Open(
      request, factory_.NewCallback(&UrlFile::OnUrlOpen, pres));
  assert(ret == PP_OK_COMPLETIONPENDING);
  (void)ret;
}

void UrlFile::OnUrlOpen(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  if (result == PP_OK) {
    const pp::URLResponseInfo& response = loader_->GetResponseInfo();
    LOG("status code = %d\n", response.GetStatusCode());
    if (response.GetStatusCode() != 200)
      result = PP_ERROR_FILENOTFOUND;
  }

  if (result == PP_OK) {
    int ret = loader_->FinishStreamingToFile(
        factory_.NewCallback(&UrlFile::OnUrlFinished, pres));
    assert(ret == PP_OK_COMPLETIONPENDING);
    (void)ret;
  } else {
    delete loader_;
    loader_ = NULL;
    *pres = result;
    sys->cond().broadcast();
  }
}

void UrlFile::OnUrlFinished(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  if (result == PP_OK) {
    GotFileRef(loader_->GetResponseInfo().GetBodyAsFileRef(), pres);
  } else {
    delete loader_;
    loader_ = NULL;
    *pres = result;
    sys->cond().broadcast();
  }
}

void UrlFile::CleanupOnMainThread() {
  delete loader_;
  loader_ = NULL;
}
