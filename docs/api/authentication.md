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

WireManager distinguishes between the following privilege levels:

| Role | Scope | Permissions |
| :--- | :--- | :--- |
| **Anonymous** | Public | Access limited to `/api/setup` (initial onboarding), `/api/auth/login`, `/api/auth/sso/status`, `/api/auth/sso/login`, and `/api/peer/authorized` (reverse proxy verification). |
| **Disabled** | Inactive / Locked | Access blocked across all application endpoints. Assigned by default to newly provisioned SSO users until explicitly approved by an Administrator. |
| **Operator** | Operational Management | Can create and update peers, toggle peer active/inactive states, download `.conf` profiles, generate QR codes, inspect real-time bandwidth telemetry, configure personal MFA, and read policy tags. |
| **Admin** | Full System Administration | All Operator permissions plus: server deployment, user account creation and deletion, role assignment, policy tag creation, SSO/OIDC configuration, and audit logs. |
| *`SSO_Exchange`* | Internal System Flow | Short-lived (1-minute) token role used exclusively to complete the handoff from `/sso-login` to `/api/auth/sso/exchange`. |
| *`mfa`* | Internal System Flow | Intermediate token role issued upon successful credential verification when MFA is enabled. Restricts access exclusively to `POST /api/auth/mfa/verify`. |

### Self-Protection Safeguards
To prevent accidental administrative lockout:
- **Self-Deletion Guard**: Administrators cannot delete their own account.
- **Self-Demotion Guard**: Administrators cannot demote their own account role from `Admin` to `Operator` or `Disabled`.

---

## Rate Limiting Protection

To protect against credential brute-forcing, password guessing, automated dictionary attacks, and TOTP code enumeration, all endpoints under the `/api/auth` controller are secured by an ASP.NET Core sliding-window rate limiter (`[EnableRateLimiting("Auth")]`).

### Policy Specifications

| Parameter | Configuration | Description |
| :--- | :--- | :--- |
| **Algorithm** | Sliding Window Limiter | Partitions time into sliding segments to smooth request quotas across window boundaries |
| **Permit Limit** | `15` Requests | Maximum allowed requests within the active window |
| **Window Duration** | `1 Minute` (`60s`) | Total sliding window duration |
| **Segments Per Window** | `6` (10 seconds / segment) | Granularity for sliding expiration calculations |
| **Queue Limit** | `0` | Requests exceeding the limit are rejected immediately without queueing |
| **Rejection Status** | `429 Too Many Requests` | Returned whenever the request quota is exceeded |

:::warning Rate Limiter Thresholds
Automated scripts, tests, or integrations calling `/api/auth/login`, `/api/auth/mfa/verify`, or user management routes must respect the 15 req/min threshold. If a client receives an HTTP `429 Too Many Requests` response, it should pause execution and apply exponential backoff before retrying.
:::

---

## Authentication & User Management Endpoints

The following endpoints handle credential authentication, user management, Multi-Factor Authentication (MFA), and federated Single Sign-On (SSO):

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Anonymous | Authenticates credentials and returns a signed JWT Bearer token (or intermediate MFA token). |
| `POST` | `/api/auth/register` | Admin | Registers a new user account with an assigned role (`Admin` or `Operator`). |
| `GET` | `/api/auth/users` | Admin | Retrieves a paginated list of system accounts (excludes the calling user). |
| `DELETE` | `/api/auth/users/{uuid}` | Admin | Deletes a user account by UUID. |
| `PATCH` | `/api/auth/users/{uuid}/role/{role}` | Admin | Updates a user's role (`Admin`, `Operator`, or `Disabled`). |
| `POST` | `/api/auth/mfa/enable` | Admin, Operator | Enables Multi-Factor Authentication and returns TOTP secret and setup URI. |
| `POST` | `/api/auth/mfa/disable` | Admin, Operator | Disables Multi-Factor Authentication for the authenticated local user. |
| `POST` | `/api/auth/mfa/verify` | `mfa` Bearer | Verifies 6-digit TOTP code and exchanges intermediate MFA token for session JWT. |
| `GET` | `/api/auth/mfa/enabled` | Admin, Operator | Returns whether MFA is active and whether user is an external SSO identity. |
| `GET` | `/api/auth/sso/status` | Anonymous | Returns whether SSO/OIDC authentication is currently enabled. |
| `GET` | `/api/auth/sso` | Admin | Retrieves the current SSO/OIDC configuration. |
| `PUT` | `/api/auth/sso` | Admin | Updates the SSO/OIDC configuration settings. |
| `GET` | `/api/auth/sso/login` | Anonymous | Initiates the OpenID Connect authorization challenge redirect to the IdP. |
| `GET` | `/api/auth/sso/callback` | OidcCookie | Processes IdP authentication callback and redirects to the frontend exchange page. |
| `GET` | `/api/auth/sso/exchange` | `SSO_Exchange` Bearer | Exchanges temporary exchange token for a permanent session JWT. |

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

**Standard Authentication (MFA Disabled):**
Returns a permanent 2-hour session JWT token populated with the user's operational role (`Admin` or `Operator`):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6ImEyYjNjNGQ1LWU2ZjctODlhYi05YzA5LTEyMzQ1Njc4OTBhYiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiJhZG1pbiIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IkFkbWluIiwiZXhwIjoxNzI1NDY4MDAwLCJpc3MiOiJXaXJlTWFuYWdlciIsImF1ZCI6IldpcmVNYW5hZ2VyQ2xpZW50cyJ9...",
  "date": "2026-09-04 15:30:00"
}
```

**MFA Challenge Required (MFA Enabled):**
When TOTP Multi-Factor Authentication is active for the local account, the returned JWT embeds the intermediate `mfa` role claim:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...role\":\"mfa\"...",
  "date": "2026-09-13 00:00:00"
}
```

:::note Two-Stage Authentication Flow
When the returned token has role `mfa`, the client is restricted from operational routes (`/api/peer`, `/api/server`, etc.). The client must provide this token in the `Authorization: Bearer <mfa_token>` header to `POST /api/auth/mfa/verify` along with the user's 6-digit TOTP code to obtain the final session JWT.
:::

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

### 6. Get SSO Status (`GET /api/auth/sso/status`)

Checks whether OpenID Connect Single Sign-On is enabled on the system. Used by login interfaces to conditionally render the "Sign in with SSO" button.

#### Request
```http
GET /api/auth/sso/status HTTP/1.1
Host: localhost:5070
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "enabled": true
}
```

---

### 7. Get SSO Configuration (`GET /api/auth/sso`)

Retrieves the current OpenID Connect federated authentication configuration. **Requires Admin role.**

#### Request
```http
GET /api/auth/sso HTTP/1.1
Host: localhost:5070
Authorization: Bearer <admin_token>
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "id": 1,
  "oidcEnabled": true,
  "oidcAuthority": "https://auth.example.com/realms/wiremanager",
  "oidcClientId": "wiremanager",
  "oidcClientSecret": "sec_98f7a1b2c3d4e5f6..."
}
```

---

### 8. Update SSO Configuration (`PUT /api/auth/sso`)

Updates or saves the OpenID Connect federated settings. Changes take effect dynamically in memory. **Requires Admin role.**

#### Request
```http
PUT /api/auth/sso HTTP/1.1
Host: localhost:5070
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "oidcEnabled": true,
  "oidcAuthority": "https://auth.example.com/realms/wiremanager",
  "oidcClientId": "wiremanager",
  "oidcClientSecret": "sec_98f7a1b2c3d4e5f6..."
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `oidcEnabled` | Boolean | Yes | Enables or disables SSO authentication. |
| `oidcAuthority` | String (URI) | When enabled | Base discovery URL of the OIDC Identity Provider. |
| `oidcClientId` | String | When enabled | Client Identifier configured in the Identity Provider. |
| `oidcClientSecret` | String | When enabled | Confidential client secret from the Identity Provider. |

#### Response (`200 OK`)
```http
HTTP/1.1 200 OK
Content-Length: 0
```

---

### 9. Initiate SSO Challenge (`GET /api/auth/sso/login`)

Initiates the OpenID Connect Authorization Code with PKCE challenge.

#### Request
```http
GET /api/auth/sso/login HTTP/1.1
Host: localhost:5070
```

#### Response (`302 Found`)
Redirects the user's browser to the Identity Provider's authorization endpoint.

---

### 10. Exchange SSO Token (`GET /api/auth/sso/exchange`)

Exchanges the temporary single-use token (role `SSO_Exchange`, 1-minute expiration) generated by `/api/auth/sso/callback` for a permanent 2-hour session JWT containing the user's actual role.

#### Request
```http
GET /api/auth/sso/exchange HTTP/1.1
Host: localhost:5070
Authorization: Bearer <temp_exchange_token>
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "date": "2026-09-11 13:00:00"
}
```

:::note Account Activation Gate
If the user account is in the `Disabled` state (the default for new SSO registrations), the frontend exchange route intercepts the token claims and blocks session creation, directing the user to contact an administrator for role assignment.
:::

---

### 11. Enable Multi-Factor Authentication (`POST /api/auth/mfa/enable`)

Enables Time-Based One-Time Password (TOTP) two-factor authentication for the authenticated local user account. Generates a cryptographically random 20-byte Base32 secret, securely encrypts it in the database using ASP.NET Core Data Protection (`WireManager.MFA.Secret`), sets `mfaEnabled = true`, and returns the plaintext secret along with a standard `otpauth://` URI.

**Requires Admin or Operator role.**

:::note Local Accounts Only
Multi-Factor Authentication on local accounts is exclusively available for local database users. If an external federated identity (SSO / OIDC) invokes this endpoint, the API rejects the request with HTTP `400 Bad Request` (`"Identities cannot enable mfa"`), as MFA policy for SSO accounts is managed directly within the upstream Identity Provider.
:::

#### Request
```http
POST /api/auth/mfa/enable HTTP/1.1
Host: localhost:5070
Authorization: Bearer <session_token>
```

#### Response (`200 OK`)
```json
{
  "secret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  "otpauthUri": "otpauth://totp/WireManager:admin?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=WireManager"
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `secret` | String | Plaintext Base32-encoded 20-byte secret key for manual entry into authenticator applications. |
| `otpauthUri` | String (URI) | Standard Key URI scheme formatted as `otpauth://totp/WireManager:<username>?secret=<secret>&issuer=WireManager`, ready to be encoded into a QR code for mobile authenticator apps (Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden). |

#### Response (`400 Bad Request`)
```text
Identities cannot enable mfa
```

---

### 12. Disable Multi-Factor Authentication (`POST /api/auth/mfa/disable`)

Disables TOTP Multi-Factor Authentication for the authenticated local user account, clears the encrypted secret from the database, and sets `mfaEnabled = false`.

**Requires Admin or Operator role.**

#### Request
```http
POST /api/auth/mfa/disable HTTP/1.1
Host: localhost:5070
Authorization: Bearer <session_token>
```

#### Response (`200 OK`)
```http
HTTP/1.1 200 OK
Content-Length: 0
```

#### Response (`400 Bad Request`)
```text
Identities cannot enable mfa
```

---

### 13. Verify MFA Code (`POST /api/auth/mfa/verify`)

Validates a 6-digit TOTP code during the two-stage login sequence. Requires presenting the intermediate JWT token issued by `POST /api/auth/login` (containing claim `role: "mfa"`).

Upon successful validation against the stored secret (using a verification window of ±1 step, equivalent to ±30 seconds), the endpoint generates and returns a permanent 2-hour session JWT token populated with the user's actual operational role (`Admin` or `Operator`).

**Requires `mfa` Bearer token.**

#### Request
```http
POST /api/auth/mfa/verify HTTP/1.1
Host: localhost:5070
Authorization: Bearer <intermediate_mfa_token>
Content-Type: application/json

{
  "code": "482910"
}
```

| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `code` | String | Yes | Exactly 6 digits | The 6-digit TOTP code currently generated by the user's authenticator app. |

#### Response (`200 OK`)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6ImEyYjNjNGQ1LWU2ZjctODlhYi05YzA5LTEyMzQ1Njc4OTBhYiIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiJhZG1pbiIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IkFkbWluIiwiZXhwIjoxNzI1NDY4MDAwLCJpc3MiOiJXaXJlTWFuYWdlciIsImF1ZCI6IldpcmVNYW5hZ2VyQ2xpZW50cyJ9...",
  "date": "2026-09-13 00:00:00"
}
```

#### Response (`400 Bad Request`)
Returned if the code is invalid/expired or if MFA is not enabled for the user:
```text
The code is not valid
```

---

### 14. Get MFA Status (`GET /api/auth/mfa/enabled`)

Retrieves the Multi-Factor Authentication activation status and identity provider linkage for the currently authenticated user.

**Requires Admin or Operator role.**

#### Request
```http
GET /api/auth/mfa/enabled HTTP/1.1
Host: localhost:5070
Authorization: Bearer <session_token>
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "isEnabled": true,
  "isIdentity": false
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `isEnabled` | Boolean | `true` if TOTP two-factor authentication is active on this account; otherwise `false`. |
| `isIdentity` | Boolean | `true` if the account is associated with an external SSO/OIDC Identity Provider (preventing local MFA configuration); `false` for local database accounts. |

---

### 15. Using the Bearer Token

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
| **`401 Unauthorized`** | Missing, invalid, or expired JWT token, or failed initial credentials | Re-authenticate by calling `POST /api/auth/login` to obtain a fresh token, then retry the request. |
| **`403 Forbidden`** | User holds `Operator` role but requested an `Admin` endpoint, or presenting intermediate `mfa` token to non-MFA routes | Ensure proper role credentials are used for privileged operations; complete MFA verification first. |
| **`400 Bad Request`** | Malformed username/password, invalid role payload, invalid TOTP code, or attempting local MFA on an SSO identity | Verify payload formatting and error message string. For MFA verification, submit the current 6-digit authenticator code. |
| **`429 Too Many Requests`** | Exceeded the rate limit quota (15 requests per minute sliding window) on `/api/auth` endpoints | Halt requests immediately and implement exponential backoff or wait for the 1-minute window to slide before retrying. |

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

- **[Single Sign-On (SSO / OIDC) Concept](../concepts/sso.md)** — Architectural model, two-phase token exchange, and Zero-Trust user approval.
- **[Configure SSO Guide](../guides/sso-configuration.md)** — Step-by-step instructions for Keycloak, Entra ID, and Authentik.
- **[API Overview](./overview.md)** — Architectural model, base URLs, and functional domains.
- **[Peer Management API](./peers.md)** — Complete endpoint reference for client peers and telemetry.
- **[API Reference](./reference.md)** — Comprehensive catalog of all available API endpoints.
- **[External Authentication Concept](../concepts/external-auth.md)** — Reverse proxy forward-auth integration.
