# Deploying TransparencyCheck on a VPS

The whole stack — MongoDB, the API server, the static PWA, and an nginx edge
proxy that terminates HTTPS — runs as containers from one compose file. Setup is
a single script.

## TL;DR

```bash
# On a fresh Ubuntu/Debian VPS as a user with sudo:
curl -fsSL https://get.docker.com | sh          # or install podman + podman-compose
git clone https://github.com/theronlindsay/TransparencyCheck.git
cd TransparencyCheck
./init.sh --domain example.com --email you@example.com
```

That gives you a running site on `https://example.com` with an automatically
renewing Let's Encrypt certificate. `./init.sh` with no arguments works too — it
serves plain HTTP on the machine's IP, and you can re-run it with a domain later.

## What you need first

1. **A VPS** with 2 GB RAM or more (the client build is the memory-hungry part)
   and Docker Engine + the Compose plugin, or Podman + `podman-compose`.
2. **DNS**, if you want HTTPS. Before running `init.sh`, create A records
   pointing at the server's public IP:

   | Record       | Purpose                                     | Required |
   | ------------ | ------------------------------------------- | -------- |
   | `example.com`     | The site                               | yes      |
   | `www.example.com` | Redirect/alias                         | optional |
   | `admin.example.com` | Admin panel (`/admin`)               | optional |

   `init.sh` checks each name and only asks Let's Encrypt for the ones that
   already resolve to this host, so a missing `www` record can't fail the whole
   certificate.
3. **Ports 80 and 443 open** to the internet — both in any host firewall (`ufw`)
   and in your provider's security group. HTTP-01 validation needs port 80, and
   it needs it on port 80 specifically.
4. **API keys**: a [Congress.gov key](https://api.congress.gov/sign-up/) and an
   OpenAI (or OpenRouter) key. The stack starts without them, but bill syncing
   rate-limits instantly on `DEMO_KEY` and AI summaries come back empty.

## What `init.sh` does

- Creates `.env` from `.env.example` (mode `600`) if it doesn't exist, and tops
  up an existing `.env` with any keys added since it was written. It never
  overwrites a value you have already set.
- Generates strong random values for `MONGO_ROOT_PASSWORD`,
  `BETTER_AUTH_SECRET`, `CRON_SECRET` and `ADMIN_PANEL_PASSWORD`, and prints the
  admin password once.
- Derives `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `CORS_ORIGINS` and
  `ADMIN_PANEL_HOSTS` from your domain. Auth and CORS break in confusing ways if
  these don't match the URL people actually visit.
- Detects Docker or Podman and builds/starts the stack.
- Requests the certificate over HTTP-01 and restarts the proxy into HTTPS mode.
- Warns up front about the things that usually break a first deploy: ports
  already bound, DNS not pointing here, `DEMO_KEY`, missing AI keys.

Re-running it is safe and is the normal way to add a domain, add the admin
subdomain, or repair a failed certificate issuance.

### Useful flags

```bash
./init.sh --domain example.com --email you@example.com   # normal production run
./init.sh --staging                                      # LE staging CA, no rate limits
./init.sh --skip-ssl                                     # HTTP only, for now
./init.sh --domain localhost --self-signed               # local HTTPS testing
./init.sh --no-admin-domain                              # don't expose admin.<domain>
./init.sh --engine docker                                # force an engine
./init.sh -y                                             # never prompt (CI)
```

## How HTTPS works

```
                    :80 / :443
                        │
                  ┌─────▼──────┐
                  │   proxy    │  nginx: TLS, HTTP→HTTPS redirect,
                  │  (nginx)   │  ACME challenge, routing
                  └──┬──────┬──┘
              /api/  │      │  everything else
                 ┌───▼──┐ ┌─▼──────┐
                 │server│ │ client │  nginx serving the built PWA
                 └───┬──┘ └────────┘
                     │
                ┌────▼────┐
                │ mongodb │  127.0.0.1:27017 only
                └─────────┘
```

- The proxy **starts in HTTP-only mode** when no certificate exists, serving both
  the site and `/.well-known/acme-challenge/`. That's what avoids the classic
  deadlock where nginx won't start without a certificate and certbot can't get
  one because nginx isn't serving the challenge.
- It re-renders its own config and reloads within a minute of a certificate
  appearing, and reloads every ~6 hours to pick up renewals.
- The `certbot` service renews every 12 hours (`certbot renew` is a no-op until a
  certificate is within 30 days of expiry).
- Certificates live in the `letsencrypt` named volume, so `down`/`up` cycles and
  rebuilds keep them. They are *not* in the repo working tree.

### Checking on it

```bash
./scripts/compose.sh logs -f proxy
./scripts/compose.sh run --rm --entrypoint certbot certbot certificates
./scripts/compose.sh exec proxy nginx -T | head -50     # rendered config
curl -sI https://example.com | head -3
```

### Renewing manually

```bash
./scripts/compose.sh run --rm --entrypoint certbot certbot renew --force-renewal
./scripts/compose.sh restart proxy
```

## Ports and exposure

| Service | Host binding      | Notes                                            |
| ------- | ----------------- | ------------------------------------------------ |
| proxy   | `80`, `443`       | The only public surface. Override with `HTTP_PORT`/`HTTPS_PORT`. |
| server  | none              | Reached only through the proxy at `/api/`.        |
| client  | none              | Reached only through the proxy.                   |
| mongodb | `127.0.0.1:27017` | Localhost only, for `mongosh` from the host.      |

Neither the API nor the admin panel is published directly any more. Publishing
`3000` would have put both on the internet with no TLS, which also meant admin
login could never work: the admin session cookie is `Secure` in production, so
the browser refuses to store it over plain HTTP.

Suggested firewall:

```bash
ufw allow OpenSSH
ufw allow 80,443/tcp
ufw enable
```

## The admin panel

`/admin` is rendered by the **server** container and is gated on the request
hostname, so it is only reachable on a host listed in `ADMIN_PANEL_HOSTS`
(plus `localhost`/`127.0.0.1`, always). In production that means
`admin.<your-domain>`:

1. Add an A record for `admin.example.com` pointing at the VPS.
2. Re-run `./init.sh` — it adds the name to the certificate, renders an nginx
   server block for it, and sets `ADMIN_PANEL_HOSTS`.
3. Log in at `https://admin.example.com/admin` with `ADMIN_PANEL_PASSWORD`
   from `.env`.

## Updating a running deployment

```bash
cd ~/TransparencyCheck
git pull
./scripts/compose.sh up -d --build
```

Only changed services are recreated, so there is no full-stack outage. Pushing to
`master` does the same thing automatically via `.github/workflows/deploy.yml`,
which needs these repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, and
optionally `VPS_SSH_PORT`. The workflow assumes the repo is already cloned at
`~/TransparencyCheck` and that `init.sh` has been run there once.

## Backups

Everything that matters is in the `mongodb_data` volume:

```bash
# Dump
./scripts/compose.sh exec -T mongodb mongodump \
  --username admin --password "$(awk -F= '$1=="MONGO_ROOT_PASSWORD"{print $2}' .env)" \
  --authenticationDatabase admin --archive --db transparency_check \
  > backup-$(date +%F).archive

# Restore
./scripts/compose.sh exec -T mongodb mongorestore \
  --username admin --password "$(awk -F= '$1=="MONGO_ROOT_PASSWORD"{print $2}' .env)" \
  --authenticationDatabase admin --archive --drop < backup-2026-01-01.archive
```

Keep a copy of `.env` somewhere safe too — losing `BETTER_AUTH_SECRET` logs
every user out, and `MONGO_ROOT_PASSWORD` cannot be recovered from the volume.

## Troubleshooting

**Certificate issuance fails.** Check that `dig +short example.com` returns the
server's IP and that `curl http://example.com/healthz` from *outside* the VPS
returns `ok`. If that path doesn't work, ACME validation can't either. Use
`--staging` while debugging: the production CA rate-limits 5 failures per
hostname per hour.

**Still serving HTTP after issuance.** Confirm the file is where the proxy looks:
`./scripts/compose.sh exec proxy ls /etc/letsencrypt/live/`. The directory name
must equal `DOMAIN` in `.env` — `init.sh` pins it with `--cert-name`, but a
certificate issued by hand may have landed in `example.com-0001`.

**Port 80 already in use.** Usually a host nginx or apache from an earlier
install: `sudo systemctl disable --now nginx`. Or move the proxy with
`HTTP_PORT`/`HTTPS_PORT` in `.env` — but Let's Encrypt then can't validate, so
put something else in front on 80/443.

**Login or API calls fail with CORS/origin errors.** `BETTER_AUTH_URL`,
`BETTER_AUTH_TRUSTED_ORIGINS` and `CORS_ORIGINS` must contain the exact origin
you're browsing, scheme included. Re-running `init.sh` after changing `DOMAIN`
fixes them.

**Admin panel returns 500.** `ADMIN_PANEL_PASSWORD` is empty in `.env`.

**Admin login redirects back to the login page.** You are on HTTP; the session
cookie is `Secure`. Finish the HTTPS setup.

**`MONGO_ROOT_PASSWORD is required`.** Compose refuses to start without it, on
purpose — the old `password123` fallback shipped a known database password to
production. Run `./init.sh` to generate one.

**Out of disk.** Container logs are capped (10 MB × 3 per service), so the usual
culprit is old build layers: `docker image prune -f` (or `podman image prune -f`).

## Local development

`init.sh` works on a laptop, but for day-to-day work skip containers:

```bash
bun install
cp .env.example .env       # fill in CONGRESS_API_KEY, OPENAI_API_KEY, DATABASE_URL
bun run dev:server         # http://localhost:3000
bun run dev:client         # http://localhost:5173
```

The dev client calls `/api` on its own origin, so point it at a local server via
Vite's proxy or run the containerized stack with `./init.sh --skip-ssl`.
