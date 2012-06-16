#ifndef MOSH_NACL_FAKE_TERM_H_
#define MOSH_NACL_FAKE_TERM_H_

#if __cplusplus
extern "C" {
#endif

/* Stub terminfo header for mosh. */

int setupterm(char *term, int filedes, int *errret);
int tigetflag(char *capname);
int tigetnum(char *capname);
char *tigetstr(char *capname);

#if __cplusplus
}
#endif

#endif  /* MOSH_NACL_FAKE_TERM_H_ */
