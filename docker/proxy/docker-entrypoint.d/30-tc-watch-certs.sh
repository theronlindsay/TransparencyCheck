#!/bin/sh
# Background watcher, started before nginx and left running alongside it.
#
#   * Switches the config from HTTP-only to HTTPS within a minute of a
#     certificate appearing, so first-time issuance needs no manual restart.
#   * Reloads every ~6h so renewed certificates are picked up (certbot renews
#     into the shared volume but cannot signal this container).
set -eu

CHECK_DIR=/tmp/tc-nginx-check

(
	tick=0
	while :; do
		sleep 60
		tick=$((tick + 1))

		rm -rf "$CHECK_DIR"
		if render-tc-config "$CHECK_DIR" 2>/dev/null &&
			! cmp -s "$CHECK_DIR/default.conf" /etc/nginx/conf.d/default.conf; then
			echo "[proxy] certificate state changed — re-rendering config"
			if render-tc-config /etc/nginx/conf.d && nginx -t; then
				nginx -s reload
				echo "[proxy] reloaded with new config"
			else
				echo "[proxy] config test failed — keeping the running config" >&2
			fi
			continue
		fi

		if [ "$((tick % 360))" -eq 0 ]; then
			nginx -s reload 2>/dev/null || true
		fi
	done
) &
