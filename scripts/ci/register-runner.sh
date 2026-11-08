#!/usr/bin/env bash
set +x
set -euo pipefail

test "$(uname -s)" = Linux || { echo 'Use a dedicated Linux machine or VM.' >&2; exit 1; }
test "$(id -u)" != 0 || { echo 'Use the dedicated non-root runner account.' >&2; exit 1; }
test "${DEDICATED_CI_HOST:-}" = 1 || { echo 'Explicit dedicated-host acknowledgement is required.' >&2; exit 1; }
: "${RUNNER_DOWNLOAD_URL:?Provide the official runner download URL}"
: "${RUNNER_SHA256:?Provide the official SHA256 checksum}"
: "${RUNNER_REGISTRATION_TOKEN:?Provide a fresh one-hour repository registration token, not a PAT}"
case "$RUNNER_DOWNLOAD_URL" in
  https://github.com/actions/runner/releases/download/v*/actions-runner-linux-*.tar.gz) ;;
  *) echo 'Only official GitHub Linux runner archives are accepted.' >&2; exit 1 ;;
esac
[[ "$RUNNER_SHA256" =~ ^[0-9a-fA-F]{64}$ ]] || { echo 'Invalid SHA256.' >&2; exit 1; }
root="${RUNNER_INSTALL_DIR:-$HOME/actions-runner-24bid}"
mkdir -p "$root"
test -z "$(find "$root" -mindepth 1 -maxdepth 1 -print -quit)" || { echo 'Refusing to overwrite an existing runner directory.' >&2; exit 1; }
umask 077
curl --fail --location --proto '=https' --proto-redir '=https' "$RUNNER_DOWNLOAD_URL" -o "$root/runner.tar.gz"
printf '%s  %s\n' "$RUNNER_SHA256" "$root/runner.tar.gz" | sha256sum --check --status
tar -xzf "$root/runner.tar.gz" -C "$root"
mkdir -p "$HOME/.config/24bid-ci"
printf '%s\n' 'https://github.com/rylpngy/24bid' > "$HOME/.config/24bid-ci/dedicated-host"
cd "$root"
./config.sh --unattended --url https://github.com/rylpngy/24bid \
  --token "$RUNNER_REGISTRATION_TOKEN" --name "${RUNNER_NAME:-24bid-ci-linux}" \
  --labels 24bid-ci --work _work
unset RUNNER_REGISTRATION_TOKEN
echo 'Registered. Install/start svc.sh as this dedicated user, then verify runner status on GitHub.'
