# PowerShell script to generate self-signed SSL certificates for local development
# For production, use Let's Encrypt or proper CA-signed certificates

# Create ssl directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "ssl" | Out-Null

# Generate self-signed certificate
$cert = New-SelfSignedCertificate `
    -DnsName "localhost", "127.0.0.1" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(1) `
    -KeyExportPolicy Exportable `
    -KeySpec Signature `
    -KeyLength 2048 `
    -KeyAlgorithm RSA `
    -HashAlgorithm SHA256

# Export certificate
$certPassword = ConvertTo-SecureString -String "temp" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "ssl\cert.pfx" -Password $certPassword | Out-Null

# Convert to PEM format using OpenSSL (if available)
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    openssl pkcs12 -in ssl\cert.pfx -out ssl\cert.pem -nokeys -nodes -password pass:temp
    openssl pkcs12 -in ssl\cert.pfx -out ssl\key.pem -nocerts -nodes -password pass:temp
    Remove-Item ssl\cert.pfx
    Write-Host "✅ SSL certificates generated in .\ssl directory" -ForegroundColor Green
} else {
    Write-Host "⚠️  OpenSSL not found. Installing from winget..." -ForegroundColor Yellow
    Write-Host "Please run: winget install -e --id ShiningLight.OpenSSL" -ForegroundColor Yellow
    Write-Host "Then run this script again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "⚠️  These are self-signed certificates for development only" -ForegroundColor Yellow
Write-Host ""
Write-Host "To use in production:"
Write-Host "1. Replace with Let's Encrypt certificates using certbot"
Write-Host "2. Or mount your CA-signed certificates to /etc/nginx/ssl in the container"
