# Introduction

This guide explains how to install WireManager on your infrastructure.

## Requirements

Before proceeding with the installation, make sure you have the following installed:

- Docker
- Docker Compose

## Installation

The first step is to create the Docker Compose file that will be used throughout this documentation as the base configuration.

:::info

WireManager does not include a built-in WireGuard instance. This separation ensures that an issue within WireManager cannot compromise the VPN network itself.

:::

```yaml
version: "3.8"

networks:
  wiremanager_net:
    name: wiremanager_net
    driver: bridge
    ipam:
      config:
        - subnet: 172.31.0.0/16
          gateway: 172.31.0.1

services:

  # ==========================================
  # 1. WireGuard VPN Server
  # ==========================================
  wireguard:
    image: lscr.io/linuxserver/wireguard:latest
    container_name: wireguard
    restart: always

    environment:
      - TZ=Europe/Rome
      - PUID=1000
      - PGID=1000

    ports:
      - "51820:51820/udp"

    volumes:
      - /path/into/server:/config
      - /lib/modules:/lib/modules:ro

    cap_add:
      - NET_ADMIN
      - SYS_MODULE

    networks:
      wiremanager_net:
        ipv4_address: 172.31.0.3

  # ==========================================
  # 2. WireManager Backend API (.NET)
  # ==========================================
  wiremanager-api:
    image: ghcr.io/gwsimorod/wiremanager:latest
    container_name: wiremanager_api
    user: "1000:1000"
    restart: always

    depends_on:
      - wireguard
      - wiremanager-db

    ports:
      - "5070:8080"

    environment:
      - DB_HOST=
      - DB_PORT=
      - DB_NAME=
      - DB_USER=
      - DB_PASS=

    volumes:
      - /path/into/server:/app/config
      - /var/run/docker.sock:/var/run/docker.sock

    group_add:
      - "989"

    networks:
      wiremanager_net:
        ipv4_address: 172.31.0.5

  # ==========================================
  # 3. WireManager Frontend (Next.js)
  # ==========================================
  wiremanager-web:
    image: ghcr.io/gwsimorod/wiremanager-web:latest
    container_name: wiremanager_web
    restart: always

    depends_on:
      - wiremanager-api

    ports:
      - "3002:3000"

    environment:
      - API_BASE_URL=http://wiremanager-api:8080

    networks:
      wiremanager_net:
        ipv4_address: 172.31.0.2

  # ==========================================
  # 4. MySQL Database
  # ==========================================
  wiremanager-db:
    image: mysql:8.0
    container_name: wiremanager_db
    restart: always

    environment:
      - MYSQL_ROOT_PASSWORD=
      - MYSQL_DATABASE=
      - MYSQL_USER=
      - MYSQL_PASSWORD=

    volumes:
      - /path/into/server:/var/lib/mysql

    networks:
      wiremanager_net:
        ipv4_address: 172.31.0.4
```

:::caution

This documentation uses a static network configuration inside the Compose file to prevent containers from receiving different IP addresses after a restart.

Stable IP addresses are required for the future External Authentication integration with Nginx Proxy Manager, covered later in this documentation.

:::

:::tip

The `group_add` value (`989` in this example) corresponds to the GID of the `docker` group on the host system, required to grant the `wiremanager-api` container access to `/var/run/docker.sock`.

This value can vary between systems. Check it on your host by running:

```bash
getent group docker
```

Update the `group_add` field in the Compose file with the GID returned for your system.

:::

Once the Compose file has been created, run the following command from within the same directory:

```bash
docker compose up -d
```

You can now access the web interface at:

```text
http://ip-del-server:3002
```

## Next Steps

After completing the installation, proceed to the [Configuration](./configuration.md) page for the initial setup of WireManager.
