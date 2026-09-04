# What is WireManager

**WireManager** is an on-premises management platform designed to simplify, streamline, and secure VPN networks built on **WireGuard**.

Through an intuitive web-based **GUI**, WireManager allows administrators to deploy and manage **servers** and **peers** without having to manually manipulate raw configuration files or terminal commands.

Beyond basic VPN tunnels, WireManager enables you to define internal **Services** within your private infrastructure, specifying parameters such as:

- Destination IP addresses;
- Transport protocols and target ports;
- Associated domain names (FQDNs).

Services can be grouped into policy **Tags**, making it easy to establish granular Role-Based Access Control (RBAC) and determine exactly which peers can communicate with specific internal applications.

Through this declarative tag model, WireManager automatically compiles and synchronizes **kernel firewall rules (`iptables`)** to enforce your network access policies in real time without manual terminal intervention.

Furthermore, WireManager seamlessly integrates with **Nginx Proxy Manager** via an **External Authentication** endpoint, extending the same Zero-Trust access policies to web services published behind a reverse proxy.

WireManager delivers a single, unified interface for your entire VPN infrastructure — bridging network tunnel management, least-privilege access policies, and application security while eliminating configuration drift.
