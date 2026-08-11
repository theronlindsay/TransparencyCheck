#!/bin/sh

echo "Starting TransparencyCheck Server..."

# --smol reduces Bun's JS heap baseline; pair with Dokploy memory limits.
echo "Starting bun server..."
exec bun --smol apps/server/build
