// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef MOSH_PLUGIN_H
#define MOSH_PLUGIN_H

#include "plugin.h"

class MoshPluginInstance : public PluginInstance {
 public:
  explicit MoshPluginInstance(PP_Instance instance);
  virtual ~MoshPluginInstance();

 protected:
  // Implements PluginInstance.
  virtual void SessionThreadImpl();

 private:
  DISALLOW_COPY_AND_ASSIGN(MoshPluginInstance);
};

#endif  // MOSH_PLUGIN_H
