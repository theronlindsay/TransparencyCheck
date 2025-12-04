# TransparencyCheck - AI Agent Instructions

## Project Overview

Congressional legislation tracking dashboard built with **SvelteKit 2 + Svelte 5** and **SQLite** (via native `sqlite3`). The app syncs data from Congress.gov API and provides AI-powered bill summarization via OpenAI.

## Architecture

### Data Flow
```
Congress.gov API → +page.server.js (sync) → SQLite → Server Load → Svelte Components
                                              ↓
                                    API Routes (/api/*) → External Clients
```

### Key Directories
- `src/lib/db/` - Database layer (schema, queries, migrations, bill operations)
- `src/routes/` - SvelteKit routes with server-side data loading
- `src/lib/Components/` - Reusable Svelte 5 components
- `db/` - SQLite database file (`transparency.sqlite`)

## Database Patterns

### Schema-Driven Migrations
Tables are defined in `src/lib/db/schema.js` with inline migrations:
```javascript
// Each table can have migrations that run on init
migrations: [{
  name: 'add_column',
  check: async (db) => /* return true if migration needed */,
  apply: `ALTER TABLE ... ADD COLUMN ...`
}]
```

### Query Helpers (`src/lib/db/queries.js`)
- `query(sql, params)` - Returns multiple rows (SELECT)
- `queryOne(sql, params)` - Returns single row
- `execute(sql, params)` - For INSERT/UPDATE/DELETE
- `transaction(callback)` - Wraps operations in transaction

### JSON in SQLite
Complex fields (latestAction, policyArea, sponsors) are stored as JSON strings and parsed on read:
```javascript
latestAction: bill.latestAction ? JSON.parse(bill.latestAction) : null
```

## Svelte 5 Patterns

### Runes Syntax (Required)
This project uses Svelte 5 runes - do NOT use Svelte 4 syntax:
```svelte
// ✅ Correct - Svelte 5
let { data } = $props();
let count = $state(0);
let doubled = $derived(count * 2);

// ❌ Wrong - Svelte 4
export let data;
let count = 0;
$: doubled = count * 2;
```

### Component Props Pattern
```svelte
<script>
  let { id = '', title = '', onclick = null } = $props();
</script>
```

### Event Handlers
Use `onclick` instead of `on:click`:
```svelte
<button onclick={handleClick}>Click</button>
```

## Server-Side Data Loading

### Background Sync Pattern
The homepage (`src/routes/+page.server.js`) uses streaming:
```javascript
export async function load() {
  await initDatabase();
  return {
    bills: syncAndFetchBills() // Returns promise, streams to client
  };
}
```

### Bill Detail Loading (`src/routes/bill/[id]/+page.server.js`)
- Fetches bill with joins (sponsors, committees)
- Lazily fetches text versions from Congress.gov if not cached
- Downloads and stores bill text content (HTML/PDF) on first access

## API Routes

### Proxy Endpoints
- `/api/fetch-bill-text` - Proxies Congress.gov bill text (avoids CORS)
- `/api/pdf` - Proxies PDF documents
- `/api/openAI` - OpenAI chat completions wrapper

### API Key Pattern
```javascript
import { CONGRESS_API_KEY } from '$env/static/private';
const url = `${baseUrl}?api_key=${CONGRESS_API_KEY}`;
```

## Environment Variables

Required in `.env` or `.env.local`:
```
CONGRESS_API_KEY=your-key     # Congress.gov API
OPENAI_API_KEY=your-key       # OpenAI for summarization
```

## Development Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Prettier + ESLint check
npm run format   # Auto-format code
```

## Component Patterns

### Bill Card Component
`Bill.svelte` expects these props (matching database schema):
- `id`, `number`, `title`, `sponsors[]`, `committee`, `statusTag`, `latestAction`, `updatedAt`

### AI Summarizer Component
`AISummarizer.svelte` builds dynamic prompts with:
- Reading level selection
- Focus topics
- Custom questions
- Bill text injection (strips HTML before sending)

## CSS Conventions

Uses CSS custom properties defined globally:
```css
var(--bg-secondary)
var(--accent)
var(--border-color)
var(--radius-lg)
var(--text-primary)
```

## Important Gotchas

1. **Database Path**: Hardcoded relative path in `connection.js` - runs from project root
2. **Congress.gov Rate Limits**: API calls should be batched; background sync limits to 20 bills
3. **PDF Proxy**: PDFs must be proxied through `/api/pdf` to display in iframe
4. **JSON Parsing**: Always null-check before `JSON.parse()` on database fields
5. **Text Content**: Bill text stored in `bill_text_versions.content` with `contentFetched` flag

## Tauri Desktop/Mobile App

The app supports Tauri builds for Linux and Android. Tauri apps are thin clients that connect to the VPS backend.

### Architecture
- **VPS Server**: Runs SvelteKit with Node adapter, handles SQLite/API routes
- **Tauri Client**: Static build that calls VPS API endpoints

### API URL Configuration (`src/lib/config.js`)
```javascript
import { apiUrl } from '$lib/config.js';
// Use apiUrl() for all fetch calls to API routes
fetch(apiUrl('/api/openAI'), { ... })
```

Update `VPS_API_URL` in `src/lib/config.js` to point to your server.

### Build Commands
```bash
npx tauri build              # Linux desktop
npx tauri android build      # Android APK
npx tauri android dev        # Android dev (requires preview server)
```

### Key Files
- `src-tauri/tauri.conf.json` - Tauri configuration
- `src-tauri/capabilities/default.json` - HTTP permissions
- `svelte.config.js` - Auto-switches adapter (node vs static) based on `TAURI_ENV_PLATFORM`
