// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f', 'lib.fs',
          // TODO(rginda): Nassh should not depend directly on hterm.  These
          // dependencies need to be refactored.
          'hterm.msg');

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
namosh.CommandInstance = function(argv) {
  // Command arguments.
  this.argv_ = argv;

  // hterm.Terminal.IO instance.
  this.io = null;

  // nassh.PluginCommand instance.
  this.command_ = null;

  // Parsed extension manifest.
  this.manifest_ = null;

  // The HTML5 persistent FileSystem instance for this extension.
  this.fileSystem_ = null;

  // An HTML5 DirectoryEntry for /.ssh/.
  this.sshDirectoryEntry_ = null;

  // Root preference manager.
  this.prefs_ = new namosh.GlobalPreferences();
};

/**
 * The name of this command used in messages to the user.
 *
 * Perhaps this will also be used by the user to invoke this command if we
 * build a command line shell.
 */
namosh.CommandInstance.prototype.commandName = 'namosh';

/**
 * Static run method invoked by the terminal.
 */
namosh.CommandInstance.run = function(argv) {
  return new namosh.CommandInstance(argv);
};

/**
 * Start the namosh command.
 *
 * Instance run method invoked by the namosh.CommandInstance ctor.
 */
namosh.CommandInstance.prototype.run = function() {
  this.io = this.argv_.io.push();

  // Similar to lib.fs.err, except this logs to the terminal too.
  var ferr = function(msg) {
    return function(err) {
      var ary = Array.apply(null, arguments);
      console.error(msg + ': ' + ary.join(', '));

      this.io.println(hterm.msg('UNEXPECTED_ERROR'));
      this.io.println(err);
    }.bind(this);
  }.bind(this);


  var onManifestLoaded = function(manifest) {
    this.manifest_ = manifest;

    this.io.println(
        hterm.msg('WELCOME_VERSION',
                  ['\x1b[1m' + this.manifest_.name + '\x1b[m',
                   '\x1b[1m' + this.manifest_.version + '\x1b[m']));
    this.io.println(
        hterm.msg('WELCOME_FAQ', ['\x1b[1mhttp://goo.gl/m6Nj8\x1b[m']));

    nassh.getFileSystem(onFileSystemFound, ferr('FileSystem init failed'));
  }.bind(this);

  var onFileSystemFound = function(fileSystem, sshDirectoryEntry) {
    this.fileSystem_ = fileSystem;
    this.sshDirectoryEntry_ = sshDirectoryEntry;

    var argstr = this.argv_.argString;

    if (!argstr || window.sessionStorage.getItem('namosh.promptOnReload')) {
      // If promptOnReload is set or we haven't gotten the destination
      // as an argument then we need to ask the user for the destination.
      //
      // The promptOnReload session item allows us to remember that we've
      // displayed the dialog, so we can re-display it if the user reloads
      // the page.  (Items in sessionStorage are scoped to the tab, kept
      // between page reloads, and discarded when the tab goes away.)
      window.sessionStorage.setItem('namosh.promptOnReload', 'yes');

      this.promptForDestination_();
    } else {
      if (!this.connectToArgString(argstr)) {
        this.io.println(hterm.msg('BAD_DESTINATION', [this.argv_.argString]));
        this.exit(1);
      }
    }
  }.bind(this);

  nassh.loadManifest(onManifestLoaded, ferr('Manifest load failed'));
};

/**
 * Removes a file from the HTML5 filesystem.
 *
 * Most likely you want to remove something from the /.ssh/ directory.
 *
 * This command is only here to support unsavory JS console hacks for managing
 * the /.ssh/ directory.
 *
 * @param {string} fullPath The full path to the file to remove.
 */
namosh.CommandInstance.prototype.removeFile = function(fullPath) {
  lib.fs.removeFile(this.fileSystem_.root, '/.ssh/' + identityName);
};

/**
 * Removes a directory from the HTML5 filesystem.
 *
 * Most likely you'll want to remove the entire /.ssh/ directory.
 *
 * This command is only here to support unsavory JS console hacks for managing
 * the /.ssh/ directory.
 *
 * @param {string} fullPath The full path to the file to remove.
 */
namosh.CommandInstance.prototype.removeDirectory = function(fullPath) {
  this.fileSystem_.root.getDirectory(
      fullPath, {},
      function (f) {
        f.removeRecursively(lib.fs.log('Removed: ' + fullPath),
                            lib.fs.err('Error removing' + fullPath));
      },
      lib.fs.log('Error finding: ' + fullPath)
  );
};

/**
 * Remove all known hosts.
 *
 * This command is only here to support unsavory JS console hacks for managing
 * the /.ssh/ directory.
 */
namosh.CommandInstance.prototype.removeAllKnownHosts = function() {
  this.fileSystem_.root.getFile(
      '/.ssh/known_hosts', {create: false},
      function(fileEntry) { fileEntry.remove(function() {}) });
};

/**
 * Remove a known host by index.
 *
 * This command is only here to support unsavory JS console hacks for managing
 * the /.ssh/ directory.
 *
 * @param {integer} index One-based index of the known host entry to remove.
 */
namosh.CommandInstance.prototype.removeKnownHostByIndex = function(index) {
  var onError = lib.fs.log('Error accessing /.ssh/known_hosts');
  var self = this;

  lib.fs.readFile(
      self.fileSystem_.root, '/.ssh/known_hosts',
      function(contents) {
        var ary = contents.split('\n');
        ary.splice(index - 1, 1);
        lib.fs.overwriteFile(self.fileSystem_.root, '/.ssh/known_hosts',
                             ary.join('\n'),
                             lib.fs.log('done'),
                             onError);
      }, onError);
};

namosh.CommandInstance.prototype.promptForDestination_ = function(opt_default) {
  var connectDialog = this.io.createFrame(
      lib.f.getURL('/html/namosh_connect_dialog.html'), null);

  connectDialog.onMessage = function(event) {
    event.data.argv.unshift(connectDialog);
    this.dispatchMessage_('connect-dialog', this.onConnectDialog_, event.data);
  }.bind(this);

  connectDialog.show();
};

namosh.CommandInstance.prototype.connectToArgString = function(argstr) {
  var ary = argstr.match(/^profile-id:([a-z0-9]+)/i);
  var rv;
  if (ary) {
    rv = this.connectToProfile(ary[1]);
  } else {
    rv = this.connectToDestination(argstr);
  }

  return rv;
};

/**
 * Initiate a connection to a remote host given a profile id.
 */
namosh.CommandInstance.prototype.connectToProfile = function(profileID) {
  var prefs = this.prefs_.getProfile(profileID);

  // We have to set the url here rather than in connectToArgString, because
  // some callers will come directly to connectToProfile.
  document.location.hash = 'profile-id:' + profileID;

  return this.connectTo({
      username: prefs.get('username'),
      hostname: prefs.get('hostname'),
      port: prefs.get('port'),
      identity: prefs.get('identity'),
      argstr: prefs.get('argstr'),
      terminalProfile: prefs.get('terminal-profile'),
      moshServer: prefs.get('mosh-server')
  });
};

/**
 * Initiate a connection to a remote host given a destination string.
 *
 * @param {string} destination A string of the form username@host[:port].
 * @return {boolean} True if we were able to parse the destination string,
 *     false otherwise.
 */
namosh.CommandInstance.prototype.connectToDestination = function(destination) {
  if (destination == 'crosh') {
    document.location = 'crosh.html'
    return true;
  }

  var ary = destination.match(/^([^@]+)@([^:@]+)(?::(\d+))?$/);
  if (!ary)
    return false;

  // We have to set the url here rather than in connectToArgString, because
  // some callers may come directly to connectToDestination.
  document.location.hash = destination;

  return this.connectTo({
      username: ary[1],
      hostname: ary[2],
      port: ary[3]
  });
};

/**
 * Initiate a connection to a remote host.
 *
 * @param {string} username The username to provide.
 * @param {string} hostname The hostname or IP address to connect to.
 * @param {string|integer} opt_port The optional port number to connect to.
 * @return {boolean} False if there was some trouble with the parameters, true
 *     otherwise.
 */
namosh.CommandInstance.prototype.connectTo = function(params) {
  if (!(params.username && params.hostname))
    return false;

  this.io.setTerminalProfile(params.terminalProfile || 'default');

  // TODO(rginda): The "port" parameter was removed from the CONNECTING message
  // on May 9, 2012, however the translations haven't caught up yet.  We should
  // remove the port parameter here once they do.
  this.io.println(hterm.msg('CONNECTING',
                            [params.username + '@' + params.hostname,
                             (params.port || '??')]));

  var args = ['-C', '-t'];  // enable compression, request a tty.
  var command;

  if (params.argstr) {
    args = args.concat(params.argstr.split(/\s+/));
  }

  if (params.identity)
    args.push('-i/.ssh/' + params.identity);
  if (params.port)
    args.push('-p' + params.port);

  args.push(params.username + '@' + params.hostname);
  args.push('--');
  var serverCommand = params.moshServer || 'mosh-server';
  serverCommand += ' new -s -c 256';
  // TODO(davidben): Allow picking UDP port, locale, etc. Don't forget
  // to shell-quote.
  args.push(serverCommand);

  this.io.print(hterm.msg('PLUGIN_LOADING'));
  var self = this;

  var stdout = "";
  var StdoutBuffer = function(table, id) {
    nassh.Stream.apply(this, [table, id]);
  }
  StdoutBuffer.prototype.asyncOpen_ = function(path, onOpen) {
    setTimeout(function() { onOpen(true); }, 0);
  };
  StdoutBuffer.prototype.asyncWrite = function(data, onSuccess) {
    var string = atob(data);
    stdout += string;
    setTimeout(function() { onSuccess(stdout.length); });
  };

  this.command_ = new nassh.PluginCommand({
    nmf: '../plugin/ssh_client.nmf',
    args: args,
    environment: this.argv_.environment,
    io: this.io,
    relay: null,
    onLoad: function() {
      self.io.println(hterm.msg('PLUGIN_LOADING_COMPLETE'));
      if (!self.argv_.argString)
        self.io.println(hterm.msg('WELCOME_TIP'));
      window.onbeforeunload = self.onBeforeUnload_.bind(self);
    },
    onExit: function(code) {
      if (code != 0) {
        // SSH exited with an error. Print the output we got and exit.
        self.io.print(stdout);
        self.exit(code);
      } else {
        var lines = stdout.split('\n');
        var ip, port, key;
        for (var i = 0; i < lines.length; i++) {
          var m = lines[i].match(/^MOSH IP (\S+)\s*$/);
          if (m) {
            ip = m[1];
            continue;
          }
          m = lines[i].match(/^MOSH CONNECT (\d+?) ([A-Za-z0-9\/+]{22})\s*$/);
          if (m) {
            port = m[1];
            key = m[2];
            continue;
          }
          // TODO(davidben): Parse this as the command is running, so
          // we don't buffer all output like this. This also differs
          // from the real mosh in that we still print the mosh
          // welcome text. The real script breaks as soon as it sees
          // MOSH CONNECT and prints MOSH IP before MOSH CONNECT
          self.io.println(lines[i]);
        }

        if (!key || !port) {
          self.io.println("Did not find mosh server startup message.");
        } else if (!ip) {
          self.io.println("Did not find remote IP address\n");
        } else {
          self.launchMoshClient_(ip, port, key);
        }
      }
    },
    pathHandler: function(path) {
      if (path == '/dev/random' || path == '/dev/urandom') {
        return nassh.Stream.Random;
      } else if (path == '/dev/js/ssh_mosh_pipe') {
        return StdoutBuffer;
      } else {
        return null;
      }
    }
  });
  document.querySelector('#terminal').focus();

  return true;
};

/**
 * Launch mosh-client with given parameters.
 */
namosh.CommandInstance.prototype.launchMoshClient_ = function(ip, port, key) {
  // Is there really no better way to do this?
  var env = {};
  for (var attr in this.argv_.environment) {
    if (this.argv_.environment.hasOwnProperty(attr))
      env[attr] = this.argv_.environment[attr];
  }
  env['MOSH_KEY'] = key;

  this.io.print(hterm.msg('PLUGIN_LOADING'));
  var self = this;
  this.command_ = new nassh.PluginCommand({
    nmf: '../plugin/mosh_client.nmf',
    args: [ip, port],
    environment: env,
    io: this.io,
    relay: null,
    onLoad: function() {
      self.io.println(hterm.msg('PLUGIN_LOADING_COMPLETE'));
    },
    onExit: function(code) {
      self.exit(code);
    },
    pathHandler: function(path) {
      if (path == '/dev/random' || path == '/dev/urandom') {
        return nassh.Stream.Random;
      } else {
        return null;
      }
    }
  });
};

/**
 * Dispatch a "message" to one of a collection of message handlers.
 */
namosh.CommandInstance.prototype.dispatchMessage_ = function(
    desc, handlers, msg) {
  if (msg.name in handlers) {
    handlers[msg.name].apply(this, msg.argv);
  } else {
    console.log('Unknown "' + desc + '" message: ' + msg.name);
  }
};

/**
 * Connect dialog message handlers.
 */
namosh.CommandInstance.prototype.onConnectDialog_ = {};

/**
 * Sent from the dialog when the user chooses a profile.
 */
namosh.CommandInstance.prototype.onConnectDialog_.connectToProfile = function(
    dialogFrame, profileID) {
  dialogFrame.close();

  if (!this.connectToProfile(profileID))
    this.promptForDestination_();
};

/**
 * Exit the namosh command.
 */
namosh.CommandInstance.prototype.exit = function(code) {
  this.io.pop();
  window.onbeforeunload = null;

  if (this.argv_.onExit)
    this.argv_.onExit(code);
};

namosh.CommandInstance.prototype.onBeforeUnload_ = function(e) {
  var msg = hterm.msg('BEFORE_UNLOAD');
  e.returnValue = msg;
  return msg;
};