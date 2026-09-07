# TransparencyCheck

A SvelteKit/Svelte dashboard for congressional bills, representative finances, stock disclosures and AI summaries. The Bun workspace contains a static PWA client and a server backed by MongoDB.

## Standalone Docker deployment

The stack runs **MongoDB, client, server and Traefik** with Docker Compose. Traefik redirects HTTP to HTTPS and automatically obtains and renews Let's Encrypt certificates. It uses a file provider; no Docker socket or Dokploy installation is required.

Requirements:

- Linux VPS with Docker Engine, Docker Compose v2 and OpenSSL.
- A domain with three DNS names pointing to the VPS: app, API and admin. Publish AAAA records only if IPv6 routing works.
- TCP ports **80 and 443** accessible from the internet and unused by another proxy. HTTP port 80 is required for certificate validation.
- Budget around **2 GiB RAM as a starting point**, then measure your workload. The configured container limits total 1,248 MiB, leaving room on a 2 GiB host for the OS and Docker. Builds require additional memory; full FEC imports may need substantially more resources and disk space. A 512 MiB/1 GiB host is not the target for this all-in-one configuration.

Run:

```sh
./init.sh
```

On the first run this creates a private `.env` file with unique random secrets. Edit:

- `APP_DOMAIN`, `API_DOMAIN`, `ADMIN_DOMAIN`: hostnames only, without a scheme or path.
- `ACME_EMAIL`: your certificate contact email.
- `CONGRESS_API_KEY`: needed to populate bills and representatives.
- Optional provider keys for AI, FEC fallback, stock disclosures, GitHub OAuth, payments and uploads.

Then run `./init.sh` again. It validates Compose, builds images sequentially and starts the services with health checks. Certificates may take a little longer to issue after containers become healthy.

Alternatively, copy `.env.example` to `.env`, generate each secret separately with `openssl rand -hex 32`, then run:

```sh
docker compose config --quiet
docker compose --parallel 1 build
docker compose up -d --wait
```

Mongo passwords in this setup should be hex strings because the app password is embedded in its connection URI. Keep `.env` private. The build context excludes environment files.

Open `https://<APP_DOMAIN>`. The API is at `https://<API_DOMAIN>` and the admin panel at `https://<ADMIN_DOMAIN>/admin`; sign in there with `ADMIN_PANEL_PASSWORD`. Configure a GitHub OAuth callback at `https://<API_DOMAIN>/api/auth/callback/github` if using GitHub sign-in.

Only Traefik publishes host ports. MongoDB is on an internal network and the server uses a dedicated database user. Client and server are reachable through Traefik. The server trusts forwarded headers only in this private-proxy deployment; do not publish port 1776 directly. The three names should be subdomains of the same site for browser cookie compatibility.

For certificate testing, set `ACME_CA_SERVER` to the staging URL shown in `.env.example`; staging certificates are deliberately untrusted. Use a separate test Compose project/volumes, then deploy production with the default CA so a staging certificate is not retained in the production certificate store.

Configuration references: [Traefik file provider](https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/), [ACME](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/), [MongoDB cache configuration](https://www.mongodb.com/docs/manual/core/wiredtiger/).

The default is MongoDB 7.0. Local testing found that the current MongoDB 8.0 image refuses to start on this host's newer Linux kernel. `MONGO_IMAGE` can select a compatible release for your VPS; do not change major versions against an existing data volume without following MongoDB's upgrade procedure. MongoDB 7.0 is supported through August 31, 2027; plan an upgrade before then. See the [MongoDB lifecycle](https://www.mongodb.com/legal/support-policy/lifecycles) and [kernel compatibility notes](https://www.mongodb.com/docs/manual/administration/production-notes/).

## Small VPS behavior

- Server: 384 MiB limit, Bun `--smol`, two database pools capped at five connections each.
- MongoDB 7.0: 640 MiB limit and 0.25 GiB WiredTiger cache. Cache size is not a total-process memory limit.
- Client: 96 MiB; Traefik: 128 MiB. Override these limits in `.env` after measurement.
- PDF downloads: one active download, 20 MiB maximum, 30-second deadline, validated Congress.gov/GovInfo URLs and redirects. Identical downloads share work. Cached responses stream from disk. Cache cleanup on downloads limits stored files to 128 and 256 MiB, with seven-day expiry.
- Bill text downloads have the same source/redirect restrictions, a 2 MiB byte cap, one active downloader and a 15-second deadline.
- Searches return local results first and refresh at most once per query/date combination every five minutes. One search refresh can run at a time; other queries use their local results. Streamed searches can append new results after refresh; non-streamed searches return cached results immediately.
- Background jobs share one in-process execution guard. Overlapping cron requests return HTTP 409; nested finance/bulk work remains allowed. **Run one server instance**; the guard is not a distributed lock. Do not run separate import CLI processes alongside server jobs.
- Full national FEC finance imports are disabled by default (`FEC_BULK_FINANCE_ENABLED=false`). Metadata imports and provider-backed functionality remain available. Enabling full finance imports downloads, scans and writes entire national datasets; plan storage and memory before enabling them. The default per-ZIP download cap is 2 GiB (`FEC_BULK_MAX_DOWNLOAD_BYTES`), with a 120-second idle timeout. Temporary ZIPs use disk-backed storage and are cleaned on failure and restart.
- Unchanged FEC datasets skip automatic cache rebuilds. The admin representative page can explicitly rebuild caches, including retrying failed profiles.
- Routine HTTP logs and full AI prompt logs are disabled. Docker rotates each service's logs at 10 MiB × 3 files; the admin viewer retains the last 500 bounded messages in process memory. It resets on restart. Outside Compose, optional `ADMIN_FILE_LOGGING=true` requires your own file rotation.
- Traefik limits public API traffic to 20 in-flight requests and per-client rate limits. Admin operations use a separate router so long maintenance jobs do not occupy public API slots.

## Updates, logs and backups

```sh
# Build on a larger machine/CI when the VPS cannot spare build memory.
# With local source builds, serialize them:
docker compose --parallel 1 build
docker compose up -d --wait

docker compose ps
docker compose stats --no-stream
docker compose logs --tail=100 server traefik
```

Changing the API hostname requires rebuilding the client because its API URL is compiled into the static bundle. Mongo credentials are initialized only when the data volume is empty; changing `.env` does not change existing MongoDB users.

Persistent volumes store MongoDB data, PDF cache, temporary import files and certificates. `docker compose down` preserves them. **`docker compose down -v` deletes them.** Back up the database and `.env` before migrating or updating a production deployment. Existing external/Dokploy databases are not automatically copied to the new MongoDB service. If the source database runs a newer major version, select a compatible target version before restoring; do not treat a restore as an automatic downgrade.

Example database backup (credentials stay inside the container; the host receives only the archive):

```sh
mkdir -p backups
chmod 700 backups
umask 077
docker compose exec -T mongodb sh -c 'exec mongodump --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db transparency_check --archive --gzip' > backups/transparency-check.archive.gz
```

For a consistent backup on standalone MongoDB, stop writes while dumping (for example, stop the server briefly). Copy archives off the VPS. To migrate an existing database, take an archive from that database and restore the application database into this stack before opening traffic; preserve your existing `BETTER_AUTH_SECRET` if retaining accounts/sessions.

## Background jobs

Bill refresh starts automatically and runs every 15 minutes. Finance and stock jobs are manual or invoked by your own scheduler; Compose does not install a cron schedule. Run them from the admin panel or, from the VPS:

```sh
docker compose exec -T server bun -e 'const r = await fetch("http://127.0.0.1:1776/api/cron/sync-finance", {headers: {authorization: `Bearer ${process.env.CRON_SECRET}`}}); console.log(await r.text()); process.exit(r.ok ? 0 : 1)'
```

Other endpoints: `/api/cron/sync-fec-bulk`, `/api/cron/sync-stocks`, `/api/cron/check-bills`. Saved-bill status checking still uses the existing mock status logic. Schedule jobs off-peak, without overlapping runs.

## Local development

```sh
bun install --frozen-lockfile
bun run dev:client
bun run dev:server
```

Local server development needs `DATABASE_URL` pointing to a reachable MongoDB instance and the relevant provider keys in the server environment. Production Compose constructs `DATABASE_URL` automatically; its MongoDB port is intentionally not exposed for host development. Vite proxies client `/api` calls to port 1776.

```sh
bun run build
cd apps/server
bun run test
```

Client build output: `apps/client/build/`; server output: `apps/server/build/`. Android builds use Capacitor in `apps/client`; set `VITE_API_BASE_URL` to your HTTPS API origin before building.
