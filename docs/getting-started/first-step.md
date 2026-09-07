# First Steps

This guide walks you through the essential first actions after completing the [Configuration](./configuration.md): creating a WireGuard server, defining a service, organizing it with a tag, and finally creating a peer with access to that service.

By the end of this guide, you will have a fully working VPN setup with a connected client and access policies in place.

## Overview

Here is the sequence of steps we will follow:

1. **Create a Server** — Define the WireGuard server interface.
2. **Create a Service** — Register a network service you want to protect.
3. **Create a Tag** — Group services under a logical label.
4. **Create a Peer** — Add a VPN client and assign the tag (automatically synced).
5. **Download & Connect** — Export the client configuration and connect.

:::info

This guide assumes you are logged in as an **Admin** user. Some actions (such as creating servers and services) are restricted to users with the Admin role.

:::

---

## Step 1: Create a WireGuard Server

Navigate to the **Dashboard** page. If no servers have been created yet, you will see an empty state with an **"Add your first server"** button.

Click **"Add Server"** to open the server creation dialog. Fill in the following fields:

| Field            | Description                                                  | Example               |
| ---------------- | ------------------------------------------------------------ | --------------------- |
| **Range IP**     | The VPN subnet in CIDR notation. All peers will receive an address within this range. | `10.0.0.0/24`         |
| **Listen Port**  | The UDP port WireGuard listens on. Must match the port exposed in the Docker Compose file. | `51820`               |
| **Endpoint**     | The public hostname or IP address that clients use to connect to the server. | `vpn.example.com`     |

Click **"Create"** to create the server. WireManager will automatically generate a key pair (private and public) for the server interface.

:::tip

The **Range IP** defines the private address space of your VPN. Common choices are `10.0.0.0/24` (254 clients) or `10.0.0.0/16` (65,534 clients). The first address in the range (e.g., `10.0.0.1`) is reserved for the server itself.

:::

---

## Step 2: Create a Service

Before creating a peer, it's useful to define the **services** that peers will be allowed to access. Services represent network resources (e.g., an SSH server, a web application, a database) that you want to protect behind the VPN.

Navigate to the **Services** page and click **"New Service"**. Fill in the following fields:

| Field              | Description                                                                 | Example             |
| ------------------ | --------------------------------------------------------------------------- | ------------------- |
| **Name**           | A descriptive name for the service.                                         | `SSH Access`        |
| **Protocol**       | The network protocol. Options: `TCP`, `UDP`, `SCTP`, `ICMP`, `ESP`, `GRE`, `IGMP`, `ALL`. | `TCP`            |
| **Port**           | The port number of the service. Automatically hidden for portless protocols like `ICMP` or `ALL`. | `22`              |
| **Target IP**      | The internal IP address of the machine hosting the service.                 | `192.168.1.50`      |
| **Domain**         | *(Optional)* The domain associated with the service, used for External Authentication with Nginx Proxy Manager. | `git.example.com` |
| **Global Service** | When enabled, all peers are automatically allowed access to this service (firewall rules are added globally). | Off               |

Click **"Create"** to save the service.

:::info

**Global vs Local services:**
- **Global services** (e.g., DNS, monitoring) are automatically allowed for all peers. Useful for infrastructure services that every client needs.
- **Local services** are only accessible by peers that have the appropriate tag assigned.

WireManager will suggest enabling "Global Service" when it detects common infrastructure service names (DNS, NTP, LDAP, etc.) in the service name.

:::

---

## Step 3: Create a Tag

Tags are used to group services together and define access policies. When a tag is assigned to a peer, the peer gains access to all services linked to that tag.

Navigate to the **Tags** page and click **"New Tag"**. Fill in the following fields:

| Field                 | Description                                                         | Example           |
| --------------------- | ------------------------------------------------------------------- | ----------------- |
| **Name**              | A descriptive name for the tag.                                     | `Developers`      |
| **Color**             | A color for visual identification. Choose from 16 presets or enter a custom hex value. | `#3B82F6`         |
| **Associated Services** | *(Optional)* Select the services that this tag should grant access to. | Select `SSH Access` |

Click **"Create"** to save the tag.

:::tip

You can create tags without associating services immediately. Services can be added or removed from a tag at any time by editing it.

:::

---

## Step 4: Create a Peer

Now it's time to create a VPN client. Navigate to the **Peers** page and click **"Add Peer"**.

Fill in the following fields:

| Field                    | Required | Description                                                                                           | Example           |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------- | ----------------- |
| **Client Name**          | Yes      | A name to identify this peer.                                                                         | `laptop-simon`    |
| **Address**              | No       | The VPN IP address for this peer. If left empty, WireManager will automatically assign the next available address in the server's range. | *(leave empty)*   |
| **DNS**                  | Yes      | The DNS server the peer should use.                                                                   | `1.1.1.1`         |
| **Allowed IPs**          | Yes      | The IP ranges the peer is allowed to route through the VPN tunnel. Use `0.0.0.0/0` to route all traffic. | `0.0.0.0/0`       |
| **Persistent KeepAlive** | No       | Interval in seconds for sending keepalive packets. Useful for peers behind NAT.                       | `25`              |
| **Server**               | Yes      | Select the WireGuard server this peer should connect to.                                              | *(select your server)* |

### Expiration

Optionally set an expiration for the peer. Expired peers are automatically deleted by a background worker.

- **Presets**: Choose from 1, 3, 5, 7, 14, or 30 days.
- **Custom**: Select a specific date and time.
- **None**: The peer never expires (default).

### Tag Assignment

In the **Tag (Policy)** section at the bottom of the form, select the tags you want to assign to this peer. Each selected tag grants the peer access to all services linked to that tag.

For this example, select the **Developers** tag we created in Step 3.

Click **"Create"** to create the peer. WireManager will:

1. Generate a key pair for the peer.
2. Assign an IP address (automatically if not specified).
3. Associate the selected tags with the peer.
4. Update the firewall rules to allow the peer access to the services linked to its tags.
5. Automatically synchronize the configuration with the running WireGuard container.

---

## Step 5: Download the Configuration

After creating the peer, you can export the WireGuard configuration to use on the client device. From the Peers page, find your new peer and use the action buttons:

- **Download `.conf`** — Downloads a WireGuard configuration file that can be imported into any WireGuard client (Windows, macOS, Linux, iOS, Android).
- **QR Code** — Generates a QR code that can be scanned directly by the WireGuard mobile app (iOS/Android).

:::tip

The downloaded `.conf` file contains the peer's private key, DNS settings, allowed IPs, and the server endpoint — everything needed to connect.

:::

---

## Automatic Synchronization & Manual Sync

WireManager automatically keeps your WireGuard configuration in sync with the running container:

- **Automatic Sync on Peer Changes**: Every time a peer is created, updated, enabled/disabled, or deleted, WireManager immediately rewrites the server configuration file and synchronizes the active WireGuard interface in real time. Your changes take effect right away without requiring manual intervention.
- **Manual Sync (On-Demand)**: A manual **"Sync"** button is available on each server card in the **Dashboard**. This is an optional maintenance feature designed for scenarios where you need to force a full re-sync (for example, after restarting the Docker host, recovering from container downtime, or troubleshooting connectivity).

:::tip

Because synchronization occurs automatically whenever peers or tags change, clients can connect and access authorized services immediately after downloading their `.conf` file or scanning their QR code.

:::

---

## Verify the Setup

At this point, you should have:

- ✅ A WireGuard server interface configured with an IP range and endpoint.
- ✅ A service registered with its IP, port, and protocol.
- ✅ A tag that groups the service.
- ✅ A peer assigned to the tag, with a downloaded configuration file.
- ✅ The server automatically synchronized with the running WireGuard container.

Import the `.conf` file into the WireGuard client on your device and activate the tunnel. You can verify the connection by:

1. Checking the **peer detail dialog** in the Peers page — click on the peer card to see live stats, last handshake time, and traffic usage.
2. Trying to reach the service's target IP from the connected client.

---

## Next Steps

Now that you have a working setup, you can explore more advanced features:

- **[Configure Access Policies](../guides/configure-access.md)** — Learn how to combine tags and services for fine-grained access control.
- **[Nginx Proxy Manager Integration](../guides/nginx-proxy-manager.md)** — Set up External Authentication to protect reverse-proxied services with VPN-based access policies.
