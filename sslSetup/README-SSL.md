# HTTPS Setup Guide

The client now supports HTTPS through nginx. Follow these steps to set up SSL certificates.

## For Local Development (Self-Signed Certificates)

### On Linux/Mac:
```bash
chmod +x generate-ssl-certs.sh
./generate-ssl-certs.sh
```

### On Windows:
```powershell
.\generate-ssl-certs.ps1
```

This creates self-signed certificates in the `ssl/` directory that are valid for 1 year.

⚠️ **Note**: Browsers will show a security warning for self-signed certificates. This is normal for development.

## For Production (Let's Encrypt)

### Option 1: Using Certbot (Recommended)

1. Install certbot on your server:
```bash
sudo apt-get install certbot
```

2. Generate certificates:
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

3. Copy certificates to the ssl directory:
```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
```

4. Set up auto-renewal:
```bash
sudo certbot renew --dry-run
```

### Option 2: Using Docker with Certbot

Add a certbot service to docker-compose:

```yaml
services:
  certbot:
    image: certbot/certbot
    volumes:
      - ./ssl:/etc/letsencrypt
    command: certonly --webroot -w /var/www/certbot -d yourdomain.com --email your@email.com --agree-tos --no-eff-email
```

### Option 3: Manual Certificate Upload

If you have certificates from a CA (Certificate Authority):

1. Place your certificate files in the `ssl/` directory:
   - `cert.pem` - Your SSL certificate
   - `key.pem` - Your private key

2. Ensure proper permissions:
```bash
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem
```

## Starting the Services

Once certificates are in place:

```bash
docker-compose up -d
```

Access your application at:
- HTTP: http://localhost:8080 (redirects to HTTPS)
- HTTPS: https://localhost:8443

## Port Configuration

The docker-compose file exposes:
- Port 8080: HTTP (redirects to HTTPS)
- Port 8443: HTTPS

To change ports, edit the `docker-compose` file:
```yaml
ports:
  - "80:80"      # Standard HTTP
  - "443:443"    # Standard HTTPS
```

## Troubleshooting

### Certificate Errors
- Verify certificates exist in `ssl/` directory
- Check file permissions (key.pem should be 600)
- Ensure certificate and key match

### Connection Refused
- Check if ports 8080/8443 are available
- Verify docker containers are running: `docker-compose ps`
- Check nginx logs: `docker-compose logs client`

### Self-Signed Certificate Warnings
- Expected behavior for development
- To bypass in Chrome: type `thisisunsafe` on the warning page
- Or add certificate to your system's trusted root certificates
