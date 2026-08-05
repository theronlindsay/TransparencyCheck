# TransparencyCheck

Dashboard for tracking U.S. congressional legislation with AI-powered bill summarization. Built with **SvelteKit 2 + Svelte 5** and **MongoDB**. Syncs data from the Congress.gov API and provides AI-generated summaries.

## Architecture

This is a **bun workspaces monorepo** with two applications:

- **Client** (`apps/client/`) — Static PWA with offline support (SvelteKit + adapter-static)
- **Server** (`apps/server/`) — Node.js API server backed by MongoDB (SvelteKit + adapter-node)

The client app can be deployed as:

- Static site served by Nginx (Docker)
- Android mobile app via Capacitor

## Prerequisites

- Bun (includes a Node.js-compatible runtime) — for local development
- Docker Engine + Compose plugin, or Podman + `podman-compose` — for deployment

## Deploy it

```bash
git clone https://github.com/theronlindsay/TransparencyCheck.git
cd TransparencyCheck
./init.sh --domain example.com --email you@example.com
```

That's the whole deployment: MongoDB, the API, the PWA and an nginx edge proxy
with an auto-renewing Let's Encrypt certificate. Run `./init.sh` with no
arguments to serve plain HTTP on the machine's IP instead, and re-run it with a
domain whenever you're ready for HTTPS.

Full walkthrough, including DNS, firewall, the admin subdomain, backups and
troubleshooting: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Installation (local development)

```bash
bun install
cp .env.example .env
```

Fill in at least `CONGRESS_API_KEY`, `OPENAI_API_KEY` and `DATABASE_URL`
(a local `mongodb://…` URI). Bills sync from Congress.gov when you visit the
homepage.

## Environment Variables

Every supported variable is documented in [`.env.example`](.env.example);
`./init.sh` copies it to `.env` and generates the secrets. The ones you have to
supply yourself:

```bash
CONGRESS_API_KEY=your-key   # Required — https://api.congress.gov/sign-up/
OPENAI_API_KEY=your-key     # Required for AI summaries (or OPENROUTER_API_KEY)
```

Secrets generated for you on first run: `MONGO_ROOT_PASSWORD`,
`BETTER_AUTH_SECRET`, `CRON_SECRET`, `ADMIN_PANEL_PASSWORD`.

## Development

```bash
# Start client dev server (http://localhost:5173)
bun run dev:client

# Start server dev server (http://localhost:3000)
bun run dev:server
```

## Production Build & Deployment

### Option 1: Containers (Recommended)

```bash
./init.sh --domain example.com --email you@example.com
```

This builds and starts five services and handles TLS end to end:

| Service   | Role                                                       | Host ports        |
| --------- | ---------------------------------------------------------- | ----------------- |
| `proxy`   | nginx: HTTPS termination, HTTP→HTTPS redirect, routing      | `80`, `443`       |
| `client`  | nginx serving the built PWA                                 | internal only     |
| `server`  | SvelteKit API (`/api/*`) and admin panel                    | internal only     |
| `mongodb` | Database                                                    | `127.0.0.1:27017` |
| `certbot` | Certificate renewal loop                                    | none              |

The proxy starts in HTTP-only mode, gets a certificate over HTTP-01, then
switches itself to HTTPS — no manual certificate juggling and no editing nginx
configs. Renewals happen automatically.

Day-to-day operations go through the engine-agnostic compose wrapper (it picks
Docker or Podman for you):

```bash
./scripts/compose.sh ps
./scripts/compose.sh logs -f server
./scripts/compose.sh up -d --build     # after a git pull
./scripts/compose.sh down
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for DNS, firewall, the admin
subdomain, backups and troubleshooting.

### Option 2: Manual Build

```bash
# Build both apps
bun run build

# Or build individually
bun run build:client  # Output: apps/client/build/
bun run build:server  # Output: apps/server/build/
```

To run the server in production:

```bash
cd apps/server
bun run start  # Runs the server on port 3000
```

Serve the client static files (`apps/client/build/`) with Nginx or any static host.

### Option 3: Android App (Capacitor)

Build the client as an Android APK:

```bash
cd apps/client
VITE_API_BASE_URL=https://transparencycheck.app bun run build
bunx cap sync android
bunx cap open android  # Opens in Android Studio
```

Set `VITE_API_BASE_URL` to your deployed API origin when building for Android.

### Automated Android Release (GitHub Actions)

The repository is configured with a GitHub Action (`android-build.yml`) that automatically builds the Android APK and creates a GitHub Release containing the APK file.

To trigger an automated build and release, create and push a git tag starting with `v` (e.g., `v1.0.0`):

```bash
git tag v1.0.0
git push origin v1.0.0
```

Alternatively, you can trigger it manually:
1. Go to your repository's **Actions** tab on GitHub.
2. Select the **Android Build & Release** workflow on the left.
3. Click the **Run workflow** button.

## Project Structure

```
TransparencyCheck/
├── apps/
│   ├── client/              # Static PWA client
│   │   ├── src/
│   │   │   ├── routes/      # SvelteKit routes
│   │   │   ├── lib/
│   │   │   │   ├── Components/  # Svelte 5 components
│   │   │   │   ├── stores/      # UI state management
│   │   │   │   └── config.js    # API URL configuration
│   │   ├── package.json
│   │   ├── svelte.config.js     # Uses adapter-static
│   │   └── vite.config.js       # PWA plugin
│   └── server/              # Node.js API server
│       ├── src/
│       │   ├── routes/api/  # API endpoints
│       │   ├── lib/
│       │   │   ├── db/      # Database layer
│       │   │   │   ├── mongo.js       # MongoDB driver connection
│       │   │   │   ├── mongoose.js    # Mongoose connection
│       │   │   │   └── adapters/      # Collection helpers
│       │   │   └── bill-fetcher.js    # Congress.gov sync
│       ├── package.json
│       ├── svelte.config.js     # Uses adapter-node
│       └── vite.config.js
├── docker/
│   ├── client/              # nginx image serving the built PWA
│   │   ├── dockerfile
│   │   └── nginx.conf
│   ├── proxy/              # nginx edge proxy: TLS, redirect, routing
│   │   ├── dockerfile
│   │   ├── templates/       # HTTP-only and HTTPS configs, rendered at start
│   │   └── render-config.sh
│   └── server/
│       └── dockerfile
├── docs/DEPLOYMENT.md      # VPS deployment guide
├── scripts/compose.sh      # Docker/Podman-agnostic compose wrapper
├── init.sh                 # One-command setup (env, secrets, HTTPS)
├── .env.example            # Every supported environment variable
├── docker-compose.yaml     # Orchestrates the five services
└── package.json            # Workspace root

```

## API Endpoints (Server)

- `/api/openAI` — OpenAI chat completions for bill summarization
- `/api/fetch-bill-text` — Proxies Congress.gov bill text (avoids CORS)
- `/api/pdf` — Proxies PDF documents for iframe display
- `/api/bills` — Returns bill data from MongoDB
- `/api/search-bills` — Full-text search across bills

## Floating AI Assistant

The client now uses a global floating AI assistant popup instead of the old bottom-nav AI tab.

### Behavior

- Floating circular launcher at bottom-left (above bottom nav).
- Always route-aware via a shared assistant context registry.
- Supports multiple page data sources through pluggable route registrations.
- On bill pages, a `Summarize this bill` suggestion appears above the chat input.
- Clicking that suggestion renders the existing bill summarizer layout as a card in chat.
- Sending chat messages asks questions against the current page context.

### Key Files

- `apps/client/src/lib/Components/AIAssistant.svelte`
- `apps/client/src/lib/Components/AIAssistantLauncher.svelte`
- `apps/client/src/lib/Components/AIAssistantPanel.svelte`
- `apps/client/src/lib/stores/assistant-context.js`

### Route Context Registration Example

Routes can register their own assistant data source:

1. Register with `registerAssistantSource(sourceId, config)`
2. Stream data with `updateAssistantSourceData(sourceId, data)`
3. Cleanup with `unregisterAssistantSource(sourceId)`

The bill route (`apps/client/src/routes/bill/[id]/+page.svelte`) is the first implementation.

Additional implementation details are tracked in:

- `.agents/references/AI_ASSISTANT_SUMMARIZER.md`

## Database

MongoDB, configured through `DATABASE_URL`. Bills sync automatically via a
background process on homepage load (fetches the 20 most recent bills).
Collections include:

- `bills` — Core bill data
- `people` — Sponsors and legislators
- `committees` — Congressional committees
- `bill_actions` — Legislative action timeline
- `bill_text_versions` — Cached bill text content

In the Docker deployment the database runs as the `mongodb` service, bound to
`127.0.0.1:27017` on the host and persisted in the `mongodb_data` volume. Set
`DATABASE_URL` in `.env` to use an external/managed MongoDB instead.

```bash
# Open a shell against the containerized database
./scripts/compose.sh exec mongodb mongosh \
  -u admin -p "$(awk -F= '$1=="MONGO_ROOT_PASSWORD"{print $2}' .env)" \
  --authenticationDatabase admin transparency_check
```

## Commands

```bash
# Development
npm run dev:client       # Start client dev server (port 5173)
npm run dev:server       # Start server dev server (port 3000)

# Production builds
npm run build            # Build both client and server
npm run build:client     # Build client only
npm run build:server     # Build server only

# Android (Capacitor)
cd apps/client
VITE_API_BASE_URL=https://your-api-domain.com npm run build
npx cap sync android
npx cap open android

# Code quality
npm run lint             # Prettier + ESLint check
npm run format           # Auto-format code

# Installation
npm run install:all      # Install all workspace dependencies

# Deployment (engine-agnostic: picks Docker or Podman)
./init.sh                # First-time setup, env + secrets + HTTPS
bun run docker:up        # Start the stack
bun run docker:logs      # Tail all logs
bun run docker:ps        # Service status
bun run docker:down      # Stop the stack
bun run deploy           # Rebuild and restart changed services
```

## Tech Stack

- **Frontend**: Svelte 5, SvelteKit 2, Vite, PWA
- **Backend**: SvelteKit API routes, Bun/Node runtime
- **Database**: MongoDB 8
- **Auth**: Better Auth (email/password + GitHub OAuth)
- **AI**: OpenAI / OpenRouter
- **Mobile**: Capacitor (Android)
- **Deployment**: Docker or Podman Compose, nginx (static + TLS proxy), Let's Encrypt

## Capacitor Mobile App

The client app can be built as an Android app using Capacitor:

```bash
cd apps/client
VITE_API_BASE_URL=https://your-api-domain.com npm run build
npx cap sync android
npx cap open android
```

Use your deployed API origin for `VITE_API_BASE_URL` (for example, `https://example.com`).
Leave it empty for the web/Docker build so the PWA calls `/api` on its own origin
through the proxy.

See [apps/client/capacitor.config.json](apps/client/capacitor.config.json) for mobile app configuration.

## Configuration Files

Each app has its own:

* **package.json** - Dependencies specific to that app
* **svelte.config.js** - SvelteKit adapter (static for client, node for server)
* **vite.config.js** - Vite plugins and configuration
* **eslint.config.js** - Linting rules with appropriate globals
* **jsconfig.json** - VS Code IntelliSense and path resolution

## Additional Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — VPS deployment, HTTPS, admin panel, backups
- [.env.example](.env.example) — Every supported environment variable
