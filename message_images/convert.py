#!/usr/bin/env python
# Copyright (c) 2011 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

""" Converts UTF-8 based message files into PNG files. """

import os
import sys

import Image
import ImageDraw
import ImageFont

# Most LCD panels are 1366x800. However desktops may use a smaller width like
# 1280x1024 or other resolution. It's safer to use SVGA width (1024).
# Also check ../../chromiumos-assets/images/boot_message.png which is exactly
# 1024 in width.
IMAGE_MAX_WIDTH = 1024

# Constant values for rendering properties
IMAGE_FONT_BASE = '/usr/share/fonts'
IMAGE_FONT_SIZE = 24
IMAGE_LINE_SPACING = 0.3
IMAGE_MARGIN_SIZE = 10
IMAGE_BACKGROUND_COLOR = 'White'
IMAGE_TEXT_COLOR = 'Black'
PANGO_FONT_NAME = 'pango:'
IMAGE_FONT_MAP = {
    '*': 'droid-cros/DroidSans.ttf',
    'ar': 'droid-cros/DroidNaskh-Regular.ttf',
    'iw': 'croscore/Arimo-Regular.ttf',
    'ko': 'droid-cros/DroidSansFallback.ttf',
    'fa': 'droid-cros/DroidNaskh-Regular.ttf',
    'ja': 'droid-cros/DroidSansFallback.ttf',
    'th': 'droid-cros/DroidSerifThai-Regular.ttf',
    'zh-CN': 'droid-cros/DroidSansFallback.ttf',
    'zh-TW': 'droid-cros/DroidSansFallback.ttf',
}


def die(message):
  """ Prints error message and exit as failure """
  sys.stderr.write("ERROR: %s\n" % message)
  exit(1)


def find_font_file(locale):
  """ Finds appropriate font file for given locale """
  font_file = IMAGE_FONT_MAP.get(locale, IMAGE_FONT_MAP['*'])
  if (font_file.startswith(PANGO_FONT_NAME) or
      font_file.startswith(os.path.sep)):
    return font_file
  else:
    return os.path.join(IMAGE_FONT_BASE, font_file)


def convert_by_pango(input_file, output_file, font):
  if not font:
    font = 'sans-serif'
  commands = [
      'pango-view', '--dpi=72', '--align=left', '--hinting=full', '-q',
      '--margin=%s' % IMAGE_MARGIN_SIZE,
      '--font="%s %s"' % (font, IMAGE_FONT_SIZE),
      '--foreground=%s' % IMAGE_TEXT_COLOR,
      '--background=%s' % IMAGE_BACKGROUND_COLOR,
      '--output=%s' % output_file, input_file,
      ]
  result = os.system(' '.join(commands))
  if result == 0:
    # Adjust image if it exceeds max width.
    im = Image.open(output_file)
    if im.size[0] > IMAGE_MAX_WIDTH:
      print "Adjusting width for %s..." % input_file
      commands += ['--width=%d' % IMAGE_MAX_WIDTH]
      result = os.system(' '.join(commands))
  if result != 0:
    die("Failed to render image by pango: %s" % input_file)


def convert_to_image(input_file, output_file):
  """ Converts a UTF-8 encoded text message file to image file. """
  # Load message
  with open(input_file, 'r') as input_handle:
    input_messages = input_handle.read().decode('utf-8').strip().splitlines()

  # Strip spaces in each line
  input_messages = [message.strip() for message in input_messages]

  # Load fonts
  font_file = find_font_file(os.path.basename(os.path.dirname(input_file)))
  if font_file.startswith(PANGO_FONT_NAME):
    convert_by_pango(input_file, output_file, font_file.strip(PANGO_FONT_NAME))
    return
  elif not os.path.exists(font_file):
    die("Missing font file: %s.\n" % font_file)

  # Calculate bounding box
  font = ImageFont.truetype(font_file, IMAGE_FONT_SIZE)
  dimension = [font.getsize(message) for message in input_messages]
  width = max((dim[0] for dim in dimension))
  height = sum((dim[1] for dim in dimension))

  # For each line, append IMAGE_LINE_SPACING * line_height for spacing
  line_height = int(height / len(input_messages))
  line_spacing = int(line_height * IMAGE_LINE_SPACING)
  height += line_spacing * (len(input_messages) - 1)

  # Create image
  im = Image.new('RGBA', (width + IMAGE_MARGIN_SIZE * 2,
                          height + IMAGE_MARGIN_SIZE * 2),
                 IMAGE_BACKGROUND_COLOR)
  draw = ImageDraw.Draw(im)

  # Render text
  text_x = IMAGE_MARGIN_SIZE
  text_y = IMAGE_MARGIN_SIZE
  for message in input_messages:
    draw.text((text_x, text_y), message, font=font, fill=IMAGE_TEXT_COLOR)
    text_y += font.getsize(message)[1] + line_spacing

  im.save(output_file)

def main(script, argv):
  global IMAGE_FONT_BASE
  if '--fontdir' in argv:
    fp_index = argv.index('--fontdir')
    IMAGE_FONT_BASE = argv[fp_index + 1]
    # remove --fontdir and its parameter
    argv.pop(fp_index)
    argv.pop(fp_index)

  if len(argv) < 1:
    die('Usage: %s [--fontdir font_base_path] utf8_files...' % script)

  for utf8_file in argv:
    png_file = os.path.splitext(utf8_file)[0] + '.png'
    print 'Converting %s to %s...' % (utf8_file, png_file)
    convert_to_image(utf8_file, png_file)

if __name__ == '__main__':
  main(sys.argv[0], sys.argv[1:])
