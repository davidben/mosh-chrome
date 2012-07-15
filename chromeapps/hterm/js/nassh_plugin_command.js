// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * The NaCl-ssh-powered terminal command.
 *
 * This class defines a command that can be run in an hterm.Terminal instance.
 * This command creates an instance of the NaCl-ssh plugin and uses it to
 * communicate with an ssh daemon.
 *
 * If you want to use something other than this NaCl plugin to connect to a
 * remote host (like a shellinaboxd, etc), you'll want to create a brand new
 * command.
 *
 * @param {Object} argv The argument object passed in from the Terminal.
 */
nassh.PluginCommand = function(params) {
  // nmf src.
  this.nmf_ = params.nmf;

  // Command arguments.
  this.arguments_ = params.args;

  // Command environment.
  this.environment_ = params.environment || {};

  // hterm.Terminal.IO instance.
  this.io = params.io;

  // Relay manager.
  this.relay_ = params.relay || null;

  // Stream table.
  this.streamTable_ = null;

  // Counters used to acknowledge writes from the plugin.
  this.stdoutAcknowledgeCount_ = 0;
  this.stderrAcknowledgeCount_ = 0;

  // Prevent us from reporting an exit twice.
  this.exited_ = false;

  // Various callbacks.
  this.onLoad_ = params.onLoad;
  this.onExit_ = params.onExit;
  this.pathHandler_ = params.pathHandler;

  this.run_();
};

/**
 * Start the plugin.
 */
nassh.PluginCommand.prototype.run_ = function() {
  var argv = {};
  argv.terminalWidth = this.io.terminal_.screenSize.width;
  argv.terminalHeight = this.io.terminal_.screenSize.height;
  argv.useJsSocket = !!this.relay_;
  argv.environment = this.environment_;
  argv.writeWindow = 8 * 1024;
  argv.arguments = this.arguments_;

  var self = this;
  this.initPlugin_(function() {
    if (self.onLoad_)
      self.onLoad_();

    self.streamTable_ = new nassh.StreamTable();
    self.streamTable_.onClose = function(stream, reason) {
      self.sendToPlugin_('onClose', [stream.id, reason]);
    };

    // TODO(davidben): Queue up any terminal input processed before
    // the plugin is loaded.
    self.io.onVTKeystroke = self.sendString_.bind(self);
    self.io.sendString = self.sendString_.bind(self);
    self.io.onTerminalResize = self.onTerminalResize_.bind(self);

    self.sendToPlugin_('startSession', [argv]);
  });

  return true;
};

/**
 * Dispatch a "message" to one of a collection of message handlers.
 */
nassh.PluginCommand.prototype.dispatchMessage_ = function(
    desc, handlers, msg) {
  if (msg.name in handlers) {
    handlers[msg.name].apply(this, msg.argv);
  } else {
    console.log('Unknown "' + desc + '" message: ' + msg.name);
  }
};

nassh.PluginCommand.prototype.initPlugin_ = function(onComplete) {
  var self = this;

  this.plugin_ = window.document.createElement('embed');
  this.plugin_.style.cssText =
      ('position: absolute;' +
       'top: -99px' +
       'width: 0;' +
       'height: 0;');
  this.plugin_.setAttribute('src', this.nmf_);
  this.plugin_.setAttribute('type', 'application/x-nacl');
  this.plugin_.addEventListener('load', onComplete);
  this.plugin_.addEventListener('message', this.onPluginMessage_.bind(this));
  this.plugin_.addEventListener('crash', function (ev) {
    console.log('plugin crashed');
    self.exit(-1);
  });

  document.body.insertBefore(this.plugin_, document.body.firstChild);
};

/**
 * Send a message to the nassh plugin.
 *
 * @param {string} name The name of the message to send.
 * @param {Array} arguments The message arguments.
 */
nassh.PluginCommand.prototype.sendToPlugin_ = function(name, args) {
  var str = JSON.stringify({name: name, arguments: args});

  if (this.plugin_)
    this.plugin_.postMessage(str);
};

/**
 * Send a string to the remote host.
 *
 * @param {string} string The string to send.
 */
nassh.PluginCommand.prototype.sendString_ = function(string) {
  this.sendToPlugin_('onRead', [0, btoa(string)]);
};

/**
 * Notify plugin about new terminal size.
 *
 * @param {string|integer} terminal width.
 * @param {string|integer} terminal height.
 */
nassh.PluginCommand.prototype.onTerminalResize_ = function(width, height) {
  this.sendToPlugin_('onResize', [Number(width), Number(height)]);
};

/**
 * Exit the nassh command.
 */
nassh.PluginCommand.prototype.exit = function(code) {
  if (this.exited_)
    return;
  this.exited_ = true;
  if (this.plugin_) {
    this.plugin_.parentNode.removeChild(this.plugin_);
    this.plugin_ = null;
  }

  if (this.onExit_)
    this.onExit_(code);
};

/**
 * Called when the plugin sends us a message.
 *
 * Plugin messages are JSON strings rather than arbitrary JS values.  They
 * also use "arguments" instead of "argv".  This function translates the
 * plugin message into something dispatchMessage_ can digest.
 */
nassh.PluginCommand.prototype.onPluginMessage_ = function(e) {
  var msg = JSON.parse(e.data);
  msg.argv = msg.arguments;
  this.dispatchMessage_('plugin', this.onPlugin_, msg);
};

/**
 * Plugin message handlers.
 */
nassh.PluginCommand.prototype.onPlugin_ = {};

/**
 * Log a message from the plugin.
 */
nassh.PluginCommand.prototype.onPlugin_.printLog = function(str) {
  console.log('plugin log: ' + str);
};

/**
 * Plugin has exited.
 */
nassh.PluginCommand.prototype.onPlugin_.exit = function(code) {
  console.log('plugin exit: ' + code);
  this.exit(code);
};

/**
 * Plugin wants to open a file.
 *
 * The plugin leans on JS to provide a persistent filesystem, which we do via
 * the HTML5 Filesystem API.
 *
 * In the future, the plugin may handle its own files.
 */
nassh.PluginCommand.prototype.onPlugin_.openFile = function(fd, path, mode) {
  var self = this;
  function onOpen(streamId) {
    self.sendToPlugin_('onOpenFile', [fd, streamId]);
  }

  var streamClass;
  if (this.pathHandler_)
    streamClass = this.pathHandler_(path);

  if (streamClass) {
    this.streamTable_.openStream(streamClass, path, onOpen);
  } else {
    self.sendToPlugin_('onOpenFile', [fd, -1]);
  }
};

nassh.PluginCommand.prototype.onPlugin_.openSocket = function(
    fd, host, port) {
  if (!this.relay_) {
    this.sendToPlugin_('onOpenSocket', [fd, -1]);
    return;
  }

  var self = this;
  var stream = this.relay_.openSocket(
      this.streamTable_, fd, host, port,
      function onOpen(streamId) {
        self.sendToPlugin_('onOpenSocket', [fd, streamId]);
      });

  stream.onDataAvailable = function(data) {
    self.sendToPlugin_('onRead', [fd, data]);
  };
};

/**
 * Plugin wants to write some data to a stream.
 *
 * This is used to write to HTML5 Filesystem files.
 */
nassh.PluginCommand.prototype.onPlugin_.write = function(id, data) {
  var self = this;

  if (id == 1 || id == 2) {
    var string = atob(data);
    var ackCount = (id == 1 ?
                    this.stdoutAcknowledgeCount_ += string.length :
                    this.stderrAcknowledgeCount_ += string.length);
    //console.log('write start: ' + ackCount);
    this.io.print(string);
    //console.log('write done.');

    setTimeout(function() {
        //console.log('ack: ' + ackCount);
        self.sendToPlugin_('onWriteAcknowledge', [id, ackCount]);
      }, 0);
    return;
  }

  var stream = this.streamTable_.getStreamById(id);
  if (!stream) {
    console.warn('Attempt to write to unknown id: ' + id);
    return;
  }

  stream.asyncWrite(data, function(writeCount) {
      self.sendToPlugin_('onWriteAcknowledge', [id, writeCount]);
    }, 100);
};

/**
 * Plugin wants to read from a stream.
 */
nassh.PluginCommand.prototype.onPlugin_.read = function(id, size) {
  var self = this;
  var stream = this.streamTable_.getStreamById(id);

  if (!stream) {
    if (id != 0)
      console.warn('Attempt to read from unknown id: ' + id);
    return;
  }

  stream.asyncRead(size, function(b64bytes) {
      self.sendToPlugin_('onRead', [id, b64bytes]);
    });
};

/**
 * Plugin wants to close a file descriptor.
 */
nassh.PluginCommand.prototype.onPlugin_.close = function(id) {
  var self = this;
  var stream = this.streamTable_.getStreamById(id);
  if (!stream) {
    console.warn('Attempt to close unknown id: ' + id);
    return;
  }

  stream.close();
};
