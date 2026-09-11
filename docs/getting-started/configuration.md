# Configuration

After completing the [Installation](./installation.md), WireManager needs to be configured before it can be used. This page covers the environment variables setup and the initial setup wizard.

## Environment Variables

WireManager uses environment variables for its core configuration. These variables are set in the Docker Compose file created during the installation step.

### Database (`wiremanager-db`)

The MySQL container requires the following variables:

| Variable             | Description                        | Example              |
| -------------------- | ---------------------------------- | -------------------- |
| `MYSQL_ROOT_PASSWORD`| Root password for the MySQL server | `MyRootPassword123!` |
| `MYSQL_DATABASE`     | Name of the database to create     | `wiremanager`        |
| `MYSQL_USER`         | Application database user          | `wireadmin`          |
| `MYSQL_PASSWORD`     | Password for the application user  | `MySecurePass456!`   |

### Backend API (`wiremanager-api`)

The backend connects to the database and handles user authentication using these variables:

| Variable       | Description                                                                              | Default                 |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| `DB_HOST`      | Hostname or IP of the MySQL server                                                       | `localhost`             |
| `DB_PORT`      | MySQL port                                                                               | `3306`                  |
| `DB_NAME`      | Database name                                                                            | `wiremanager`           |
| `DB_USER`      | Database user                                                                            | `wireadmin`             |
| `DB_PASS`      | Database password                                                                        | `AdminPassword`         |
| `FRONTEND_URL` | Public URL or domain of the frontend web application (used for SSO/OIDC redirects)       | `http://localhost:3000` |

:::caution

The `DB_NAME`, `DB_USER`, and `DB_PASS` values **must match** the corresponding `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` values set on the database container. A mismatch will prevent the backend from connecting to the database.

:::

:::info SSO Redirection with FRONTEND_URL

When Single Sign-On (SSO / OpenID Connect) is enabled, the backend API redirects the user's browser back to the web console after completing the Identity Provider callback (`/sso-login?token=...`).

Set `FRONTEND_URL` to the public address where users access WireManager in their browsers — for example, `http://192.168.1.100:3002` or `https://vpn.yourdomain.com`.

:::

**Example configuration:**

```yaml
# wiremanager-db
environment:
  - MYSQL_ROOT_PASSWORD=MyRootPassword123!
  - MYSQL_DATABASE=wiremanager
  - MYSQL_USER=wireadmin
  - MYSQL_PASSWORD=MySecurePass456!

# wiremanager-api
environment:
  - DB_HOST=wiremanager-db
  - DB_PORT=3306
  - DB_NAME=wiremanager
  - DB_USER=wireadmin
  - DB_PASS=MySecurePass456!
  - FRONTEND_URL=http://192.168.1.100:3002
```

:::tip

When using Docker Compose with a shared network, use the **container name** (e.g., `wiremanager-db`) as `DB_HOST` instead of an IP address. Docker's internal DNS will resolve it automatically.

:::

### Frontend (`wiremanager-web`)

The frontend requires the backend API URL:

| Variable       | Description                                      | Default                       |
| -------------- | ------------------------------------------------ | ----------------------------- |
| `API_BASE_URL` | Full URL of the backend API (protocol + host + port) | `http://localhost:7254`    |

In a Docker Compose setup, this should point to the backend container's internal address:

```yaml
environment:
  - API_BASE_URL=http://wiremanager-api:8080
```

:::info

The frontend never exposes the backend API directly to the browser. All requests from the client are proxied through the Next.js server-side routes, which forward them to the backend with the appropriate authentication headers.

:::

## Shared Volume

The backend API and the WireGuard container must share the same configuration volume. This allows WireManager to read and write WireGuard configuration files.

```yaml
# Both containers must mount the same host path:
wireguard:
  volumes:
    - /path/to/wireguard/config:/config

wiremanager-api:
  volumes:
    - /path/to/wireguard/config:/app/config
```

:::caution

Replace `/path/to/wireguard/config` with the actual path on your host system where WireGuard configuration files should be stored. This path must be the **same** for both containers.

:::

## Docker Socket Access

The backend API requires access to the Docker socket to manage the WireGuard container (e.g., restarting it after configuration changes).

```yaml
wiremanager-api:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  group_add:
    - "989"  # GID of the docker group on the host
```

To find the correct GID on your system, run:

```bash
getent group docker
```

The output will look like `docker:x:989:`. Use the number shown as the `group_add` value.

## Initial Setup Wizard

Once all containers are running, open your browser and navigate to:

```text
http://<server-ip>:3002
```

On the first access, WireManager will automatically detect that no initial configuration exists and redirect you to the **Setup Wizard**.

### Step 1: Admin Credentials

The wizard requires you to create the first administrator account:

| Field              | Requirements                   |
| ------------------ | ------------------------------ |
| **Username**       | Minimum 3 characters           |
| **Password**       | Minimum 6 characters           |
| **Confirm Password** | Must match the password field |

This account will have full administrative privileges, including the ability to create additional user accounts after the setup is complete.

### Step 2: WireGuard Container

You need to specify the **name of the Docker container** where WireGuard is running. WireManager uses this name to interact with the container via the Docker socket (e.g., to apply configuration changes).

| Field                        | Default      | Description                                      |
| ---------------------------- | ------------ | ------------------------------------------------ |
| **WireGuard Container Name** | `wg_server`  | The `container_name` of your WireGuard container  |

:::info

This value must match the `container_name` defined in your Docker Compose file. If you used the example from the [Installation](./installation.md) page, the container name is `wireguard`.

:::

### Step 3: Complete Setup

Click **"Completa Setup"** to finalize the configuration. WireManager will:

1. Save the system configuration (execution mode, firewall engine, container name) to the database.
2. Create the administrator account with the credentials provided.
3. Mark the setup as completed, preventing the wizard from appearing again.

You will then be redirected to the **login page**.

## First Login

After completing the setup wizard, log in using the administrator credentials you just created.

Once authenticated, you will have access to the full WireManager dashboard, where you can:

- Add and configure WireGuard server interfaces.
- Create and manage peers (VPN clients).
- Define services, tags, and access policies.
- Monitor peer usage and connection status.

## Security Notes

### JWT Authentication

WireManager uses **JWT (JSON Web Tokens)** for API authentication. On first startup, a cryptographically secure 256-bit secret key is automatically generated and stored at:

```text
/app/config/wg_confs/jwt.secret
```

This file is persisted within the shared volume. If it is deleted, a new key will be generated on the next startup, **invalidating all existing sessions**.

:::caution

The `jwt.secret` file contains the signing key for all authentication tokens. Protect the shared volume and do not expose this file publicly.

:::

### Password Security

All passwords are hashed using **BCrypt** before being stored in the database. Plain-text passwords are never persisted.

## Automatic Database Migrations

The backend automatically applies any pending database migrations on startup. There is no manual migration step required — simply update the container image and restart the service.

## Next Steps

After completing the configuration, proceed to the [First Steps](./first-step.md) guide to create your first WireGuard server, service, tag, and peer.
