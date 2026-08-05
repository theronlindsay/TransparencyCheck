#!/bin/sh
# Renders the nginx config for this container.
#
# Two modes, picked automatically:
#   * HTTP-only — no certificate for $DOMAIN exists yet (or no DOMAIN is set).
#                 Serves the app on port 80 plus the ACME challenge path, so a
#                 certificate can be issued without a chicken-and-egg problem.
#   * HTTPS     — a certificate exists. Port 80 redirects to 443 (except the
#                 ACME path), port 443 terminates TLS.
#
# Renders into the directory given as $1 (default /etc/nginx/conf.d) so the
# reload loop can render to a temp dir and diff before swapping configs.
set -eu

OUT_DIR="${1:-/etc/nginx/conf.d}"
TEMPLATE_DIR=/etc/nginx/tc-templates
LE_DIR=/etc/letsencrypt/live

DOMAIN="${DOMAIN:-}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-}"

# nginx resolves names used in proxy_pass at config-load time, which makes the
# whole proxy fail to start when an app container is momentarily down. Using a
# variable in proxy_pass defers resolution to request time, but that needs an
# explicit resolver. Docker's embedded DNS is 127.0.0.11; Podman assigns one per
# network, so read it from resolv.conf instead of hardcoding either.
RESOLVER="$(awk '/^nameserver/ { printf "%s ", $2 }' /etc/resolv.conf)"
RESOLVER="${RESOLVER% }"
[ -n "$RESOLVER" ] || RESOLVER="127.0.0.11"

if [ -n "$DOMAIN" ]; then
	SERVER_NAMES="$DOMAIN www.$DOMAIN"
else
	# No domain configured: answer on whatever host or IP the request arrives on.
	SERVER_NAMES="_"
fi

export RESOLVER SERVER_NAMES DOMAIN ADMIN_DOMAIN

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR/default.conf" "$OUT_DIR/admin.conf" \
	"$OUT_DIR/app-proxy.inc" "$OUT_DIR/admin-proxy.inc"

# Routing snippets included by the server blocks below. The ".inc" extension is
# deliberate: nginx.conf auto-includes conf.d/*.conf at http level, where
# location blocks are not valid.
envsubst '${RESOLVER}' \
	<"$TEMPLATE_DIR/app-proxy.conf.template" \
	>"$OUT_DIR/app-proxy.inc"

if [ -n "$ADMIN_DOMAIN" ]; then
	envsubst '${RESOLVER}' \
		<"$TEMPLATE_DIR/admin-proxy.conf.template" \
		>"$OUT_DIR/admin-proxy.inc"
fi

if [ -n "$DOMAIN" ] && [ -f "$LE_DIR/$DOMAIN/fullchain.pem" ]; then
	envsubst '${DOMAIN} ${SERVER_NAMES}' \
		<"$TEMPLATE_DIR/https.conf.template" \
		>"$OUT_DIR/default.conf"

	if [ -n "$ADMIN_DOMAIN" ]; then
		envsubst '${DOMAIN} ${ADMIN_DOMAIN}' \
			<"$TEMPLATE_DIR/admin-https.conf.template" \
			>"$OUT_DIR/admin.conf"
	fi
else
	envsubst '${SERVER_NAMES}' \
		<"$TEMPLATE_DIR/http.conf.template" \
		>"$OUT_DIR/default.conf"

	if [ -n "$ADMIN_DOMAIN" ]; then
		envsubst '${ADMIN_DOMAIN}' \
			<"$TEMPLATE_DIR/admin-http.conf.template" \
			>"$OUT_DIR/admin.conf"
	fi
fi
