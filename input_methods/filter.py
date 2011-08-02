#! /usr/bin/python
# Copyright (c) 2010 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.
#
# Pre-generate IBus Component XML files based on our whitelist.
#
# TODO(satorux): The same script is present in two places:
# ibus-xkb-layouts/files and ibus-m17n/files. Move this to an appropriate
# place and share.
#
# By default, ibus-engine-xkb-layouts and ibus-m17n generates the XML data
# at runtime in their component xml files like:
#
#   <engines exec="/usr/libexec/ibus-engine-xkb-layouts --xml">
#
# This can be as big as 176KB for ibus-engine-xkb-layouts. In Chromium OS,
# we don't use most of the keyboard layouts, so it's wasteful to parse the
# large XML data. Besides, running a command is also expensive.
#
# The script is used to pre-generate compact XML data at build time, with
# all the unnecessary keyboard layouts stripped.
#
# Usage:
# % ibus-engine-xkb-layouts --xml | python filter.py \
#   --whitelist=chromeos_input_method_whitelist.py \
#   --replace=xkb-layouts.xml

import StringIO
import fileinput
import optparse
import re
import sys
import xml.dom.minidom

def FilterIBusComponentXml(input_xml, whitelist, output):
  """Filters the IBus component XML data with the given whitelist."""
  dom = xml.dom.minidom.parseString(input_xml)
  for engine in dom.getElementsByTagName('engine'):
    names = engine.getElementsByTagName('name')
    name = names[0].childNodes[0].data if names else ''
    # Remove elements that are unnecessary for Chrome OS.
    # Note that we don't remove <license> inside <components>.
    for element in ['description', 'icon', 'license']:
      # longname, language, and layout are also unnecessary but we'll keep them
      # for now in order to make debugging easy.
      target = engine.getElementsByTagName(element)
      if (target and target.length > 0 and
          target[0].childNodes.length > 0):
        target[0].childNodes[0].data = ''
    # Remove it if it's not in the white list.
    if whitelist and not name in whitelist:
      engine.parentNode.removeChild(engine)

  # For some reason, the tree.toxml() returns a string contains lots of
  # white space lines. Remove these lines.
  tree = dom.getElementsByTagName('engines')[0].toxml().encode('utf-8')
  xml_input = StringIO.StringIO(tree)
  for line in xml_input:
    if line.strip():
      output.write(line)
  output.write('\n')


def ExtractWhitelist(file_name):
  """Extracts the whitelist from the given C header file."""
  whitelist = set()
  for line in fileinput.input(file_name):
    line = re.sub(r'#.*', '', line)  # Remove comments.
    line = line.split()
    if line:
      whitelist.add(line[0])
  return whitelist


def RewriteComponentXml(file_name, engines_xml):
  """RewriteComponentXmls <engines> element in xkb-layouts.xml."""
  output = StringIO.StringIO()
  for line in fileinput.input(file_name):
    if re.search(r'<engines exec=', line):
      output.write(engines_xml)
    else:
      output.write(line)
  file(file_name, 'w').write(output.getvalue())


def main():
  parser = optparse.OptionParser(usage='Usage: %prog [options]')
  parser.add_option('--whitelist', dest='whitelist', default=None,
                    help='Use the whitelist file (C++ header)')
  parser.add_option('--rewrite', dest='rewrite', default=None,
                    help='Rewrite the IBus XML component file')
  (options, args) = parser.parse_args()

  whitelist = None
  if options.whitelist:
    whitelist = ExtractWhitelist(options.whitelist)
  input_xml = sys.stdin.read()
  output = StringIO.StringIO()
  output_xml = FilterIBusComponentXml(input_xml, whitelist, output)
  if options.rewrite:
    RewriteComponentXml(options.rewrite, output.getvalue())
  else:
    sys.stdout.write(output.getvalue())

if __name__ == '__main__':
  main()
