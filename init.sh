#!/usr/bin/env bash
# TransparencyCheck — one-command setup for a fresh VPS (or a laptop).
#
#   ./init.sh                                         HTTP on this machine's IP
#   ./init.sh --domain example.com --email me@x.com    HTTPS via Let's Encrypt
#   ./init.sh --domain localhost --self-signed         local HTTPS for testing
#
# Safe to re-run: it never overwrites secrets or settings that already have a
# value, and never re-issues a certificate that is still valid.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

COMPOSE="$ROOT_DIR/scripts/compose.sh"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

DOMAIN_ARG=""
EMAIL_ARG=""
ADMIN_DOMAIN_ARG=""
NO_ADMIN_DOMAIN=0
SELF_SIGNED=0
STAGING=0
SKIP_SSL=0
ASSUME_YES=0

info() { echo -e "$*"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}" >&2; }
fail() {
	echo -e "${RED}❌ $*${NC}" >&2
	exit 1
}

usage() {
	cat <<-EOF
		Usage: ./init.sh [options]

		  --domain DOMAIN         Public domain for the site (enables HTTPS)
		  --email EMAIL           Contact address for Let's Encrypt
		  --admin-domain HOST     Admin panel hostname (default: admin.DOMAIN)
		  --no-admin-domain       Do not expose the admin panel on a subdomain
		  --self-signed           Self-signed certificate instead of Let's Encrypt
		  --staging               Use the Let's Encrypt staging CA (for testing)
		  --skip-ssl              Bring the stack up over HTTP only
		  --engine docker|podman  Force a container engine
		  -y, --yes               Never prompt (use flags / existing .env as-is)
		  -h, --help              Show this help
	EOF
}

while [ $# -gt 0 ]; do
	case "$1" in
	--domain)
		DOMAIN_ARG="${2:-}"
		shift 2
		;;
	--email)
		EMAIL_ARG="${2:-}"
		shift 2
		;;
	--admin-domain)
		ADMIN_DOMAIN_ARG="${2:-}"
		shift 2
		;;
	--no-admin-domain)
		NO_ADMIN_DOMAIN=1
		shift
		;;
	--self-signed)
		SELF_SIGNED=1
		shift
		;;
	--staging)
		STAGING=1
		shift
		;;
	--skip-ssl)
		SKIP_SSL=1
		shift
		;;
	--engine)
		export TC_CONTAINER_ENGINE="${2:-}"
		shift 2
		;;
	-y | --yes)
		ASSUME_YES=1
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	*) fail "Unknown option: $1 (try --help)" ;;
	esac
done

# ── .env helpers ──────────────────────────────────────────────────────────────

env_get() {
	[ -f "$ENV_FILE" ] || return 0
	awk -v k="$1" -F= '$1 == k { sub("^" k "=", ""); print; exit }' "$ENV_FILE"
}

env_set() {
	local key="$1" value="$2" tmp
	tmp="$(mktemp "$ROOT_DIR/.env.tmp.XXXXXX")"
	awk -v k="$key" -v v="$value" -F= '
		$1 == k { print k "=" v; found = 1; next }
		{ print }
		END { if (!found) print k "=" v }
	' "$ENV_FILE" >"$tmp"
	mv "$tmp" "$ENV_FILE"
	chmod 600 "$ENV_FILE"
}

# Writes only when the key is currently empty or absent.
env_default() {
	[ -n "$(env_get "$1")" ] && return 0
	env_set "$1" "$2"
}

gen_secret() {
	local len="${1:-40}"
	if command -v openssl >/dev/null 2>&1; then
		openssl rand -base64 60 | tr -dc 'A-Za-z0-9' | cut -c1-"$len"
	else
		LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$len"
	fi
}

# prompt VAR "Question" "default"
prompt() {
	local __var="$1" question="$2" default="${3:-}" answer=""
	if [ "$ASSUME_YES" = "1" ] || [ ! -t 0 ]; then
		eval "$__var=\$default"
		return 0
	fi
	if [ -n "$default" ]; then
		read -r -p "$question [$default]: " answer
	else
		read -r -p "$question: " answer
	fi
	eval "$__var=\${answer:-\$default}"
}

# resolves_here NAME PUBLIC_IP — true when NAME points at this machine.
resolves_here() {
	local name="$1" ip="$2" resolved=""
	command -v getent >/dev/null 2>&1 || return 1
	[ -n "$ip" ] || return 1
	resolved="$(getent ahostsv4 "$name" 2>/dev/null | awk '{ print $1; exit }')" || true
	[ -n "$resolved" ] || return 1
	[ "$resolved" = "$ip" ]
}

# ── 1. Preflight ──────────────────────────────────────────────────────────────

info "${BOLD}TransparencyCheck setup${NC}"

[ -x "$COMPOSE" ] || chmod +x "$COMPOSE" 2>/dev/null || true
ENGINE="$("$COMPOSE" --print-engine)" || fail "No usable container engine found (see the message above)."
info "🐳 Container engine: ${BOLD}${ENGINE}${NC}"

# ── 2. Create or top up .env ──────────────────────────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
	[ -f "$ENV_EXAMPLE" ] || fail ".env.example is missing; cannot generate .env."
	cp "$ENV_EXAMPLE" "$ENV_FILE"
	chmod 600 "$ENV_FILE"
	info "📄 Created .env from .env.example"
else
	info "ℹ️  Using existing .env (values already set are left untouched)"
	# Add keys introduced since this .env was written.
	added=0
	while IFS= read -r line; do
		case "$line" in
		'' | '#'*) continue ;;
		esac
		key="${line%%=*}"
		if ! awk -v k="$key" -F= '$1 == k { found = 1 } END { exit !found }' "$ENV_FILE"; then
			if [ "$added" = "0" ]; then
				printf '\n# --- Added by init.sh ---\n' >>"$ENV_FILE"
				added=1
			fi
			printf '%s\n' "$line" >>"$ENV_FILE"
			info "   + added missing key $key"
		fi
	done <"$ENV_EXAMPLE"
fi

# Secrets: generated once, then left alone forever.
if [ -z "$(env_get MONGO_ROOT_PASSWORD)" ]; then
	env_set MONGO_ROOT_PASSWORD "$(gen_secret 32)"
	info "🔐 Generated MONGO_ROOT_PASSWORD"
elif [ "$(env_get MONGO_ROOT_PASSWORD)" = "password123" ]; then
	warn "MONGO_ROOT_PASSWORD is still the old shared default 'password123'."
	warn "Rotate it inside MongoDB first (db.changeUserPassword), then update .env —"
	warn "the root password is baked into the data volume at first start."
fi
env_default MONGO_ROOT_USER admin
if [ -z "$(env_get BETTER_AUTH_SECRET)" ]; then
	env_set BETTER_AUTH_SECRET "$(gen_secret 48)"
	info "🔐 Generated BETTER_AUTH_SECRET"
fi
if [ -z "$(env_get CRON_SECRET)" ]; then
	env_set CRON_SECRET "$(gen_secret 32)"
	info "🔐 Generated CRON_SECRET"
fi
GENERATED_ADMIN_PASSWORD=""
if [ -z "$(env_get ADMIN_PANEL_PASSWORD)" ]; then
	GENERATED_ADMIN_PASSWORD="$(gen_secret 24)"
	env_set ADMIN_PANEL_PASSWORD "$GENERATED_ADMIN_PASSWORD"
	info "🔐 Generated ADMIN_PANEL_PASSWORD"
fi
env_default CONGRESS_API_KEY DEMO_KEY
env_default HTTP_PORT 80
env_default HTTPS_PORT 443
env_default ADMIN_LOG_FILE /app/logs/server.log

# ── 3. Domain / HTTPS configuration ───────────────────────────────────────────

DOMAIN="${DOMAIN_ARG:-$(env_get DOMAIN)}"
EMAIL="${EMAIL_ARG:-$(env_get LETSENCRYPT_EMAIL)}"

if [ -z "$DOMAIN" ] && [ "$SKIP_SSL" = "0" ] && [ "$ASSUME_YES" = "0" ] && [ -t 0 ]; then
	echo
	info "Enter the domain this server will be reached on, or leave it empty to"
	info "serve plain HTTP on the machine's IP address (you can re-run with a"
	info "domain later at any time)."
	prompt DOMAIN "Domain" ""
fi

if [ -n "$DOMAIN" ]; then
	# Lowercase first, so a pasted "HTTPS://Example.com/" normalises correctly.
	# Case matters downstream: browsers always send a lowercase Origin header and
	# the allowlists below are compared by exact string equality.
	DOMAIN="$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')"
	DOMAIN="${DOMAIN#http://}"
	DOMAIN="${DOMAIN#https://}"
	DOMAIN="${DOMAIN%%/*}"
	DOMAIN="${DOMAIN#www.}"
	case "$DOMAIN" in
	*[!a-z0-9.-]* | -* | *- | .* | *.)
		fail "'$DOMAIN' does not look like a hostname. Pass just the domain, e.g. --domain example.com"
		;;
	esac
	env_set DOMAIN "$DOMAIN"

	if [ "$SELF_SIGNED" = "0" ] && [ "$SKIP_SSL" = "0" ] && [ -z "$EMAIL" ]; then
		prompt EMAIL "Email for Let's Encrypt expiry notices" ""
		[ -n "$EMAIL" ] || warn "No email given; registering with Let's Encrypt without one."
	fi
	[ -z "$EMAIL" ] || env_set LETSENCRYPT_EMAIL "$EMAIL"

	SCHEME="http"
	[ "$SKIP_SSL" = "0" ] && SCHEME="https"
	env_set BETTER_AUTH_URL "$SCHEME://$DOMAIN"
	env_set BETTER_AUTH_TRUSTED_ORIGINS "$SCHEME://$DOMAIN,$SCHEME://www.$DOMAIN"
	env_set CORS_ORIGINS "$SCHEME://$DOMAIN,$SCHEME://www.$DOMAIN"
fi

PUBLIC_IP="$(curl -fsS4 --max-time 8 https://api.ipify.org 2>/dev/null || curl -fsS4 --max-time 8 https://ifconfig.me 2>/dev/null || echo "")"
PRIVATE_IP="$(hostname -I 2>/dev/null | awk '{ print $1 }' || echo "localhost")"
[ -n "$PRIVATE_IP" ] || PRIVATE_IP="localhost"

# The admin panel is host-gated by the server, so it needs its own hostname, and
# that hostname has to be in the certificate. Only enable it when DNS already
# points here — otherwise issuance for the whole site fails.
ADMIN_DOMAIN=""
if [ -n "$DOMAIN" ] && [ "$NO_ADMIN_DOMAIN" = "0" ]; then
	ADMIN_DOMAIN="${ADMIN_DOMAIN_ARG:-$(env_get ADMIN_DOMAIN)}"
	ADMIN_DOMAIN="$(printf '%s' "$ADMIN_DOMAIN" | tr '[:upper:]' '[:lower:]')"
	if [ -z "$ADMIN_DOMAIN" ]; then
		if [ "$SELF_SIGNED" = "1" ] || resolves_here "admin.$DOMAIN" "$PUBLIC_IP"; then
			ADMIN_DOMAIN="admin.$DOMAIN"
		else
			warn "admin.$DOMAIN does not resolve to ${PUBLIC_IP:-this host} yet — skipping the admin host."
			warn "Add the DNS record, then re-run: ./init.sh --admin-domain admin.$DOMAIN"
		fi
	fi
fi
env_set ADMIN_DOMAIN "$ADMIN_DOMAIN"
[ -z "$ADMIN_DOMAIN" ] || env_set ADMIN_PANEL_HOSTS "$ADMIN_DOMAIN"

# ── 4. Warn about anything that will bite later ───────────────────────────────

HTTP_PORT="$(env_get HTTP_PORT)"
HTTPS_PORT="$(env_get HTTPS_PORT)"
if command -v ss >/dev/null 2>&1; then
	for port in "$HTTP_PORT" "$HTTPS_PORT"; do
		if ss -ltnH 2>/dev/null | awk '{ print $4 }' | grep -qE "[:.]${port}\$"; then
			warn "Port $port is already in use on this host. If that is a host nginx/apache,"
			warn "stop it (systemctl stop nginx) or set HTTP_PORT/HTTPS_PORT in .env."
		fi
	done
fi

if [ -n "$DOMAIN" ] && [ -n "$PUBLIC_IP" ] && [ "$SELF_SIGNED" = "0" ] && [ "$SKIP_SSL" = "0" ]; then
	if ! resolves_here "$DOMAIN" "$PUBLIC_IP"; then
		warn "$DOMAIN does not currently resolve to this machine ($PUBLIC_IP)."
		warn "Let's Encrypt validation will fail until the DNS A record is correct."
	fi
fi

if [ "$(env_get CONGRESS_API_KEY)" = "DEMO_KEY" ]; then
	warn "CONGRESS_API_KEY is DEMO_KEY — bill syncing will rate-limit almost immediately."
	warn "Get a free key at https://api.congress.gov/sign-up/ and put it in .env."
fi
if [ -z "$(env_get OPENAI_API_KEY)" ] && [ -z "$(env_get OPENROUTER_API_KEY)" ]; then
	warn "No OPENAI_API_KEY or OPENROUTER_API_KEY set — AI summaries will be empty."
fi

# ── 5. Build and start ────────────────────────────────────────────────────────

echo
info "🏗️  Building and starting containers (the first run takes a few minutes)…"
"$COMPOSE" up -d --build --remove-orphans

# ── 6. Certificates ───────────────────────────────────────────────────────────

cert_exists() {
	"$COMPOSE" exec -T proxy test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" >/dev/null 2>&1
}

wait_for_proxy() {
	local i
	for i in $(seq 1 30); do
		if curl -fsS --max-time 5 "http://127.0.0.1:${HTTP_PORT}/healthz" >/dev/null 2>&1; then
			return 0
		fi
		sleep 2
	done
	return 1
}

issue_self_signed() {
	command -v openssl >/dev/null 2>&1 || fail "--self-signed needs openssl on this host."
	local tmp
	tmp="$(mktemp -d)"
	openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
		-keyout "$tmp/privkey.pem" -out "$tmp/fullchain.pem" \
		-subj "/CN=$DOMAIN" \
		-addext "subjectAltName=DNS:$DOMAIN${ADMIN_DOMAIN:+,DNS:$ADMIN_DOMAIN}" 2>/dev/null
	tar -c -C "$tmp" . | "$COMPOSE" run --rm -T --entrypoint sh certbot -c \
		"mkdir -p /etc/letsencrypt/live/$DOMAIN && tar -x -C /etc/letsencrypt/live/$DOMAIN"
	rm -rf "$tmp"
	info "${GREEN}✅ Self-signed certificate installed for $DOMAIN${NC}"
}

issue_letsencrypt() {
	local args=()
	args+=(certonly --webroot --webroot-path /var/www/certbot)
	args+=(--non-interactive --agree-tos --no-eff-email)
	# Pinning the lineage name keeps the path the nginx template expects, instead
	# of certbot quietly creating example.com-0001 when the SAN list changes.
	args+=(--cert-name "$DOMAIN" --keep-until-expiring --expand)
	if [ -n "$EMAIL" ]; then
		args+=(--email "$EMAIL")
	else
		args+=(--register-unsafely-without-email)
	fi
	[ "$STAGING" = "1" ] && args+=(--staging)

	args+=(-d "$DOMAIN")
	if resolves_here "www.$DOMAIN" "$PUBLIC_IP"; then
		args+=(-d "www.$DOMAIN")
	else
		warn "www.$DOMAIN does not resolve here; leaving it out of the certificate."
	fi
	[ -z "$ADMIN_DOMAIN" ] || args+=(-d "$ADMIN_DOMAIN")

	info "🔒 Requesting a certificate for ${BOLD}${DOMAIN}${NC}…"
	if "$COMPOSE" run --rm --entrypoint certbot certbot "${args[@]}"; then
		info "${GREEN}✅ Certificate issued${NC}"
		return 0
	fi
	warn "Certificate issuance failed. The site is still up over HTTP."
	warn "Usual causes: DNS not pointing here yet, or ports 80/443 blocked by a"
	warn "firewall or cloud security group. Fix that, then re-run ./init.sh."
	warn "Tip: add --staging while debugging to avoid Let's Encrypt rate limits."
	return 1
}

CERT_READY=0
if [ -n "$DOMAIN" ] && [ "$SKIP_SSL" = "0" ]; then
	if ! wait_for_proxy; then
		warn "The proxy did not answer on http://127.0.0.1:${HTTP_PORT}/healthz."
		warn "Check './scripts/compose.sh logs proxy' before worrying about certificates."
	fi

	if cert_exists; then
		info "🔒 Certificate for $DOMAIN already present — skipping issuance."
		CERT_READY=1
	elif [ "$SELF_SIGNED" = "1" ]; then
		issue_self_signed && CERT_READY=1
	else
		issue_letsencrypt && CERT_READY=1
	fi

	if [ "$CERT_READY" = "1" ]; then
		# The proxy notices new certificates within a minute by itself; restarting
		# makes the switch to HTTPS immediate and deterministic.
		info "🔁 Restarting the proxy to enable HTTPS…"
		"$COMPOSE" restart proxy >/dev/null
	fi
fi

# ── 7. Summary ────────────────────────────────────────────────────────────────

SCHEME="http"
[ "$CERT_READY" = "1" ] && SCHEME="https"

PORT_SUFFIX=""
if [ "$SCHEME" = "http" ] && [ "$HTTP_PORT" != "80" ]; then PORT_SUFFIX=":$HTTP_PORT"; fi
if [ "$SCHEME" = "https" ] && [ "$HTTPS_PORT" != "443" ]; then PORT_SUFFIX=":$HTTPS_PORT"; fi

{
	echo ""
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	echo "🚀 TRANSPARENCY CHECK IS DEPLOYED"
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	echo ""
	if [ -n "$DOMAIN" ]; then
		echo "🌐 Site:        $SCHEME://$DOMAIN$PORT_SUFFIX"
		[ -n "$ADMIN_DOMAIN" ] && echo "🛠  Admin panel: $SCHEME://$ADMIN_DOMAIN$PORT_SUFFIX/admin"
		if [ "$CERT_READY" = "0" ]; then
			echo ""
			echo "   HTTPS is not active yet (see the warnings above)."
		fi
	else
		echo "🌐 Site (public):  http://${PUBLIC_IP:-your-server-ip}$PORT_SUFFIX"
		echo "🌐 Site (LAN):     http://$PRIVATE_IP$PORT_SUFFIX"
		echo "🛠  Admin panel:    http://localhost$PORT_SUFFIX/admin (host-gated to localhost)"
		echo ""
		echo "   For HTTPS, point a domain at this server and re-run:"
		echo "     ./init.sh --domain example.com --email you@example.com"
	fi
	echo ""
	echo "🔑 Secrets (admin password, cron secret, DB password) live in .env."
	echo ""
	echo "📝 OPERATIONS"
	echo "  Logs:     ./scripts/compose.sh logs -f server"
	echo "  Status:   ./scripts/compose.sh ps"
	echo "  Restart:  ./scripts/compose.sh restart"
	echo "  Update:   git pull && ./scripts/compose.sh up -d --build"
	echo "  Stop:     ./scripts/compose.sh down"
	echo ""
	echo "🔥 FIREWALL: only 80, 443 and your SSH port need to be open."
	echo "   ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable"
	echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
} | tee instructions.txt

if [ -n "$GENERATED_ADMIN_PASSWORD" ]; then
	echo
	echo -e "${BOLD}Admin panel password (generated, shown once):${NC} $GENERATED_ADMIN_PASSWORD"
	echo "It is stored in .env as ADMIN_PANEL_PASSWORD."
fi
