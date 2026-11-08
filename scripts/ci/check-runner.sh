#!/usr/bin/env bash
set -euo pipefail

test "$(uname -s)" = Linux || { echo 'A dedicated Linux CI host is required.' >&2; exit 1; }
test "$(id -u)" != 0 || { echo 'Do not run the runner as root.' >&2; exit 1; }
marker="$HOME/.config/24bid-ci/dedicated-host"
test -f "$marker" && grep -Fxq 'https://github.com/rylpngy/24bid' "$marker" || {
  echo 'Missing dedicated-host acknowledgement. See docs/self-hosted-runner.md.' >&2; exit 1;
}
docker info --format '{{.OSType}}' | grep -Fxq linux
if [ "${1:-}" = --e2e ]; then
  python3 - <<'PY'
import socket
for port in (8080, 8081, 5173, 5174, 5175, 5176):
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1', port))
        except OSError:
            raise SystemExit(f'Port {port} is occupied; refusing to reuse or stop an unknown service.')
PY
fi
