# TransparencyCheck Monorepo Structure

This is an npm workspaces monorepo with separate client and server applications.

## Directory Structure

```
TransparencyCheck/
├── apps/
│   ├── client/          # Static SvelteKit app (PWA)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── svelte.config.js
│   │   ├── vite.config.js
│   │   ├── eslint.config.js
│   │   └── jsconfig.json
│   └── server/          # Node.js SvelteKit API server
│       ├── src/
│       ├── package.json
│       ├── svelte.config.js
│       ├── vite.config.js
│       ├── eslint.config.js
│       └── jsconfig.json
├── docker/              # Docker configs for deployment
├── static/              # Shared static assets
└── package.json         # Root workspace config
```

## Development

### Install Dependencies
```bash
npm install
npm run install:all
```

### Run Development Servers
```bash
# Client (PWA) - http://localhost:5173
npm run dev:client

# Server (API) - http://localhost:3000
npm run dev:server
```

### Build for Production
```bash
# Build both apps
npm run build

# Or build individually
npm run build:client
npm run build:server
```

## Configuration Files

Each app has its own:
- **package.json** - Dependencies specific to that app
- **svelte.config.js** - SvelteKit adapter (static for client, node for server)
- **vite.config.js** - Vite plugins and configuration
- **eslint.config.js** - Linting rules with appropriate globals
- **jsconfig.json** - VS Code IntelliSense and path resolution

## Docker Deployment

The docker-compose setup builds and deploys both apps:
- **Client**: Nginx serving static files on port 8080 (HTTP) and 8443 (HTTPS)
- **Server**: Node.js API server on port 3000

See [README-SSL.md](README-SSL.md) for HTTPS setup.

## Capacitor Mobile App

The client app can be built as an Android app using Capacitor:
```bash
cd apps/client
npx cap sync android
npx cap open android
```

See [capacitor.config.json](capacitor.config.json) for mobile app configuration.
