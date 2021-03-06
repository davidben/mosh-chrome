#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -x
cd "$(dirname "$0")"
mkdir output

if [[ ($NACL_SDK_ROOT == "") || !(-d $NACL_SDK_ROOT) ]]; then
  pushd output
  if [[ !(-f naclsdk_linux.bz2) || !(-d naclsdk) ]]; then
    rm -rf naclsdk_linux.bz2 nacl_sdk && mkdir naclsdk
    wget --no-check-certificate https://commondatastorage.googleapis.com/nativeclient-mirror/nacl/nacl_sdk/trunk.129818/naclsdk_linux.bz2
    tar xvjf naclsdk_linux.bz2 -C naclsdk || exit 1
  fi
  export NACL_SDK_ROOT=$PWD/naclsdk/pepper_20
  popd
fi

if [[ ($NACL_PORTS == "") || !(-d $NACL_PORTS) ]]; then
  pushd output
  if [[ !(-d naclports/src) ]]; then
    rm -rf naclports && mkdir naclports
    cd naclports
    gclient config http://naclports.googlecode.com/svn/trunk/src || exit 1
    gclient sync --jobs=2 || exit 1
    cd ..
  fi
  export NACL_PORTS=$PWD/naclports
  popd
fi

pushd $NACL_PORTS/src
export NACL_GLIBC=1
NACL_PACKAGES_BITSIZE=32 make openssl zlib jsoncpp protobuf || exit 1
NACL_PACKAGES_BITSIZE=64 make openssl zlib jsoncpp protobuf || exit 1
popd

pushd output
if [[ !(-f libopenssh32.a) ]]; then
  NACL_PACKAGES_BITSIZE=32 ../nacl-openssh-5.9p1.sh || exit 1
fi

if [[ !(-f libopenssh64.a) ]]; then
  NACL_PACKAGES_BITSIZE=64 ../nacl-openssh-5.9p1.sh || exit 1
fi

if [[ !(-f libmosh32.a) ]]; then
  NACL_PACKAGES_BITSIZE=32 ../nacl-mosh-1.2.2.sh || exit 1
fi

if [[ !(-f libmosh64.a) ]]; then
  NACL_PACKAGES_BITSIZE=64 ../nacl-mosh-1.2.2.sh || exit 1
fi
popd

if [[ $1 == "--debug" ]]; then
  BUILD_ARGS="CXXFLAGS=-g -O0 -DDEBUG"
else
  BUILD_ARGS="CXXFLAGS=-g -O2 -DNDEBUG"
fi
make clean && make -j "$BUILD_ARGS" || exit 1

cd output
mkdir -p hterm/plugin
cp ../ssh_client.nmf hterm/plugin || exit 1
cp ../mosh_client.nmf hterm/plugin || exit 1
cp -R -f ../../hterm/{audio,css,html,images,js,_locales} ./hterm || exit 1
cp -R -f ../../hterm/manifest-dev.json ./hterm/manifest.json || exit 1
mkdir hterm/plugin/lib32
mkdir hterm/plugin/lib64
mkdir hterm/plugin/locale-data

# We ship a copy of en_US.UTF-8 to appease mosh. It needs a UTF-8
# locale and wcwidth needs LC_CTYPE to determine whether a character
# is printable or not. That subset of locale data should be the same
# across locales. (C.UTF-8 lacks anything remotely resembling a useful
# LC_CTYPE file.)
cp -R -f ../en_US.UTF-8 hterm/plugin/locale-data/

export GLIBC_VERSION=`ls $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib32/libc.so.* | sed s/.*libc.so.//`
sed -i s/xxxxxxxx/$GLIBC_VERSION/ hterm/plugin/ssh_client.nmf || exit 1
sed -i s/xxxxxxxx/$GLIBC_VERSION/ hterm/plugin/mosh_client.nmf || exit 1

cp -f ssh_client_x86_32.nexe hterm/plugin/ssh_client_x86_32.nexe || exit 1
cp -f ssh_client_x86_64.nexe hterm/plugin/ssh_client_x86_64.nexe || exit 1

cp -f mosh_client_x86_32.nexe hterm/plugin/mosh_client_x86_32.nexe || exit 1
cp -f mosh_client_x86_64.nexe hterm/plugin/mosh_client_x86_64.nexe || exit 1

LIBS="runnable-ld.so libppapi_cpp.so libppapi_cpp.so libstdc++.so.6 \
      libgcc_s.so.1 libpthread.so.* libresolv.so.* libdl.so.* libnsl.so.* \
      libm.so.* libc.so.* librt.so.*"
for i in $LIBS; do
  cp -f $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib32/$i hterm/plugin/lib32/
  cp -f $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib64/$i hterm/plugin/lib64/
done

if [[ -f ../ssh_client.pem ]]; then
  /opt/google/chrome/chrome --pack-extension=hterm --pack-extension-key=../ssh_client.pem
fi
