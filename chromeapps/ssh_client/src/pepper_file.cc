// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "pepper_file.h"

#include <assert.h>

#include "ppapi/c/pp_errors.h"
#include "ppapi/c/ppb_file_io.h"
#include "ppapi/cpp/file_ref.h"

#include "file_system.h"

const size_t FileRefStream::kBufSize;

PepperFileHandler::PepperFileHandler(pp::FileSystem* file_system)
    : ref_(1), file_system_(file_system) {
  assert(file_system);
}

PepperFileHandler::~PepperFileHandler() {
  assert(!ref_);
}

void PepperFileHandler::addref() {
  ++ref_;
}

void PepperFileHandler::release() {
  if (!--ref_)
    delete this;
}

FileStream* PepperFileHandler::open(int fd, const char* pathname, int oflag) {
  PepperFile* file = new PepperFile(fd, oflag, file_system_);
  if (file->open(pathname)) {
    return file;
  } else {
    file->release();
    return NULL;
  }
}

int PepperFileHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

//------------------------------------------------------------------------------

FileRefStream::FileRefStream(int fd, int oflag)
  : ref_(1), fd_(fd), oflag_(oflag), factory_(this),
    file_io_(NULL), offset_(0), file_info_(), write_sent_(false) {
}

FileRefStream::~FileRefStream() {
  assert(!ref_);
}

void FileRefStream::addref() {
  ++ref_;
}

void FileRefStream::release() {
  if (!--ref_)
    delete this;
}

FileStream* FileRefStream::dup(int fd) {
  assert(0);
  return NULL;
}

bool FileRefStream::open(const char* pathname) {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&FileRefStream::Open, pathname, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while(result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  return result == PP_OK;
}

void FileRefStream::close() {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&FileRefStream::Close, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while(result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
}

int FileRefStream::read(char* buf, size_t count, size_t* nread) {
  if (!is_open())
    return EIO;

  FileSystem* sys = FileSystem::GetFileSystem();
  if (is_block() && in_buf_.empty()) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&FileRefStream::Read, count, &result));
    while(result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
    if (result < 0) {
      *nread = -1;
      return EIO;
    }
  }

  *nread = 0;
  while (*nread < count) {
    if (in_buf_.empty())
      break;

    buf[(*nread)++] = in_buf_.front();
    offset_++;
    in_buf_.pop_front();
  }

  return 0;
}

int FileRefStream::write(const char* buf, size_t count, size_t* nwrote) {
  if (!is_open())
    return EIO;

  out_buf_.insert(out_buf_.end(), buf, buf + count);
  if (is_block()) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&FileRefStream::Write, &result));
    FileSystem* sys = FileSystem::GetFileSystem();
    while(result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
    if ((size_t)result != count) {
      *nwrote = -1;
      return EIO;
    } else {
      *nwrote = count;
      return 0;
    }
  } else {
    if (!write_sent_) {
      write_sent_ = true;
      pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&FileRefStream::Write, (int32_t*)NULL));
    }
    *nwrote = count;
    return 0;
  }
}

int FileRefStream::seek(nacl_abi_off_t offset, int whence,
                        nacl_abi_off_t* new_offset) {
  switch (whence) {
    case SEEK_SET:
      offset_ = offset;
      if (new_offset)
        *new_offset = offset_;
      return 0;

    case SEEK_CUR:
      offset_ += offset;
      if (new_offset)
        *new_offset = offset_;
      return 0;

    case SEEK_END:
      offset_ = file_info_.size + offset;
      if (new_offset)
        *new_offset = offset_;
      return 0;

    default:
      if (new_offset)
        *new_offset = -1;
      return EINVAL;
  }
}

int FileRefStream::fstat(nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  out->nacl_abi_st_size = file_info_.size;
  return 0;
}

int FileRefStream::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    int oflag = va_arg(ap, long);
    if (is_block() && (oflag & O_NONBLOCK)) {
      pp::Module::Get()->core()->CallOnMainThread(0,
          factory_.NewCallback(&FileRefStream::Read,
                                       kBufSize, (int32_t*)NULL));
    }
    oflag_ = oflag;
    return 0;
  } else {
    return -1;
  }
}

bool FileRefStream::is_read_ready() {
  return !in_buf_.empty();
}

bool FileRefStream::is_write_ready() {
  return out_buf_.size() < kBufSize;
}

bool FileRefStream::is_exception() {
  return !is_open();
}

void FileRefStream::Open(int32_t result, const char* pathname, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  GetFileRef(pathname, pres);
}

void FileRefStream::GotFileRef(const pp::FileRef& file_ref,
                               int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  file_io_ = new pp::FileIO(sys->instance());
  int open_flags;
  if ((oflag_ & O_ACCMODE) == O_WRONLY)
    open_flags = PP_FILEOPENFLAG_WRITE;
  else if ((oflag_ & O_ACCMODE) == O_RDONLY)
    open_flags = PP_FILEOPENFLAG_READ;
  else
    open_flags = PP_FILEOPENFLAG_READ | PP_FILEOPENFLAG_WRITE;
  if (oflag_ & O_CREAT)
    open_flags |= PP_FILEOPENFLAG_CREATE;
  if (oflag_ & O_TRUNC)
    open_flags |= PP_FILEOPENFLAG_TRUNCATE;
  *pres = file_io_->Open(file_ref, open_flags,
      factory_.NewCallback(&FileRefStream::OnOpen, pres));
  if (*pres != PP_OK_COMPLETIONPENDING)
    sys->cond().broadcast();
  LOG("*pres = %d\n", *pres);
}

void FileRefStream::OnOpen(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (result == PP_OK) {
    result = file_io_->Query(&file_info_,
        factory_.NewCallback(&FileRefStream::OnQuery, pres));
    if (result == PP_OK_COMPLETIONPENDING)
      return;
  }
  delete file_io_;
  file_io_ = NULL;
  CleanupOnMainThread();
  *pres = result;
  sys->cond().broadcast();
}

void FileRefStream::OnQuery(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (result == PP_OK) {
    if (oflag_ & O_APPEND) {
      offset_ = file_info_.size;
    } else {
      if (!is_block())
        Read(PP_OK, kBufSize, NULL);
    }
  } else {
    delete file_io_;
    file_io_ = NULL;
    CleanupOnMainThread();
  }
  *pres = result;
  sys->cond().broadcast();
}

void FileRefStream::Read(int32_t result, size_t count, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(file_io_);
  read_buf_.resize(count);
  result = file_io_->Read(offset_, &read_buf_[0], read_buf_.size(),
      factory_.NewCallback(&FileRefStream::OnRead, pres));
  if (result != PP_OK_COMPLETIONPENDING) {
    delete file_io_;
    file_io_ = NULL;
    CleanupOnMainThread();
    if (pres)
      *pres = result;
    sys->cond().broadcast();
  }
}

void FileRefStream::OnRead(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (result >= 0) {
    in_buf_.insert(in_buf_.end(), &read_buf_[0], &read_buf_[0] + result);
    if (result && !is_block() && in_buf_.size() < kBufSize)
      Read(PP_OK, kBufSize, NULL);
  } else {
    delete file_io_;
    file_io_ = NULL;
    CleanupOnMainThread();
  }
  if (pres)
    *pres = result;
  sys->cond().broadcast();
}

void FileRefStream::Write(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(file_io_);
  if (result == PP_OK) {
    if (write_buf_.size()) {
      // Previous write operation is in progress.
      pp::Module::Get()->core()->CallOnMainThread(1,
          factory_.NewCallback(&FileRefStream::Write, &result));
      return;
    }
    assert(out_buf_.size());
    write_buf_.swap(out_buf_);
    result = file_io_->Write(offset_, &write_buf_[0], write_buf_.size(),
        factory_.NewCallback(&FileRefStream::OnWrite, pres));
    write_sent_ = false;
  } else {
    result = PP_ERROR_FAILED;
  }
  if (result != PP_OK_COMPLETIONPENDING) {
    delete file_io_;
    file_io_ = NULL;
    CleanupOnMainThread();
    if (pres)
      *pres = result;
    sys->cond().broadcast();
  }
}

void FileRefStream::OnWrite(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if ((size_t)result != write_buf_.size()) {
    delete file_io_;
    file_io_ = NULL;
    CleanupOnMainThread();
  } else {
    offset_ += result;
  }
  if (pres)
    *pres = result;
  write_buf_.clear();
  sys->cond().broadcast();
}

void FileRefStream::Close(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  delete file_io_;
  file_io_ = NULL;
  CleanupOnMainThread();
  if (pres)
    *pres = PP_OK;
  sys->cond().broadcast();
}

//------------------------------------------------------------------------------

PepperFile::PepperFile(int fd, int oflag, pp::FileSystem* file_system)
  : FileRefStream(fd, oflag), file_system_(file_system) {
}

PepperFile::~PepperFile() {
}

void PepperFile::GetFileRef(const char* pathname, int32_t* pres) {
  GotFileRef(pp::FileRef(*file_system_, pathname), pres);
}
