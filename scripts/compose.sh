#!/usr/bin/env bash
# Single place that knows how to talk to the container engine.
#
# Usage:  ./scripts/compose.sh up -d --build
#         ./scripts/compose.sh logs -f server
#
# Order of preference: podman (this project's VPS uses it), then docker. Override
# with TC_CONTAINER_ENGINE=docker|podman. Every caller — init.sh, the npm
# scripts, the deploy workflow — goes through here so a host with only Docker,
# only Podman, or the older docker-compose binary all behave the same.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Prints the resolved compose command, one argument per line.
resolve_compose() {
	local preferred="${TC_CONTAINER_ENGINE:-}"

	try_engine() {
		case "$1" in
		podman)
			# `podman compose` is a shim over an installed compose provider; the
			# version check fails when no provider is present, so it is a real test.
			if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
				printf 'podman\ncompose\n'
				return 0
			fi
			if command -v podman-compose >/dev/null 2>&1; then
				printf 'podman-compose\n'
				return 0
			fi
			;;
		docker)
			if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
				printf 'docker\ncompose\n'
				return 0
			fi
			if command -v docker-compose >/dev/null 2>&1; then
				printf 'docker-compose\n'
				return 0
			fi
			;;
		esac
		return 1
	}

	if [ -n "$preferred" ]; then
		if try_engine "$preferred"; then return 0; fi
		echo "TC_CONTAINER_ENGINE=$preferred was requested but no working compose command for it was found." >&2
		return 1
	fi

	try_engine podman && return 0
	try_engine docker && return 0

	cat >&2 <<-'EOF'
		Could not find a working container engine.

		Install one of these and re-run:
		  Docker Engine + Compose plugin   https://docs.docker.com/engine/install/
		  Podman + podman-compose          https://podman.io/docs/installation

		On Ubuntu/Debian the quickest path is:
		  curl -fsSL https://get.docker.com | sh
	EOF
	return 1
}

if ! COMPOSE_RESOLVED="$(resolve_compose)"; then
	exit 1
fi

# shellcheck disable=SC2206 # word splitting on newlines is what we want here
COMPOSE_CMD=($COMPOSE_RESOLVED)
if [ "${#COMPOSE_CMD[@]}" -eq 0 ]; then
	echo "Failed to resolve a compose command." >&2
	exit 1
fi

# Callers that only need to know which engine was picked.
if [ "${1:-}" = "--print-engine" ]; then
	echo "${COMPOSE_CMD[*]}"
	exit 0
fi

ARGS=("-f" "$ROOT_DIR/docker-compose.yaml")
if [ -f "$ROOT_DIR/.env" ]; then
	ARGS+=("--env-file" "$ROOT_DIR/.env")
fi

exec "${COMPOSE_CMD[@]}" "${ARGS[@]}" "$@"
