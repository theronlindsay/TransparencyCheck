# TransparencyCheck

Dashboard for tracking U.S. congressional legislation with AI-powered bill summarization. Built with **SvelteKit 2 + Svelte 5** and **SQLite** (via native `sqlite3`). Syncs data from Congress.gov API and provides OpenAI-powered summaries.

## Architecture

This is an **npm workspaces monorepo** with two applications:

- **Client** (`apps/client/`) — Static PWA with offline support (SvelteKit + adapter-static)
- **Server** (`apps/server/`) — Node.js API server with SQLite database (SvelteKit + adapter-node)

The client app can be deployed as:

- Static site served by Nginx (Docker)
- Android mobile app via Capacitor

## Prerequisites

- Node.js 18+ (Node 22 recommended)
- npm (bundled with Node)
- Docker & Docker Compose (for containerized deployment)

## Installation

```bash
npm install
npm run install:all  # Installs dependencies for all workspace apps
```

The SQLite database (`apps/server/src/lib/db/transparency.sqlite`) is created automatically on first run. Bills are synced from Congress.gov when you visit the homepage.

## Environment Variables

Create a `.env` file in the project root:

```bash
CONGRESS_API_KEY=your-key     # Required - Congress.gov API key
OPENAI_API_KEY=your-key       # Required - OpenAI for bill summarization
```

[Request a Congress.gov API key](https://api.congress.gov/) if you don't have one.

## Development

```bash
# Start client dev server (http://localhost:5173)
npm run dev:client

# Start server dev server (http://localhost:3000)
npm run dev:server
```

## Production Build & Deployment

### Option 1: Docker Deployment (Recommended)

The easiest way to deploy is using Docker Compose, which runs both client and server:

```bash
# Generate SSL certificates (see README-SSL.md for production certs)
.\generate-ssl-certs.ps1  # Windows
./generate-ssl-certs.sh   # Linux/Mac

# Build and start containers
docker-compose up -d
```

Access the app at:

- **HTTPS**: https://localhost:8443
- **HTTP**: http://localhost:8080 (redirects to HTTPS)

The server runs on port 3000 (internal to Docker network).

See [README-SSL.md](README-SSL.md) for Let's Encrypt setup and production HTTPS configuration.

### Option 2: Manual Build

```bash
# Build both apps
npm run build

# Or build individually
npm run build:client  # Output: apps/client/build/
npm run build:server  # Output: apps/server/build/
```

To run the server in production:

```bash
cd apps/server
npm run start  # Runs Node.js server on port 3000
```

Serve the client static files (`apps/client/build/`) with Nginx or any static host.

### Option 3: Android App (Capacitor)

Build the client as an Android APK:

```bash
cd apps/client
VITE_API_BASE_URL=https://your-api-domain.com npm run build
npx cap sync android
npx cap open android  # Opens in Android Studio
```

Set `VITE_API_BASE_URL` to your deployed API origin when building for Android.

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
│       │   │   │   ├── schema.js      # Table definitions
│       │   │   │   ├── queries.js     # Query helpers
│       │   │   │   ├── bills.js       # Bill operations
│       │   │   │   └── connection.js  # SQLite connection
│       │   │   └── bill-fetcher.js    # Congress.gov sync
│       ├── package.json
│       ├── svelte.config.js     # Uses adapter-node
│       └── vite.config.js
├── docker/
│   ├── client/
│   │   ├── dockerfile
│   │   └── nginx.conf       # HTTPS + redirect config
│   ├── server/
│   │   └── dockerfile
├── docker-compose           # Orchestrates client + server
└── package.json             # Workspace root

```

## API Endpoints (Server)

- `/api/openAI` — OpenAI chat completions for bill summarization
- `/api/fetch-bill-text` — Proxies Congress.gov bill text (avoids CORS)
- `/api/pdf` — Proxies PDF documents for iframe display
- `/api/bills` — Returns bill data from SQLite
- `/api/search-bills` — Full-text search across bills

## Database

Bills sync automatically via background process on homepage load (fetches 20 most recent bills). Schema includes:

- `bills` — Core bill data with JSON fields for complex structures
- `people` — Sponsors and legislators
- `committees` — Congressional committees
- `bill_actions` — Legislative action timeline
- `bill_text_versions` — Cached bill text content

Database location: `apps/server/src/lib/db/transparency.sqlite` (or `/app/db/transparency.sqlite` in Docker)

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
```

## Tech Stack

- **Frontend**: Svelte 5, SvelteKit 2, Vite, PWA
- **Backend**: SvelteKit API routes, Node.js
- **Database**: SQLite3 (native)
- **AI**: OpenAI GPT-4
- **Mobile**: Capacitor (Android)
- **Deployment**: Docker, Nginx, PM2

## Docker Deployment

The docker-compose setup builds and deploys both apps:

- **Client**: Nginx serving static files on port 8080 (HTTP) and 8443 (HTTPS)
- **Server**: Node.js API server on port 3000

See [README-SSL.md](README-SSL.md) for HTTPS setup.

## Capacitor Mobile App

The client app can be built as an Android app using Capacitor:

```bash
cd apps/client
VITE_API_BASE_URL=https://your-api-domain.com npm run build
npx cap sync android
npx cap open android
```

Use your deployed API origin for `VITE_API_BASE_URL` (for example, `https://api.example.com`).

See [capacitor.config.json](capacitor.config.json) for mobile app configuration.

## Configuration Files

Each app has its own:

* **package.json** - Dependencies specific to that app
* **svelte.config.js** - SvelteKit adapter (static for client, node for server)
* **vite.config.js** - Vite plugins and configuration
* **eslint.config.js** - Linting rules with appropriate globals
* **jsconfig.json** - VS Code IntelliSense and path resolution

## Additional Documentation

- [README-SSL.md](README-SSL.md) — HTTPS setup with Let's Encrypt
- [MONOREPO.md](MONOREPO.md) — Detailed monorepo structure guide
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — AI coding assistant context
