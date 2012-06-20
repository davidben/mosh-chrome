// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "udp_socket.h"

#include <assert.h>
#include <string.h>

#include "ppapi/c/pp_errors.h"
#include "ppapi/cpp/module.h"

#include "file_system.h"

template <class T>
class ScopedDeleter {
 public:
  ScopedDeleter(T* data) : data_(data) { }
  ~ScopedDeleter() { delete data_; }
 private:
  T* data_;
  DISALLOW_COPY_AND_ASSIGN(ScopedDeleter);
};

UDPSocket::UDPSocket(int domain, int type, int fd, int oflag)
  : ref_(1), fd_(fd), oflag_(oflag), domain_(domain),
    type_(type), factory_(this), socket_(NULL), recvfrom_len_(0) {
}

UDPSocket::~UDPSocket() {
  assert(!socket_);
  assert(!ref_);
}

bool UDPSocket::open() {
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(
      0, factory_.NewCallback(&UDPSocket::Open, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while(result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());
  if (result != PP_OK)
    errno = EPROTONOSUPPORT;  // Bleh.
  return result == PP_OK;
}

void UDPSocket::addref() {
  ++ref_;
}

void UDPSocket::release() {
  if (!--ref_)
    delete this;
}

FileStream* UDPSocket::dup(int fd) {
  return NULL;
}

void UDPSocket::close() {
  if (socket_) {
    int32_t result = PP_OK_COMPLETIONPENDING;
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&UDPSocket::Close, &result));
    FileSystem* sys = FileSystem::GetFileSystem();
    while(result == PP_OK_COMPLETIONPENDING)
      sys->cond().wait(sys->mutex());
  }
}

int UDPSocket::read(char* buf, size_t count, size_t* nread) {
  ssize_t ret = recvfrom(buf, count, 0, NULL, 0);
  if (ret < 0) {
    *nread = -1;
    return errno;
  }
  *nread = ret;
  return 0;
}

ssize_t UDPSocket::recvfrom(void* buf, size_t len, int flags,
                            sockaddr* src_addr, socklen_t* addrlen) {
  if (!is_open()) {
    errno = EIO;
    return -1;
  }

  FileSystem* sys = FileSystem::GetFileSystem();
  if (is_block()) {
    while (!recvfrom_len_ && is_open())
      sys->cond().wait(sys->mutex());
  }

  // Got a packet. Copy it in.
  size_t bytes_received = std::min(len, recvfrom_len_);
  if (src_addr) {
    memcpy(buf, recvfrom_buf_, bytes_received);
    memcpy(src_addr, &recvfrom_address_,
           std::min(*addrlen, sizeof(recvfrom_address_)));
    *addrlen = (recvfrom_address_.sin6_family == AF_INET6) ?
        sizeof(sockaddr_in6) : sizeof(sockaddr_in);
  }

  // Fire off the next RecvFrom.
  recvfrom_len_ = 0;
  pp::Module::Get()->core()->CallOnMainThread(
      0, factory_.NewCallback(&UDPSocket::RecvFrom));

  return bytes_received;
}

int UDPSocket::write(const char* buf, size_t count, size_t* nwrote) {
  // write is a 0-flags send, which is a NULL destaddr sendto. Do a
  // bit of translating because read/write have NaCl IRT prototype
  // that doesn't quite match the usual one.
  ssize_t ret = sendto(buf, count, 0, NULL, 0);
  if (ret < 0) {
    *nwrote = -1;
    return errno;
  }
  *nwrote = ret;
  return 0;
}

ssize_t UDPSocket::sendto(const void* buf, size_t len, int flags,
                          const sockaddr* dest_addr, socklen_t addrlen) {
  if (!is_open()) {
    errno = EIO;
    return -1;
  }

  SendToData* data = new SendToData;
  data->buf = buf;
  data->len = len;
  data->dest_addr = dest_addr;
  data->addrlen = addrlen;
  int32_t result = PP_OK_COMPLETIONPENDING;
  pp::Module::Get()->core()->CallOnMainThread(
      0, factory_.NewCallback(&UDPSocket::SendTo, data, &result));
  FileSystem* sys = FileSystem::GetFileSystem();
  while (result == PP_OK_COMPLETIONPENDING)
    sys->cond().wait(sys->mutex());

  if (result != PP_OK) {
    LOG("EIO\n");
    errno = EIO;
    return -1;
  }

  return len;
}


int UDPSocket::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}

bool UDPSocket::is_read_ready() {
  LOG("is_read_ready: len = %d\n", recvfrom_len_);
  return !is_open() || recvfrom_len_ > 0;
}

bool UDPSocket::is_write_ready() {
  // TODO(davidben): Buffer packets so we don't spam
  // pp::UDPSocketPrivate::SendTo? I think mosh ignores this, so we
  // should just be able to discard errors. It's UDP anyway, and it's
  // unclear how long before pp::UDPSocketPrivate::SendTo's callback
  // returns.
  return true;
}

bool UDPSocket::is_exception() {
  return !is_open();
}

void UDPSocket::Open(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(!socket_);

  if (!pp::UDPSocketPrivate::IsAvailable()) {
    LOG("UDPSocketPrivate not available\n");
    *pres = PP_ERROR_NOTSUPPORTED;
    sys->cond().broadcast();
    return;
  }

  socket_ = new pp::UDPSocketPrivate(sys->instance());

  // PPAPI requires us to bind sockets before they can be used, but
  // POSIX binds to a random address by default. Bind it now. To be
  // more accurate, we should probably delay this until we know the
  // user won't bind it manually, but this is enough for now.
  PP_NetAddress_Private addr;
  if (!pp::NetAddressPrivate::GetAnyAddress(domain_ == AF_INET6, &addr)) {
    LOG("pp::NetAddressPrivate::GetAnyAddress failed!\n");
    *pres = PP_ERROR_FAILED;
    sys->cond().broadcast();
    return;
  }

  int ret = socket_->Bind(
      &addr, factory_.NewCallback(&UDPSocket::OnBind, pres));
  assert(ret == PP_OK_COMPLETIONPENDING);
}

void UDPSocket::OnBind(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());

  assert(socket_);
  if (result != PP_OK) {
    LOG("pp::UDPSocket::OnBind failed!\n");
    *pres = PP_ERROR_FAILED;
    sys->cond().broadcast();
    return;
  }

  // Finally, we're ready. Fire off the first RecvFrom and go.
  RecvFrom(PP_OK);
  *pres = PP_OK;
  sys->cond().broadcast();
}

void UDPSocket::RecvFrom(int32_t) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (!is_open())
    return;

  assert(recvfrom_len_ == 0);
  LOG("RecvFrom\n");
  int ret = socket_->RecvFrom(recvfrom_buf_, kBufSize,
                              factory_.NewCallback(&UDPSocket::OnRecvFrom));
  assert(ret == PP_OK_COMPLETIONPENDING);
}

void UDPSocket::OnRecvFrom(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (!is_open())
    return;
  LOG("OnRecvFrom (%d)\n", result);

  PP_NetAddress_Private address = { };
  if (result > 0 && !socket_->GetRecvFromAddress(&address)) {
    LOG("UDPSocketPrivate::GetRecvFromAddress failed!\n");
    result = PP_ERROR_FAILED;
  }
  if (result > 0 && !NetAddressToSockAddr(
          address, reinterpret_cast<sockaddr*>(&recvfrom_address_))) {
    result = PP_ERROR_FAILED;
  }
  if (result > 0) {
    recvfrom_len_ = result;
  } else {
    LOG("UDPSocketPrivate::RecvFrom failed! (%d)\n", result);
    delete socket_;
    socket_ = NULL;
  }
  sys->cond().broadcast();
}

void UDPSocket::SendTo(int32_t result, SendToData* data, int32_t* pres) {
  ScopedDeleter<SendToData> del(data);
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (!is_open()) {
    *pres = PP_ERROR_FAILED;
    sys->cond().broadcast();
    return;
  }

  // Convert the sockaddr.
  PP_NetAddress_Private addr = { };
  if (!SockAddrToNetAddress(data->dest_addr, data->addrlen, &addr)) {
    *pres = PP_ERROR_FAILED;
    sys->cond().broadcast();
    return;
  }

  // Actually send the data. We have no information about the OS's
  // buffer, and the callback may not run until then. So return
  // immediately and ignore the callback. Make this an optional
  // callback on the off-chance we can get an error synchronously.
  pp::CompletionCallback cb = factory_.NewCallback(&UDPSocket::OnSendTo);
  int ret = socket_->SendTo(
      reinterpret_cast<const char*>(data->buf), data->len, &addr, cb);
  if (ret != PP_OK_COMPLETIONPENDING) {
    // Free the data.
    cb.Run(ret);
  } else {
    ret = PP_OK;
  }
  *pres = ret;
  sys->cond().broadcast();
}

void UDPSocket::OnSendTo(int32_t result) {
  // TODO(davidben): It would be good to map this to an errno and
  // plumb back to mosh. But we can't be sure that won't block the
  // caller.
  if (result < 0)
    LOG("UDPSocket::SendTo failed (%d)!\n", result);
}

// static
bool UDPSocket::SockAddrToNetAddress(const sockaddr* addr,
                                     socklen_t len,
                                     PP_NetAddress_Private* netaddress) {
  if (addr->sa_family == AF_INET) {
    const sockaddr_in* sin4 = reinterpret_cast<const sockaddr_in*>(addr);
    uint8_t ip[4];
    *(reinterpret_cast<uint32_t*>(&ip)) = sin4->sin_addr.s_addr;
    if (!pp::NetAddressPrivate::CreateFromIPv4Address(
            ip, ntohs(sin4->sin_port), netaddress)) {
      LOG("pp::NetAddressPrivate::CreateFromIPv4Address failed!\n");
      return false;
    }
    return true;
  } else if (addr->sa_family == AF_INET6) {
    const sockaddr_in6* sin6 =
        reinterpret_cast<const sockaddr_in6*>(addr);
    if (!pp::NetAddressPrivate::CreateFromIPv6Address(
            sin6->sin6_addr.s6_addr, sin6->sin6_scope_id,
            ntohs(sin6->sin6_port), netaddress)) {
      LOG("pp::NetAddressPrivate::CreateFromIPv6Address failed!\n");
      return false;
    }
    return true;
  } else {
    LOG("Unsupported sa_family!\n");
    return false;
  }
}

// static
bool UDPSocket::NetAddressToSockAddr(const PP_NetAddress_Private& netaddress,
                                     sockaddr* addr) {
  PP_NetAddressFamily_Private family =
      pp::NetAddressPrivate::GetFamily(netaddress);
  if (family == PP_NETADDRESSFAMILY_IPV4) {
    sockaddr_in* sin4 = reinterpret_cast<sockaddr_in*>(addr);
    sin4->sin_family = AF_INET;
    sin4->sin_port = htons(pp::NetAddressPrivate::GetPort(netaddress));
    if (!pp::NetAddressPrivate::GetAddress(
            netaddress, &sin4->sin_addr.s_addr,
            sizeof(sin4->sin_addr.s_addr))) {
      LOG("pp::NetAddressPrivate::GetAddress failed!\n");
      return false;
    }
    return true;
  } else if (family == PP_NETADDRESSFAMILY_IPV6) {
    sockaddr_in6* sin6 = reinterpret_cast<sockaddr_in6*>(addr);
    sin6->sin6_family = AF_INET6;
    sin6->sin6_port = htons(pp::NetAddressPrivate::GetPort(netaddress));
    sin6->sin6_scope_id = pp::NetAddressPrivate::GetScopeID(netaddress);
    sin6->sin6_flowinfo = 0;  // TODO(davidben): Is this right?
    if (!pp::NetAddressPrivate::GetAddress(
            netaddress, &sin6->sin6_addr.s6_addr,
            sizeof(sin6->sin6_addr.s6_addr))) {
      LOG("pp::NetAddressPrivate::GetAddress failed!\n");
      return false;
    }
    return true;
  } else {
    LOG("Unsupported PP_NetAddressFamily_Private!\n");
    return false;
  }
}

void UDPSocket::Close(int32_t result, int32_t* pres) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  delete socket_;
  socket_ = NULL;
  if (pres)
    *pres = PP_OK;
  sys->cond().broadcast();
}

