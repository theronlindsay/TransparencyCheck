# TransparencyCheck

Dashboard for tracking U.S. congressional legislation with AI-powered bill summarization. Built with **SvelteKit 2 + Svelte 5** and **SQLite** (via native `sqlite3`). Syncs data from Congress.gov API and provides OpenAI-powered summaries.

## Prerequisites

- Node.js 18+ (Node 22 recommended)
- npm (bundled with Node)

## Installation

```bash
npm install
```

The SQLite database (`db/transparency.sqlite`) is created automatically on first run. Bills are synced from Congress.gov when you visit the homepage.

## Environment Variables

Create a `.env` or `.env.local` file:

```bash
CONGRESS_API_KEY=your-key     # Required - Congress.gov API key
OPENAI_API_KEY=your-key       # Required - OpenAI for bill summarization
```

[Request a Congress.gov API key](https://api.congress.gov/) if you don't have one.

## Development

```bash
npm run dev
```

Open <http://localhost:5173> to browse the bill dashboard.

## Production Build & Deployment

Built for Node.js deployment on DigitalOcean VPS:

```bash
npm run build    # Creates production build in /build
npm run start    # Runs the Node.js server
```

The app uses `@sveltejs/adapter-node` for standalone Node deployment.

## Project Structure

- `src/routes/` — SvelteKit routes with server-side data loading
- `src/lib/db/` — Database layer (schema, queries, migrations)
- `src/lib/Components/` — Reusable Svelte 5 components
- `src/routes/api/` — API endpoints (OpenAI proxy, bill text fetcher, PDF proxy)
- `db/` — SQLite database file

## API Endpoints

- `/api/openAI` — OpenAI chat completions for bill summarization
- `/api/fetch-bill-text` — Proxies Congress.gov bill text (avoids CORS)
- `/api/pdf` — Proxies PDF documents for iframe display

## Database

Bills sync automatically via background process on homepage load (fetches 20 most recent bills). Schema includes:

- `bills` — Core bill data with JSON fields for complex structures
- `people` — Sponsors and legislators
- `committees` — Congressional committees
- `bill_actions` — Legislative action timeline
- `bill_text_versions` — Cached bill text content

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Prettier + ESLint check
npm run format   # Auto-format code
```
