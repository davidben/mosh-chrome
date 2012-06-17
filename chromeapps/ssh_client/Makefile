# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

SSH_CLIENT:=output/ssh_client
MOSH_CLIENT:=output/mosh_client
CXX_SOURCES:=\
	src/dev_null.cc \
	src/dev_random.cc \
	src/dev_tty.cc \
	src/file_system.cc \
	src/js_file.cc \
	src/pepper_file.cc \
	src/plugin.cc \
	src/tcp_server_socket.cc \
	src/tcp_socket.cc \
	src/syscalls.cc

SSH_SOURCES:=\
	src/ssh_plugin.cc

MOSH_SOURCES:=\
	src/mosh_plugin.cc

CXX_HEADERS:=\
	src/dev_null.h \
	src/dev_random.h \
	src/dev_tty.h \
	src/file_interfaces.h \
	src/file_system.h \
	src/js_file.h \
	src/mosh_plugin.h \
	src/pepper_file.h \
	src/plugin.h \
	src/proxy_stream.h \
	src/pthread_helpers.h \
	src/ssh_plugin.h \
	src/tcp_server_socket.h \
	src/tcp_socket.h

# Project Build flags
override LDFLAGS+=-lppapi_cpp -lppapi -lz -lresolv -ldl -ljsoncpp -Loutput
SSH_LIBS=-lutil -lcrypto -lnsl
MOSH_LIBS=-lprotobuf -lrt
override WARNINGS+=-Wno-long-long -Wall -Wswitch-enum -Werror
override CXXFLAGS+=-pthread -std=gnu++0x $(WARNINGS) -Iinclude

OSNAME:=$(shell python $(NACL_SDK_ROOT)/tools/getos.py)
TC_PATH:=$(abspath $(NACL_SDK_ROOT)/toolchain/$(OSNAME)_x86_glibc)
CXX:=$(TC_PATH)/bin/i686-nacl-g++

THIS_MAKEFILE:=$(abspath $(lastword $(MAKEFILE_LIST)))

# Declare the ALL target first, to make the 'all' target the default build
all: $(SSH_CLIENT)_x86_32.nexe $(SSH_CLIENT)_x86_64.nexe \
	$(MOSH_CLIENT)_x86_32.nexe $(MOSH_CLIENT)_x86_64.nexe

# Define 32 bit compile and link rules for C++ sources
x86_32_COMMON_OBJS:=$(patsubst src/%.cc,output/%_32.o,$(CXX_SOURCES))
x86_32_SSH_OBJS:=$(patsubst src/%.cc,output/%_32.o,$(SSH_SOURCES))
x86_32_MOSH_OBJS:=$(patsubst src/%.cc,output/%_32.o,$(MOSH_SOURCES))
x86_32_OBJS:=$(x86_32_COMMON_OBJS) $(x86_32_SSH_OBJS) $(x86_32_MOSH_OBJS)
$(x86_32_OBJS) : output/%_32.o : src/%.cc $(THIS_MAKE) $(CXX_HEADERS)
	$(CXX) -o $@ -c $< -m32 $(CXXFLAGS)

$(SSH_CLIENT)_x86_32.nexe : $(x86_32_COMMON_OBJS) $(x86_32_SSH_OBJS)
	$(CXX) -o $@ $^ -m32 -lopenssh32 -lssh32 -lopenbsd-compat32 \
		$(CXXFLAGS) $(LDFLAGS) $(SSH_LIBS)

$(MOSH_CLIENT)_x86_32.nexe : $(x86_32_COMMON_OBJS) $(x86_32_MOSH_OBJS)
	$(CXX) -o $@ $^ -m32 -lmosh32 -lmoshcrypto32 -lmoshnetwork32 \
	        -lmoshstatesync32 -lmoshterminal32 -lmoshutil32 \
                -lmoshprotos32 -ltinfo32 \
		$(CXXFLAGS) $(LDFLAGS) $(MOSH_LIBS)

# Define 64 bit compile and link rules for C++ sources
x86_64_COMMON_OBJS:=$(patsubst src/%.cc,output/%_64.o,$(CXX_SOURCES))
x86_64_SSH_OBJS:=$(patsubst src/%.cc,output/%_64.o,$(SSH_SOURCES))
x86_64_MOSH_OBJS:=$(patsubst src/%.cc,output/%_64.o,$(MOSH_SOURCES))
x86_64_OBJS:=$(x86_64_COMMON_OBJS) $(x86_64_SSH_OBJS) $(x86_64_MOSH_OBJS)
$(x86_64_OBJS) : output/%_64.o : src/%.cc $(THIS_MAKE) $(CXX_HEADERS)
	$(CXX) -o $@ -c $< -m64 $(CXXFLAGS)

$(SSH_CLIENT)_x86_64.nexe : $(x86_64_COMMON_OBJS) $(x86_64_SSH_OBJS)
	$(CXX) -o $@ $^ -m64 -lopenssh64 -lssh64 -lopenbsd-compat64 \
		$(CXXFLAGS) $(LDFLAGS) $(SSH_LIBS)

$(MOSH_CLIENT)_x86_64.nexe : $(x86_64_COMMON_OBJS) $(x86_64_MOSH_OBJS)
	$(CXX) -o $@ $^ -m64 -lmosh64 -lmoshcrypto64 -lmoshnetwork64 \
	        -lmoshstatesync64 -lmoshterminal64 -lmoshutil64 \
                -lmoshprotos64 -ltinfo64 \
		$(CXXFLAGS) $(LDFLAGS) $(MOSH_LIBS)

clean:
	rm -rf output/*.o $(SSH_CLIENT)*.nexe $(MOSH_CLIENT)*.nexe
