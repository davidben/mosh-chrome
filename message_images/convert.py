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


# Constant values for rendering properties
IMAGE_FONT_BASE = '/usr/share/fonts'
IMAGE_FONT_SIZE = 18
IMAGE_BORDER_WIDTH = 2
IMAGE_BORDER_COLOR = 'White'
IMAGE_BACKGROUND_COLOR = 'Black'
IMAGE_TEXT_COLOR = 'White'
IMAGE_FONT_MAP = {
    '*': 'droid-cros/DroidSans.ttf',
    'ar': 'droid-cros/DroidNaskh-Regular.ttf',
    'iw': 'croscore/Arimo-Regular.ttf',
    'ko': 'droid-cros/DroidSansFallback.ttf',
    'ja': 'droid-cros/DroidSansJapanese.ttf',
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
  if not font_file.startswith(os.path.sep):
    return os.path.join(IMAGE_FONT_BASE, font_file)
  return font_file


def convert_to_image(input_file, output_file):
  """ Converts a UTF-8 encoded text message file to image file. """
  # Load message
  with open(input_file, 'r') as input_handle:
    input_messages = input_handle.read().splitlines()

  # Strip spaces and blank lines
  input_messages = [message.decode('utf-8').strip()
                    for message in input_messages if message.strip()]

  # Load fonts
  font_file = find_font_file(os.path.splitext(os.path.basename(input_file))[0])
  if not os.path.exists(font_file):
    die("Missing font file: %s.\n" % font_file)

  # The output image is...
  # +----------------
  # | +--------------
  # | |               <- padding_height
  # | |   TXT HERE    <---------------\
  # | |               <- line_spacing | height
  # | |   SECOND TEXT <---------------/
  # | |   ^---------^ width, IMAGE_TEXT_COLOR
  # | |^-^ padding_width, IMAGE_BACKGROUND_COLOR
  #  ^ IMAGE_BORDER_WIDTH, IMAGE_BORDER_COLOR

  # Calculate bounding box
  font = ImageFont.truetype(font_file, IMAGE_FONT_SIZE)
  dimension = [font.getsize(message) for message in input_messages]
  width = max((dim[0] for dim in dimension))
  height = sum((dim[1] for dim in dimension))

  # Calculate padding: top/bottom: 1em; double for left/right.
  line_height = int(height / len(input_messages))
  padding_height = line_height
  padding_width = padding_height * 2

  # For each line, append 0.2em spacing
  line_spacing = int(line_height * 0.2)
  height += line_spacing * (len(input_messages) - 1)

  # Create image
  im = Image.new('L', (width + (padding_width + IMAGE_BORDER_WIDTH) * 2,
                       height + (padding_height + IMAGE_BORDER_WIDTH) * 2),
                 IMAGE_BORDER_COLOR)
  draw = ImageDraw.Draw(im)

  # Fill interior
  draw.rectangle(((IMAGE_BORDER_WIDTH, IMAGE_BORDER_WIDTH),
                  (im.size[0] - IMAGE_BORDER_WIDTH - 1,
                   im.size[1] - IMAGE_BORDER_WIDTH - 1)),
                  outline=IMAGE_BACKGROUND_COLOR,
                  fill=IMAGE_BACKGROUND_COLOR)
  # Render text
  text_x = IMAGE_BORDER_WIDTH + padding_width
  text_y = IMAGE_BORDER_WIDTH + padding_height
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
