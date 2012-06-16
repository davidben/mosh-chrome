#!/bin/bash
# Copyright (c) 2011 The Native Client Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.
#

# nacl-mosh-1.2.2.sh
#
# usage: nacl-mosh-1.2.2.sh
#
# download, patch and build mosh for Native Client
#

readonly PACKAGE_NAME=mosh-1.2.2
readonly MOSH_MIRROR=https://github.com/downloads/keithw/mosh
readonly PATCH_FILE=$PWD/../${PACKAGE_NAME}.patch

source $NACL_PORTS/src/build_tools/common.sh

export PKG_CONFIG_PATH=${NACL_SDK_USR_LIB}/pkgconfig
export PKG_CONFIG_LIBDIR=${NACL_SDK_USR_LIB}
export PATH=${NACL_BIN_PATH}:${PATH}

export CPPFLAGS="-I$PWD/../include"
export LDFLAGS="-L$PWD/lib${NACL_PACKAGES_BITSIZE}"
[ -d "lib${NACL_PACKAGES_BITSIZE}" ] || mkdir "lib${NACL_PACKAGES_BITSIZE}"

# Build a fake libtinfo.
"${NACLCC}" $CPPFLAGS -c "$PWD/../src/tinfo.c" \
    -o "lib${NACL_PACKAGES_BITSIZE}/tinfo.o"
"${NACLAR}" rcs "lib${NACL_PACKAGES_BITSIZE}/libtinfo.a" \
    "lib${NACL_PACKAGES_BITSIZE}/tinfo.o"

# Build mosh.
rm -rf $PACKAGE_NAME/
if [[ ! -f ${PACKAGE_NAME}.tar.gz ]]
then
  wget $MOSH_MIRROR/${PACKAGE_NAME}.tar.gz -O ${PACKAGE_NAME}.tar.gz || exit 1
fi
tar xvzf ${PACKAGE_NAME}.tar.gz

cd $PACKAGE_NAME
patch -p1 -i $PATCH_FILE || exit 1

./configure --host=${NACL_CROSS_PREFIX} \
    --without-utempter --disable-server --disable-hardening || exit 1

# HACK: Like the openssh port, ignore the link error and steal
# the component pieces instead. The difficulty is that we no longer
# provide main; that's provided by libppapi.a. Instead, we implement
# the PPAPI entrypoints. But if we add that to the configure line,
# none of configure's test compiles link since they think they need to
# provide main instead of pp::CreateModule.
readonly MOSH_OBJS="src/frontend/mosh-client.o \
    src/frontend/stmclient.o \
    src/frontend/terminaloverlay.o"
readonly MOSH_ARCHIVES="src/crypto/libmoshcrypto.a \
    src/network/libmoshnetwork.a \
    src/statesync/libmoshstatesync.a \
    src/terminal/libmoshterminal.a \
    src/util/libmoshutil.a \
    src/protobufs/libmoshprotos.a \
    ../lib${NACL_PACKAGES_BITSIZE}/libtinfo.a"

make || echo "Ignore error"

"${NACLAR}" rcs ../libmosh${NACL_PACKAGES_BITSIZE}.a $MOSH_OBJS
for archive in $MOSH_ARCHIVES; do
    cp -f $archive ../$(basename $archive .a)${NACL_PACKAGES_BITSIZE}.a
done

# Reference link command:
#
# make[3]: Entering directory `.../src/frontend'
# x86_64-nacl-g++ -Wall -fno-default-inline -pipe -g -O2
# -L.../ssh_client/output/lib64 -o mosh-client mosh-client.o
# stmclient.o terminaloverlay.o ../crypto/libmoshcrypto.a
# ../network/libmoshnetwork.a ../statesync/libmoshstatesync.a
# ../terminal/libmoshterminal.a ../util/libmoshutil.a
# ../protobufs/libmoshprotos.a -lm -ltinfo -pthread
# -L.../x86_64-nacl/usr/lib -lprotobuf -lz -lrt -lz
