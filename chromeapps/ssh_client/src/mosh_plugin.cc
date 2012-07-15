// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "mosh_plugin.h"

#include "ppapi/cpp/module.h"

#include "json/reader.h"
#include "json/writer.h"

#include "file_system.h"

// Known startSession attributes.
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
  argv.push_back("mosh-client");

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

  // We inherit LC_* variables from the parent environment, but we
  // don't ship a full set, so they're unlikely to work anyway. Unset
  // them all and use our shipped en_US.UTF-8 for mosh-client. Let ssh
  // keep the inherited locale values to forward over to the server.
  unsetenv("LANGUAGE");
  unsetenv("LC_CTYPE");
  unsetenv("LC_NUMERIC");
  unsetenv("LC_TIME");
  unsetenv("LC_COLLATE");
  unsetenv("LC_MONETARY");
  unsetenv("LC_MESSAGES");
  unsetenv("LC_PAPER");
  unsetenv("LC_NAME");
  unsetenv("LC_ADDRESS");
  unsetenv("LC_TELEPHONE");
  unsetenv("LC_MEASUREMENT");
  unsetenv("LC_IDENTIFICATION");
  setenv("LANG", "en_US.UTF-8", 1);

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
