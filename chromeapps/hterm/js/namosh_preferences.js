// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.f', 'lib.PreferenceManager');

/**
 * PreferenceManager subclass managing global NaSSH preferences.
 *
 * This is currently just an ordered list of known connection profiles.
 */
namosh.GlobalPreferences = function() {
  lib.PreferenceManager.call(this, '/namosh/prefs/');

  this.definePreferences
  ([
    // Ordered list of profile IDs, mapping to ProfilePreference objects.
    ['profile-ids', []],
   ]);
};

namosh.GlobalPreferences.prototype = {
  __proto__: lib.PreferenceManager.prototype
};

/**
 * Create a new namosh.ProfilePreferences object and append it to the list
 * of known connection profiles.
 *
 * @param {string} opt_description Optional description for the new profile.
 */
namosh.GlobalPreferences.prototype.createProfile = function(opt_description) {
  var profileIDs = this.get('profile-ids');
  var id;

  while (!id || profileIDs.indexOf(id) != -1) {
    id = Math.floor(Math.random() * 0xffff + 1).toString(16);
    id = lib.f.zpad(id, 4);
  }

  profileIDs.push(id);
  this.set('profile-ids', profileIDs);

  var profilePrefs = this.getProfile(id);
  profilePrefs.resetAll();

  if (opt_description)
    profilePrefs.set('description', opt_description);

  return profilePrefs;
};

/**
 * Remove a connection profile.
 *
 * Removes a profile from the list of known profiles and clears any preferences
 * stored for it.
 *
 * @param {string} id The profile ID.
 */
namosh.GlobalPreferences.prototype.removeProfile = function(id) {
  var prefs = this.getProfile(id);
  prefs.resetAll();

  var ids = this.get('profile-ids');
  var i = ids.indexOf(id);
  if (i != -1) {
    ids.splice(i, 1);
    this.set('profile-ids', ids);
  }
};

/**
 * Return a namosh.PreferenceProfile instance for a given profile id.
 *
 * If the profile is not in the list of known profiles this will throw an
 * exception.
 *
 * @param {string} id The profile ID.
 */
namosh.GlobalPreferences.prototype.getProfile = function(id) {
  if (this.get('profile-ids').indexOf(id) == -1)
    throw new Error('Unknown profile id: ' + id);

  return new namosh.ProfilePreferences(id);
};

/**
 * lib.PreferenceManager subclass managing per-connection NaSSH preferences.
 */
namosh.ProfilePreferences = function(id) {
  lib.PreferenceManager.call(this, '/namosh/prefs/profiles/' + id);

  this.id = id;

  this.definePreferences
  ([
    /**
     * The free-form description of this connection profile.
     */
    ['description', ''],

    /**
     * The username.
     */
    ['username', ''],

    /**
     * The hostname or IP address.
     */
    ['hostname', ''],

    /**
     * The port, or null to use the default port.
     */
    ['port', null],

    /**
     * The mosh-server command.
     */
    ['mosh-server', ''],

    /**
     * The private key file to use as the identity for this extension.
     *
     * Must be relative to the /.ssh/ directory.
     */
    ['identity', ''],

    /**
     * The argument string to pass to the ssh executable.
     *
     * Use '--' to separate ssh arguments from the target command/arguments.
     */
    ['argstr', ''],

    /**
     * The terminal profile to use for this connection.
     */
    ['terminal-profile', ''],
   ]);
};

namosh.ProfilePreferences.prototype = {
  __proto__: lib.PreferenceManager.prototype
};
