#!/bin/sh

echo "Starting TransparencyCheck Server..."

# Let's ensure the DB exists and force push tables EVERY TIME for debugging. We know it works inside!
cd /app/apps/server
echo "Initializing/Checking SQLite Database tables..."
rm -rf /app/apps/server/db
ln -sf /app/db /app/apps/server/db
npx prisma@6.19.2 db push --schema=prisma/schema.sqlite.prisma --accept-data-loss --skip-generate

# Enable WAL mode so background writes don't block reads
echo "Enabling SQLite WAL mode..."
node -e "const Database = require('better-sqlite3'); const db = new Database('/app/db/transparency.sqlite'); db.pragma('journal_mode = WAL'); db.close(); console.log('✅ WAL mode enabled');" || echo "⚠️  Could not enable WAL mode"

cd /app

echo "Starting Node.js server..."
exec node -r dotenv/config apps/server/build

