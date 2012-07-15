// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "ssh_plugin.h"

#include <arpa/inet.h>
#include <sys/socket.h>

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

// Conveniently, OpenSSH stuffs the final hostaddr in here.
extern struct sockaddr_storage hostaddr;

void SshPluginInstance::SessionThreadImpl() {
  // Replace stdout with a pipe to the outside shell.
  //
  // TODO(davidben): Make the Javacript <-> NaCl interface not a hack
  // so we needn't hard-code this into the binary.
  int out = open("/dev/js/ssh_mosh_pipe", O_WRONLY);
  if (out < 0) {
    perror("open");
    exit(1);
  }
  // This closes the original stdout, which would cause things to blow
  // up, but the /dev/tty handler takes references to it.
  if (dup2(out, STDOUT_FILENO) < 0) {
    perror("dup2");
    exit(1);
  }
  close(out);

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

  int ret = ssh_main(argv.size(), &argv[0]);

  // Pull the IP address we connected to out of the global |hostaddr|
  // variable where OpenSSH is kind enough to put it for us.
  if (ret == 0) {
    if (hostaddr.ss_family == AF_INET) {
      sockaddr_in* hostaddr_in = reinterpret_cast<sockaddr_in*>(&hostaddr);
      char buf[INET_ADDRSTRLEN + 1];
      const char* ip_str = inet_ntop(AF_INET, &hostaddr_in->sin_addr.s_addr,
                                     buf, sizeof(buf));
      if (ip_str) {
        printf("\nMOSH IP %s\n", ip_str);
        fflush(stdout);
      }
    } else if (hostaddr.ss_family == AF_INET6) {
      sockaddr_in6* hostaddr_in6 = reinterpret_cast<sockaddr_in6*>(&hostaddr);
      char buf[INET6_ADDRSTRLEN + 1];
      const char* ip_str = inet_ntop(AF_INET6, hostaddr_in6->sin6_addr.s6_addr,
                                     buf, sizeof(buf));
      if (ip_str) {
        printf("\nMOSH IP %s\n", ip_str);
        fflush(stdout);
      }
    }
  }

  SessionClosed(ret);
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
