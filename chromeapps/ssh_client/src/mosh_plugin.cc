// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "mosh_plugin.h"

#include "ppapi/cpp/module.h"

#include "json/reader.h"
#include "json/writer.h"

#include "file_system.h"

// Known startSession attributes.
const char kUsernameAttr[] = "username";
const char kHostAttr[] = "host";
const char kPortAttr[] = "port";
const char kArgumentsAttr[] = "arguments";

extern "C" int mosh_main(int ac, const char **av);

//------------------------------------------------------------------------------

MoshPluginInstance::MoshPluginInstance(PP_Instance instance)
    : PluginInstance(instance) {
}

MoshPluginInstance::~MoshPluginInstance() {
}

void MoshPluginInstance::SessionThreadImpl() {
  // Call renamed mosh main.
  std::vector<const char*> argv;
  // argv[0]
  argv.push_back("mosh");
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

  // TODO(davidben): Pick correct arguments.
  argv.clear();
  argv.push_back("mosh");
  argv.push_back("127.0.0.1");
  argv.push_back("12345");
  // (sample key from mosh website)
  setenv("MOSH_KEY", "4NeCCgvZFe2RnPgrcU1PQw", 1);

  LOG("mosh main args:\n");
  for (size_t i = 0; i < argv.size(); i++)
    LOG("  argv[%d] = %s\n", i, argv[i]);

  SessionClosed(mosh_main(argv.size(), &argv[0]));
}

//------------------------------------------------------------------------------

namespace pp {

class MoshPluginModule : public pp::Module {
 public:
  MoshPluginModule() : pp::Module() {}
  virtual ~MoshPluginModule() {}

  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new MoshPluginInstance(instance);
  }
};

Module* CreateModule() {
  return new MoshPluginModule();
}

}  // namespace pp
