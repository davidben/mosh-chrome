#include <string.h>

#include <curses.h>
#include <term.h>

/* Fake libtinfo for mosh on NaCl */

int setupterm(char *term, int filedes, int *errret) {
  if (errret) *errret = 1;
  return OK;
}

int tigetflag(char *capname) {
  if (strcmp(capname, "bce") == 0) {
    return 1;
  }
  return -1;
}

int tigetnum(char *capname) {
  if (strcmp(capname, "colors") == 0) {
    return 256;
  }
  return -1;
}

char *tigetstr(char *capname) {
  if (strcmp(capname, "ech") == 0) {
    return (char *)"\033[%p1%dX";
  }
  return (char *)-1;
}
