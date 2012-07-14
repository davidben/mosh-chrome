// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef UDP_SOCKET_H
#define UDP_SOCKET_H

#include <queue>
#include <vector>

#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/private/net_address_private.h"
#include "ppapi/cpp/private/udp_socket_private.h"

#include "file_system.h"
#include "pthread_helpers.h"

class UDPSocket : public FileStream {
 public:
  UDPSocket(int domain, int type, int fd, int oflag);
  virtual ~UDPSocket();

  bool open();

  int fd() { return fd_; }
  int oflag() { return oflag_; }
  bool is_block() { return !(oflag_ & O_NONBLOCK); }
  bool is_open() { return socket_ != NULL; }

  virtual void addref();
  virtual void release();

  virtual void close();
  virtual int read(char* buf, size_t count, size_t* nread);
  virtual int write(const char* buf, size_t count, size_t* nwrote);

  virtual ssize_t recvfrom(void* buf, size_t len, int flags,
                           sockaddr* src_addr, socklen_t* addrlen);
  virtual ssize_t sendto(const void* buf, size_t len, int flags,
                         const sockaddr* dest_addr, socklen_t addrlen);

  virtual int fcntl(int cmd,  va_list ap);

  virtual bool is_read_ready();
  virtual bool is_write_ready();
  virtual bool is_exception();

 private:
  static bool SockAddrToNetAddress(const sockaddr* addr, socklen_t len,
                                   PP_NetAddress_Private* netaddress);
  // addr is just assumed to have enough space for a sockaddr_in6.
  static bool NetAddressToSockAddr(const PP_NetAddress_Private& netaddress,
                                   sockaddr* addr);

  void Open(int32_t result, int32_t* pres);
  void Close(int32_t result, int32_t* pres);

  void OnBind(int32_t result, int32_t* pres);

  void RecvFrom(int32_t result);
  void OnRecvFrom(int32_t result);

  // CompletionCallbackFactory only has overloads to bind up to three
  // arguments into the closure.
  struct SendToData {
    const void* buf;
    size_t len;
    const sockaddr* dest_addr;
    socklen_t addrlen;
  };
  void SendTo(int32_t result, SendToData* data, int32_t* pres);
  void OnSendTo(int32_t result);

  int ref_;
  int fd_;
  int oflag_;
  int domain_;
  int type_;
  pp::CompletionCallbackFactory<UDPSocket, ThreadSafeRefCount> factory_;
  pp::UDPSocketPrivate* socket_;

  // We buffer one packet at a time. Unfortuately, because we cannot
  // get read-ready state, we must (like TCPSocket) continually pull
  // data and drive select by the buffer. But UDP packets are not a
  // stream, so the size of the buffer matters. Use 4096 which is
  // larger than what mosh needs and appears to be what Chrome uses
  // internally?
  static const size_t kBufSize = 4096;
  sockaddr_storage recvfrom_address_;
  char recvfrom_buf_[kBufSize];
  size_t recvfrom_len_;

  DISALLOW_COPY_AND_ASSIGN(UDPSocket);
};

#endif  // UDP_SOCKET_H
