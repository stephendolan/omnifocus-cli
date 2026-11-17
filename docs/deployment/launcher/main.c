#include <errno.h>
#include <signal.h>
#include <spawn.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;
static volatile sig_atomic_t child_pid;

static void forward_signal(int signal_number) {
    int saved_errno = errno;
    if (child_pid > 0) kill((pid_t)child_pid, signal_number);
    errno = saved_errno;
}

int main(int argc, char *argv[]) {
    if (argc < 2 || argv[1][0] != '/') {
        fprintf(stderr, "Usage: %s /absolute/executable [arguments...]\n", argv[0]);
        return 64;
    }

    sigset_t forwarded, original_mask;
    sigemptyset(&forwarded);
    sigaddset(&forwarded, SIGTERM);
    sigaddset(&forwarded, SIGINT);
    sigaddset(&forwarded, SIGHUP);
    if (sigprocmask(SIG_BLOCK, &forwarded, &original_mask) == -1) {
        perror("sigprocmask");
        return 1;
    }
    struct sigaction action = {.sa_handler = forward_signal};
    sigemptyset(&action.sa_mask);
    if (sigaction(SIGTERM, &action, NULL) == -1 ||
        sigaction(SIGINT, &action, NULL) == -1 ||
        sigaction(SIGHUP, &action, NULL) == -1) {
        perror("sigaction");
        return 1;
    }

    posix_spawnattr_t attributes;
    int error = posix_spawnattr_init(&attributes);
    if (error == 0) {
        error = posix_spawnattr_setsigmask(&attributes, &original_mask);
        if (error == 0) error = posix_spawnattr_setsigdefault(&attributes, &forwarded);
        if (error == 0) error = posix_spawnattr_setflags(&attributes,
            POSIX_SPAWN_SETSIGMASK | POSIX_SPAWN_SETSIGDEF);
        if (error == 0) {
            pid_t pid;
            error = posix_spawn(&pid, argv[1], NULL, &attributes, &argv[1], environ);
            if (error == 0) child_pid = pid;
        }
        posix_spawnattr_destroy(&attributes);
    }
    if (error != 0) {
        fprintf(stderr, "posix_spawn: %s\n", strerror(error));
        return error == ENOENT ? 127 : 126;
    }
    if (sigprocmask(SIG_SETMASK, &original_mask, NULL) == -1) {
        perror("sigprocmask");
        kill((pid_t)child_pid, SIGKILL);
    }

    int status;
    pid_t result;
    do {
        result = waitpid((pid_t)child_pid, &status, 0);
    } while (result == -1 && errno == EINTR);
    if (result == -1) {
        perror("waitpid");
        return 1;
    }
    child_pid = 0;
    return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
}
