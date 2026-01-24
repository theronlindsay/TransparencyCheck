#!/bin/bash

# Generate self-signed SSL certificates for local development
# For production, use Let's Encrypt or proper CA-signed certificates

mkdir -p ssl

# Generate private key and certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "✅ SSL certificates generated in ./ssl directory"
echo "⚠️  These are self-signed certificates for development only"
echo ""
echo "To use in production:"
echo "1. Replace with Let's Encrypt certificates using certbot"
echo "2. Or mount your CA-signed certificates to /etc/nginx/ssl in the container"
