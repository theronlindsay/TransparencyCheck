#!/bin/sh
set -eu
# Discard interrupted bulk downloads from a previous process before starting.
find /app/tmp -maxdepth 1 -type d -name "tc-fec-*" -exec rm -rf {} +
exec bun --smol apps/server/build
