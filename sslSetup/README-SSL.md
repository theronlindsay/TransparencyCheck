# HTTPS deployment

HTTPS is now provided by Traefik in the root Docker Compose stack. See the [standalone deployment instructions](../README.md#standalone-docker-deployment).

The old certificate-generation scripts in this directory are legacy manual-development utilities. They are not used by the Docker stack. Do not run them for production: Traefik obtains and renews Let's Encrypt certificates and stores them in the `certificates` volume.
