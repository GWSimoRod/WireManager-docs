# How to Manage Users and Roles

This guide explains how to manage administrative user accounts and configure Role-Based Access Control (RBAC) in WireManager. You will learn how to create new operator and administrator accounts, modify privileges, and safely remove access.

---

## Role-Based Access Control (RBAC) Overview

WireManager separates system responsibilities into distinct user roles:

```mermaid
graph TD
    subgraph Roles ["User Roles"]
        AdminRole["Admin Role<br/>(Red Badge)"]
        OperatorRole["Operator Role<br/>(Amber Badge)"]
        DisabledRole["Disabled Role<br/>(Gray Badge)"]
    end

    subgraph AdminCaps ["Admin Capabilities"]
        A1["User Management (Create / Delete / Role Change)"]
        A2["WireGuard Server Management"]
        A3["Policy, Tag & Service Catalog Configuration"]
        A4["Full Peer Lifecycle & Destructive Actions"]
        A5["Audit Logs & Security Trail Inspection"]
        A6["Single Sign-On (SSO / OIDC) Settings"]
    end

    subgraph OperatorCaps ["Operator Capabilities"]
        O1["Peer Provisioning & Modification"]
        O2["Download .conf & Generate QR Codes"]
        O3["Toggle Peer Active / Inactive States"]
        O4["View Telemetry, Tags, and Services (Read-Only)"]
    end

    subgraph DisabledCaps ["Disabled Capabilities"]
        D1["No Access to Web Console or APIs"]
    end

    AdminRole --> AdminCaps
    AdminRole --> OperatorCaps
    OperatorRole --> OperatorCaps
    DisabledRole --> DisabledCaps
```

### Role Capabilities Matrix

| Feature / Action | Admin | Operator | Disabled |
| :--- | :---: | :---: | :---: |
| **Manage Users** (Create, Delete, Change Role) | Yes | No | No |
| **SSO / OIDC Settings** (Configure OpenID Connect) | Yes | No | No |
| **Audit Logs** (View Security & System Event Trail) | Yes | No | No |
| **Manage Servers** (Create, Delete, Reconfigure Interfaces) | Yes | No | No |
| **Define Services & Tags** (Create, Modify, Delete) | Yes | No | No |
| **Peer Provisioning** (Create, Edit, Delete Peers) | Yes | Yes | No |
| **Distribute Configurations** (Download `.conf`, QR Code) | Yes | Yes | No |
| **Toggle Peer Status** (Active / Inactive) | Yes | Yes | No |
| **Monitor Telemetry** (Real-time throughput, graphs) | Yes | Yes | No |
| **View Catalog** (Read-only view of Tags and Services) | Yes | Yes | No |

---

## Prerequisites

To manage system users:
1. You must be logged in to WireManager with an account that has the **Admin** role.
2. The user management console is located at `http://<your-server>:3002/users` (or accessible via the **Users** link in the navigation menu).

:::note Access Restriction for Operators
Accounts with the **Operator** role do not see the User Management menu option and receive HTTP `403 Forbidden` if attempting to query `/api/auth/register` or `/api/auth/users`.
:::

---

## Step 1: Open the User Management Console

1. Log in to the WireManager web console with your administrator credentials.
2. In the navigation sidebar, click on **Users** (`/users`).

The page is divided into two operational panels:
- **Left / Top Panel**: Create New User form.
- **Right / Bottom Panel**: Existing Users table with live search and pagination.

```
+-------------------------------------------------------------------------+
|                              User Management                            |
+------------------------------------+------------------------------------+
|          Create New User           |           Existing Users           |
+------------------------------------+------------------------------------+
| Username: [ john.doe             ] | Search: [ Search users...        ] |
| Password: [ ********           (o) ] |                                    |
| Role:     [ ( ) Admin              | * admin (You)       [ Admin v ]    |
|             (*) Operator         ] | * john.doe          [ Operator v ] [x]
|                                    |                                    |
| [Create User]                      | Showing 1 to 2 of 2 users  < 1 >   |
+------------------------------------+------------------------------------+
```

---

## Step 2: Create a New User Account

To create a new operator or administrator:

1. In the **Create New User** form:
   - **Username**: Enter a unique username (minimum 3 characters, maximum 50 characters).
   - **Password**: Enter a secure password (minimum 8 characters, maximum 128 characters). Click the eye icon to toggle visibility.
   - **Role**: Select either **Operator** or **Admin**.
2. Click **Create Account**.
3. A success notification will confirm account creation, and the new user will immediately appear in the user table.

### Security Implementation Behind the Scenes
- The backend verifies that the username is not already taken.
- Passwords are encrypted using **BCrypt** with automatic salt generation before being stored in the database.
- Plaintext passwords are never logged, cached, or returned in API responses.

---

## Step 3: Search and Filter Existing Users

In larger organizations with multiple staff members, use the real-time search bar to filter accounts:

1. Type any portion of the username into the search bar.
2. The table applies a debounced filter (400ms delay) and updates dynamically.
3. Use the pagination controls at the bottom of the table to navigate through large user directories (5 users per page by default).

---

## Step 4: Change a User's Role

You can escalate or demote an account's privileges without having to recreate the account:

1. Locate the user in the **Existing Users** list.
2. Click the role dropdown selector next to the user's name:
   - Choose **Admin** to grant full administrative capabilities.
   - Choose **Operator** to restrict the account to peer operations.
   - Choose **Disabled** to immediately revoke all access and lock the account without deleting it.
3. The role change takes effect immediately via `PATCH /api/auth/users/{uuid}/role/{role}`.

:::caution Self-Demotion Protection
WireManager prevents administrators from changing their own role from `Admin` to `Operator` or `Disabled`. This built-in safety guard eliminates the risk of an administrator accidentally locking themselves out of the system.
:::

---

## Approving and Activating SSO Provisioned Users

When federated Single Sign-On (SSO / OIDC) is enabled, any employee who logs in via your Identity Provider for the first time is automatically registered in WireManager.

To enforce Zero-Trust access control, WireManager assigns the **`Disabled`** role by default to all newly provisioned SSO accounts:

1. The user will see an *"Account disabled / Contact administrator"* message upon their first login attempt.
2. An Administrator opens the **Users** (`/users`) page.
3. In the user directory, find the user's email or username — it will display a gray **Disabled** badge.
4. Click the role dropdown selector and change their role to **Operator** (or **Admin**).
5. The user can now log in immediately using the **Sign in with SSO** button.

:::tip Lock Inactive Accounts
Instead of permanently deleting an account when an employee is on leave or undergoing security review, you can simply change their role to `Disabled`. This revokes their active sessions and blocks further logins while preserving their account record and audit trails.
:::

---

## Step 5: Delete a User Account

When a staff member leaves the organization or no longer requires access:

1. Locate the target user in the list.
2. Click the **Delete** button (trash can icon) on the right side of the row.
3. Confirm the deletion in the confirmation dialog.
4. The user record is purged from the database, and any active sessions using that user's credentials will be rejected upon their next API call.

:::caution Self-Deletion Protection
Administrators cannot delete their own active account. If an account must be decommissioned, another administrator must perform the deletion.
:::

---

## Programmatic User Management via API

Automate user provisioning in your onboarding scripts using the REST API:

### 1. Register a User via cURL
```bash
# Retrieve Admin JWT Token
TOKEN=$(curl -s -X POST http://localhost:5070/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "AdminPassword123!"}' \
  | jq -r '.token')

# Create a new Operator account
curl -X POST http://localhost:5070/api/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "developer-ops",
    "password": "SecurePassword2026!",
    "role": "Operator"
  }'
```

### 2. List Users via cURL
```bash
curl -X GET "http://localhost:5070/api/auth/users?start=0&end=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

### 3. Change a User's Role via cURL
```bash
curl -X PATCH "http://localhost:5070/api/auth/users/<user-uuid>/role/Admin" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Delete a User via cURL
```bash
curl -X DELETE "http://localhost:5070/api/auth/users/<user-uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Best Practices & Security Recommendations

:::tip Administrative Security Checklist
1. **Default to Operator**: Assign the `Operator` role to team members who only need to add devices, reset VPN tunnels, or view network statistics. Reserve the `Admin` role for infrastructure leads.
2. **Dedicated Service Accounts**: For automated CI/CD pipelines or scripts that provision VPN peers, create a dedicated `Operator` account rather than using a personal administrator login.
3. **Prompt Offboarding**: Delete user accounts immediately upon an employee's departure. WireManager checks user validity during token generation and policy enforcement.
4. **Strong Passwords**: Enforce a strong password policy (at least 12 characters with a mix of letters, numbers, and symbols) for all accounts.
:::

---

## Related Documentation

- **[Configure Single Sign-On Guide](./sso-configuration.md)** — Setting up federated login with Keycloak, Entra ID, and Authentik.
- **[Single Sign-On Concepts](../concepts/sso.md)** — Two-phase token exchange and identity mapping.
- **[Inspect Audit Logs Guide](./audit-logs.md)** — Investigating security operations and administrative audit trails.
- **[API Authentication Guide](../api/authentication.md)** — In-depth details on JWT tokens, claims, and lifetimes.
- **[API Overview](../api/overview.md)** — Architectural model and base URL reference.
- **[Create a Peer Guide](./create-peer.md)** — Day-to-day peer provisioning workflow.
- **[Configure Access Policies](./configure-access.md)** — Setting up services and tags.
