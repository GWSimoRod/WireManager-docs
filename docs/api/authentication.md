# API Authentication

The WireManager REST API uses **JSON Web Tokens (JWT)** (RFC 7519) to authenticate and authorize client requests. All operational endpoints — including peer management, server configuration, and policy orchestration — require a valid Bearer token transmitted in the HTTP request headers.

This document details the authentication lifecycle, JWT token structure and claims, Role-Based Access Control (RBAC), user management endpoints, client integration examples, and security best practices.

---

## Authentication Lifecycle

WireManager uses a stateless authentication model. Rather than maintaining server-side session cookies, clients submit user credentials to obtain a cryptographically signed JWT token, which is then presented in the `Authorization` header of subsequent requests.

```mermaid
sequenceDiagram
    autonumber
    actor Client as API Client (CLI / Script / Web UI)
    participant Auth as Auth Controller (/api/auth/login)
    participant DB as MySQL Database
    participant API as Protected Endpoint (/api/peer)

    Client->>Auth: POST /api/auth/login<br/>{ "username": "alice", "password": "..." }
    Auth->>DB: Query user record & verify BCrypt hash
    DB-->>Auth: User verified (Role: Admin, UUID: ...)
    Auth-->>Client: 200 OK<br/>{ "token": "eyJh...", "date": "..." }

    Note over Client: Client caches token in memory
    
    Client->>API: GET /api/peer<br/>Header: Authorization: Bearer eyJh...
    Note over API: Middleware validates JWT signature, expiration, & role
    API-->>Client: 200 OK [ List of Peers ]
```

---

## Token Specifications & Claims

WireManager generates symmetric JWT tokens signed with the **HMAC-SHA256** algorithm (`SecurityAlgorithms.HmacSha256Signature`).

### Token Attributes

| Attribute | Value | Description |
| :--- | :--- | :--- |
| **Algorithm** | `HS256` | Symmetric HMAC with SHA-256 hash |
| **Token Lifetime** | 2 Hours (`UTC + 2h`) | Duration before the token expires and re-authentication is required |
| **Issuer (`iss`)** | `WireManager` | The issuing authority |
| **Audience (`aud`)** | `WireManagerClients` | Target consumers of the token |

### Payload Claims

Each generated JWT payload embeds the following security claims:

```json
{
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "alice",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "Admin",
  "exp": 1725468000,
  "iss": "WireManager",
  "aud": "WireManagerClients"
}
```

- **`nameidentifier`**: The user's immutable unique UUID.
- **`name`**: The human-readable username.
- **`role`**: The authorization tier evaluated by ASP.NET Core `[Authorize(Roles = "...")]` policies.

---

## Role-Based Access Control (RBAC)

WireManager distinguishes between three privilege levels:

| Role | Scope | Permissions |
| :--- | :--- | :--- |
| **Anonymous** | Public | Access limited to `/api/setup` (initial onboarding), `/api/auth/login`, and `/api/peer/authorized` (reverse proxy verification). |
| **Operator** | Operational Management | Can create and update peers, toggle peer active/inactive states, download `.conf` profiles, generate QR codes, inspect real-time bandwidth telemetry, and read policy tags. |
| **Admin** | Full System Administration | All Operator permissions plus: server deployment, user account creation and deletion, role assignment, policy tag creation, and protected service catalog modifications. |

### Self-Protection Safeguards
To prevent accidental administrative lockout:
- **Self-Deletion Guard**: Administrators cannot delete their own account.
- **Self-Demotion Guard**: Administrators cannot demote their own account role from `Admin` to `Operator`.

---

## Authentication & User Management Endpoints

The following endpoints handle authentication and operator identities:

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Anonymous | Authenticates credentials and returns a signed JWT Bearer token. |
| `POST` | `/api/auth/register` | Admin | Registers a new user account with an assigned role (`Admin` or `Operator`). |
| `GET` | `/api/auth/users` | Admin | Retrieves a paginated list of system accounts (excludes the calling user). |
| `DELETE` | `/api/auth/users/{uuid}` | Admin | Deletes a user account by UUID. |
| `PATCH` | `/api/auth/users/{uuid}/role/{role}` | Admin | Updates a user's role (`Admin` or `Operator`). |

---

## Request & Response Payloads

### 1. Authenticate (`POST /api/auth/login`)

Generates a JWT Bearer token upon validating credentials.

#### Request
```http
POST /api/auth/login HTTP/1.1
Host: localhost:5070
Content-Type: application/json

{
  "username": "admin",
  "password": "SuperSecretPassword123!"
}
```

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `username` | String | Yes | Max 50 chars | The account username. |
| `password` | String | Yes | Max 128 chars | The account plaintext password. |

#### Response (`200 OK`)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6ImEyYjNjNGQ1LWU2ZjctODlhYi05YzA5LTEyMzQ1Njc4OTBhYiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiJhZG1pbiIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IkFkbWluIiwiZXhwIjoxNzI1NDY4MDAwLCJpc3MiOiJXaXJlTWFuYWdlciIsImF1ZCI6IldpcmVNYW5hZ2VyQ2xpZW50cyJ9...",
  "date": "2026-09-04 15:30:00"
}
```

---

### 2. Register New User (`POST /api/auth/register`)

Creates a new administrator or operator account. **Requires Admin role.**

#### Request
```http
POST /api/auth/register HTTP/1.1
Host: localhost:5070
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "username": "john.operator",
  "password": "SecurePassword2026!",
  "role": "Operator"
}
```

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `username` | String | Yes | 3–50 chars | Unique username for the new account. |
| `password` | String | Yes | 8–128 chars | Strong password. Encrypted using BCrypt before persistence. |
| `role` | String | Yes | `"Admin"` or `"Operator"` | Access tier determining permitted actions across the API. |

#### Response (`200 OK`)
```http
HTTP/1.1 200 OK
Content-Length: 0
```

---

### 3. List Users (`GET /api/auth/users`)

Retrieves a paginated list of accounts, excluding the requesting user. **Requires Admin role.**

#### Request
```http
GET /api/auth/users?start=0&end=10&searchTerm=john HTTP/1.1
Host: localhost:5070
Authorization: Bearer <admin_token>
Accept: application/json
```

| Query Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `start` | Integer | `0` | Zero-based starting index. |
| `end` | Integer | `10` | Zero-based ending index (max 100 items per call). |
| `searchTerm` | String | `null` | Optional substring filter on usernames. |

#### Response (`200 OK`)
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
X-Total-Count: 1

[
  {
    "username": "john.operator",
    "role": "Operator",
    "uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
]
```

---

### 4. Update User Role (`PATCH /api/auth/users/{uuid}/role/{role}`)

Promotes or demotes an account. **Requires Admin role.** Cannot be executed on your own account.

#### Request
```http
PATCH /api/auth/users/f47ac10b-58cc-4372-a567-0e02b2c3d479/role/Admin HTTP/1.1
Host: localhost:5070
Authorization: Bearer <admin_token>
```

| Path Parameter | Type | Valid Values | Description |
| :--- | :--- | :--- | :--- |
| `uuid` | String (GUID) | Valid UUID | Target user's unique identifier. |
| `role` | String | `"Admin"`, `"Operator"` | The new role to assign to the user. |

#### Response (`200 OK`)
```http
HTTP/1.1 200 OK
Content-Length: 0
```

---

### 5. Delete User (`DELETE /api/auth/users/{uuid}`)

Permanently removes a user account. **Requires Admin role.** Cannot be executed on your own account.

#### Request
```http
DELETE /api/auth/users/f47ac10b-58cc-4372-a567-0e02b2c3d479 HTTP/1.1
Host: localhost:5070
Authorization: Bearer <admin_token>
```

#### Response (`200 OK`)
```http
HTTP/1.1 200 OK
Content-Length: 0
```

---

### 6. Using the Bearer Token

Attach the returned token to the `Authorization` header with the `Bearer` prefix for all authenticated API requests:

```http
GET /api/peer HTTP/1.1
Host: localhost:5070
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

---

## Client Integration Examples

### cURL

```bash
# 1. Login and capture JWT token
TOKEN=$(curl -s -X POST http://localhost:5070/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "SuperSecretPassword123!"}' \
  | jq -r '.token')

# 2. Query protected endpoint using the token
curl -X GET http://localhost:5070/api/peer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

---

### Python

```python
import requests

BASE_URL = "http://localhost:5070/api"

# 1. Authenticate
login_payload = {
    "username": "admin",
    "password": "SuperSecretPassword123!"
}
auth_resp = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
auth_resp.raise_for_status()

token = auth_resp.json()["token"]

# 2. Use token with session headers
session = requests.Session()
session.headers.update({"Authorization": f"Bearer {token}"})

# 3. Request protected resource
peers_resp = session.get(f"{BASE_URL}/peer")
print(peers_resp.json())
```

---

### JavaScript / TypeScript (fetch)

```typescript
const BASE_URL = 'http://localhost:5070/api';

async function fetchPeers() {
  // 1. Authenticate
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'SuperSecretPassword123!',
    }),
  });

  if (!loginRes.ok) throw new Error('Authentication failed');
  const { token } = await loginRes.json();

  // 2. Query protected route
  const peersRes = await fetch(`${BASE_URL}/peer`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  return await peersRes.json();
}
```

---

## Error Handling & Token Expiration

| Status Code | Scenario | Recommended Client Action |
| :--- | :--- | :--- |
| **`401 Unauthorized`** | Missing, invalid, or expired JWT token | Re-authenticate by calling `POST /api/auth/login` to obtain a fresh token, then retry the request. |
| **`403 Forbidden`** | User holds `Operator` role but requested an `Admin` endpoint | Ensure administrative credentials are used for privileged operations. |
| **`400 Bad Request`** | Malformed username/password or invalid role payload | Verify payload validation rules (e.g. minimum password length). |

:::note Re-Authentication Strategy
Because tokens have a 2-hour lifespan, long-running automation scripts or sidecars should implement a 401 retry interceptor: when an API call returns `401 Unauthorized`, re-execute the login request, refresh the cached token, and retry the failed call once.
:::

---

## Security Best Practices

:::tip Authentication Recommendations
1. **Always Use HTTPS in Production**: JWT tokens sent in plaintext over HTTP can be intercepted by network sniffers. Always deploy TLS via a reverse proxy (e.g., Nginx Proxy Manager) in production environments.
2. **Apply the Principle of Least Privilege**: Create dedicated `Operator` accounts for daily peer provisioning and automation scripts. Reserve `Admin` accounts strictly for infrastructure configuration.
3. **Never Hardcode Credentials in Code**: Store API usernames and passwords in environment variables, Kubernetes secrets, or secure vaults.
4. **Strong Password Policies**: The registration endpoint enforces minimum length constraints (minimum 8 characters for passwords). Use generated high-entropy passwords for automated service accounts.
:::

---

## Related Documentation

- **[API Overview](./overview.md)** — Architectural model, base URLs, and functional domains.
- **[API Reference](./reference.md)** — Comprehensive catalog of all available API endpoints.
- **[External Authentication Concept](../concepts/external-auth.md)** — Reverse proxy forward-auth integration.
