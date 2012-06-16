// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef PLUGIN_H
#define PLUGIN_H

#include <string>
#include <map>

#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/var.h"

#include "json/value.h"

#include "pthread_helpers.h"
#include "file_system.h"

class PluginInstance : public pp::Instance,
                       public OutputInterface {
 public:
  explicit PluginInstance(PP_Instance instance);
  virtual ~PluginInstance();

  virtual void HandleMessage(const pp::Var& message_data);

  static PluginInstance* GetInstance() { return instance_; }
  pp::Core* core() { return core_; }
  pthread_t plugin_thread() { return plugin_thread_; }

  void PrintLog(const std::string& msg);
  void SessionClosed(int error);

  // Implements OutputInterface.
  virtual bool OpenFile(int fd, const char* name, int mode,
                        InputInterface* stream);
  virtual bool OpenSocket(int fd, const char* host, uint16_t port,
                          InputInterface* stream);
  virtual bool Write(int fd, const char* data, size_t size);
  virtual bool Read(int fd, size_t size);
  virtual bool Close(int fd);
  virtual size_t GetWriteWindow();

 protected:
  virtual void SessionThreadImpl() = 0;

  Json::Value session_args_;

 private:
  typedef std::map<int, InputInterface*> InputStreams;

  void StartSession(const Json::Value& args);
  void OnOpen(const Json::Value& args);
  void OnRead(const Json::Value& args);
  void OnWriteAcknowledge(const Json::Value& args);
  void OnClose(const Json::Value& args);
  void OnResize(const Json::Value& args);

  static void* SessionThread(void* arg);

  void Invoke(const std::string& function, const Json::Value& args);
  void InvokeJS(const std::string& function, const Json::Value& args);

  void PrintLogImpl(int32_t result, const std::string& msg);
  void SessionClosedImpl(int32_t result, const int& error);

  static PluginInstance* instance_;

  pp::Core* core_;
  pthread_t plugin_thread_;
  pp::CompletionCallbackFactory<PluginInstance, ThreadSafeRefCount> factory_;
  InputStreams streams_;
  FileSystem file_system_;

  DISALLOW_COPY_AND_ASSIGN(PluginInstance);
};

#endif  // PLUGIN_H
