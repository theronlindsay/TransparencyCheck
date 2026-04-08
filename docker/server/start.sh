#!/bin/sh

echo "Starting TransparencyCheck Server..."

echo "Starting bun server..."
exec bun apps/server/build

