#!/bin/sh
# Render the nginx config before nginx starts.
set -eu

echo "[proxy] rendering nginx config (DOMAIN='${DOMAIN:-}' ADMIN_DOMAIN='${ADMIN_DOMAIN:-}')"
render-tc-config /etc/nginx/conf.d

if [ -n "${DOMAIN:-}" ] && [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
	echo "[proxy] certificate found for ${DOMAIN} — serving HTTPS"
else
	echo "[proxy] no certificate yet — serving HTTP only (ACME challenge path is live)"
fi
