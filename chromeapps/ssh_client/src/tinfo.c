#include <curses.h>
#include <term.h>

#include <stdio.h>
#include <stdlib.h>

/* Fake libtinfo for mosh on NaCl */

int setupterm(char *term, int filedes, int *errret) {
  fprintf(stderr, "setupterm not implemented\n");
  abort();
}

int tigetflag(char *capname) {
  fprintf(stderr, "setupterm not implemented\n");
  abort();
}

int tigetnum(char *capname) {
  fprintf(stderr, "tigetnum not implemented\n");
  abort();
}

char *tigetstr(char *capname) {
  fprintf(stderr, "tigetstr not implemented\n");
  abort();
}
