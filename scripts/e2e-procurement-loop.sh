#!/usr/bin/env bash
# Cross-portal acceptance requires an explicitly selected isolated local API and credentials.
# See docs/quality-hardening-2026-10-22.md, round 15, for environment variables.
set -euo pipefail
exec node "$(dirname "$0")/procurement-loop-acceptance.mjs"
