#!/usr/bin/env bash
#
#   setup.sh - TestMe setup script to start the test web server.
#
#   Run goahead-test as a backgrounded child and forward signals via a
#   trap. MSYS bash on Windows does not preserve the POSIX parent-child
#   relationship across `exec` of a native .exe, so the bash wrapper would
#   exit immediately and TestMe would see the service as dead. The trap +
#   wait pattern keeps bash alive on every platform; the port-cleanup
#   block above recovers from the SIGKILL-orphan edge case.
#

set -m

#   Free the test ports if a prior run left a stale server bound.
if command -v lsof >/dev/null 2>&1; then
    for port in 18080 14443 18090 14453; do
        pids=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null)
        if [ -n "$pids" ] ; then
            kill $pids 2>/dev/null
            sleep 0.2
            kill -9 $pids 2>/dev/null
        fi
    done
fi

goahead-test -v --cert self.crt --key self.key &
PID=$!

cleanup() {
    kill $PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM SIGQUIT EXIT

wait $PID
