#!/bin/sh

echo "Starting TransparencyCheck Server..."

echo "Starting Node.js server..."
exec node -r dotenv/config apps/server/build

