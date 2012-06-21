// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "ssh_plugin.h"

#include "ppapi/cpp/module.h"

#include "json/reader.h"
#include "json/writer.h"

// Known startSession attributes.
const char kUsernameAttr[] = "username";
const char kHostAttr[] = "host";
const char kPortAttr[] = "port";
const char kArgumentsAttr[] = "arguments";

extern "C" int ssh_main(int ac, const char **av);

//------------------------------------------------------------------------------

SshPluginInstance::SshPluginInstance(PP_Instance instance)
    : PluginInstance(instance) {
}

SshPluginInstance::~SshPluginInstance() {
}

void SshPluginInstance::SessionThreadImpl() {
  // Call renamed ssh main.
  std::vector<const char*> argv;
  // argv[0]
  argv.push_back("ssh");
#ifdef DEBUG
  argv.push_back("-vvv");
#endif
  if (session_args_.isMember(kArgumentsAttr) &&
      session_args_[kArgumentsAttr].isArray()) {
    const Json::Value& args = session_args_[kArgumentsAttr];
    for (size_t i = 0; i < args.size(); i++) {
      if (args[i].isString())
        argv.push_back(args[i].asCString());
      else
        PrintLog("startSession: invalid argument\n");
    }
  }

  std::string port;
  if (session_args_.isMember(kPortAttr)) {
    char buf[64];
    snprintf(buf, sizeof(buf), "-p%d", session_args_[kPortAttr].asInt());
    port = buf;
    argv.push_back(port.c_str());
  }

  std::string username_hostname;
  if (session_args_.isMember(kUsernameAttr) &&
      session_args_.isMember(kHostAttr)) {
    username_hostname = session_args_[kUsernameAttr].asString() + "@" +
        session_args_[kHostAttr].asString();
    argv.push_back(username_hostname.c_str());
  }

  LOG("ssh main args:\n");
  for (size_t i = 0; i < argv.size(); i++)
    LOG("  argv[%d] = %s\n", i, argv[i]);

  SessionClosed(ssh_main(argv.size(), &argv[0]));
}

//------------------------------------------------------------------------------

namespace pp {

class SshPluginModule : public pp::Module {
 public:
  SshPluginModule() : pp::Module() {}
  virtual ~SshPluginModule() {}

  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new SshPluginInstance(instance);
  }
};

Module* CreateModule() {
  return new SshPluginModule();
}

}  // namespace pp

extern "C" {
const char* __progname = "ssh";
}
