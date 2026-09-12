# How to Configure Single Sign-On (SSO / OIDC)

This guide provides step-by-step instructions for integrating WireManager with an **OpenID Connect (OIDC)** Identity Provider (IdP) for Single Sign-On (SSO). You will learn how to configure your identity provider, apply settings within the WireManager console, and manage the first-time user approval lifecycle.

---

## Prerequisites

Before starting, ensure you have:
1. An existing WireManager installation with an **Admin** account.
2. Administrative access to an OIDC Identity Provider (e.g., **Keycloak**, **Microsoft Entra ID / Azure AD**, **Authentik**, or **Okta**).
3. The SSO environment variables (`FRONTEND_URL` and `BACKEND_URL`) properly configured in your `docker-compose.yaml` under `wiremanager-api` and `wiremanager-web`:

```yaml
# In docker-compose.yaml
services:
  wiremanager-api:
    environment:
      - FRONTEND_URL=https://wireguard.netrod.xyz # or http://<server-ip>:3002
      - BACKEND_URL=https://api-wiremanager.netrod.xyz # or http://<server-ip>:5070

  wiremanager-web:
    environment:
      - API_BASE_URL=http://wiremanager-api:8080
      - BACKEND_URL=https://api-wiremanager.netrod.xyz # or http://<server-ip>:5070
```

- **`FRONTEND_URL`** (on `wiremanager-api`): Public URL of the web UI. Used by the backend to redirect the browser back to `/sso-login?token=...` after completing IdP authentication.
- **`BACKEND_URL`** (on `wiremanager-api`): Public URL of the backend API. Used by ASP.NET Core OpenID Connect to construct the exact `RedirectUri` (`${BACKEND_URL}/signin-oidc`) sent in the authorization challenge to the Identity Provider.
- **`BACKEND_URL`** (on `wiremanager-web`): Public URL of the backend API. Used by the Next.js routes to redirect the browser to `${BACKEND_URL}/api/Auth/sso/login` when initiating SSO authentication.

---

## Step 1: Register WireManager in Your Identity Provider

In your Identity Provider, create a new OpenID Connect client application.

### General Client Requirements

| Parameter | Recommended Setting | Description |
| :--- | :--- | :--- |
| **Client Type** | Confidential | Requires a client secret for backend token exchange. |
| **Response Type** | Authorization Code (`code`) | Standard OIDC flow with PKCE. |
| **Client Authentication** | Enabled | The client must present its secret when requesting tokens. |
| **Standard Scopes** | `openid`, `profile`, `email` | Required for user identity and username mapping. |
| **Valid Redirect URI** | `https://<api-domain>/signin-oidc`<br/>*(or `http://<server-ip>:5070/signin-oidc`)* | The ASP.NET Core OpenID Connect handler endpoint. Must match `${BACKEND_URL}/signin-oidc`. |

:::caution Redirect URI Points to the Backend API (BACKEND_URL)
The OAuth2/OIDC redirect URI must target the **Backend API** public address (`BACKEND_URL`) with path `/signin-oidc` (e.g., `https://api-wiremanager.netrod.xyz/signin-oidc` or `http://<server-ip>:5070/signin-oidc`), **not** the web frontend port `:3002`. WireManager automatically uses the configured `BACKEND_URL` when generating the redirect URI for the Identity Provider.
:::

---

### Identity Provider Configuration Examples

#### Example A: Keycloak

1. Log in to your Keycloak Administration Console.
2. Select your Realm (e.g., `master` or `corporate`).
3. In the left navigation, click **Clients** > **Create client**.
4. In **General Settings**:
   - **Client type**: `OpenID Connect`
   - **Client ID**: `wiremanager`
   - Click **Next**.
5. In **Capability config**:
   - Enable **Client authentication** (ON).
   - Enable **Standard flow** (ON).
   - Disable **Implicit flow** and **Direct access grants**.
   - Click **Next**.
6. In **Login settings**:
   - **Valid redirect URIs**: `http://<server-ip>:5070/signin-oidc` (or `https://api.yourdomain.com/signin-oidc`)
   - **Valid post logout redirect URIs**: `http://<server-ip>:3002/*`
   - Click **Save**.
7. Navigate to the **Credentials** tab and copy the **Client Secret**.
8. Note your **Authority URL**:
   ```text
   https://<keycloak-host>/realms/<realm-name>
   ```

---

#### Example B: Microsoft Entra ID (Azure Active Directory)

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/) or Azure Portal.
2. Navigate to **Identity** > **Applications** > **App registrations** > **New registration**.
3. Configure the application:
   - **Name**: `WireManager`
   - **Supported account types**: Select *Accounts in this organizational directory only* (Single tenant).
   - **Redirect URI**: Select platform **Web** and enter:
     ```text
     https://api.yourdomain.com/signin-oidc
     ```
     *(or `http://<server-ip>:5070/signin-oidc` for testing)*
4. Click **Register**.
5. In the registered application overview:
   - Copy the **Application (client) ID**.
   - Note the **Directory (tenant) ID**.
   - Your **Authority URL** is:
     ```text
     https://login.microsoftonline.com/<tenant-id>/v2.0
     ```
6. In the left menu, click **Certificates & secrets** > **Client secrets** > **New client secret**.
7. Add a description, set an expiration period, and click **Add**.
8. Copy the generated secret **Value** immediately.

---

#### Example C: Authentik

1. In the Authentik Admin interface, go to **Applications** > **Providers** > **Create Provider**.
2. Select **OAuth2/OpenID Provider**.
3. Configure:
   - **Name**: `WireManager Provider`
   - **Authorization flow**: `default-provider-authorization-explicit-consent` (or implicit)
   - **Client type**: `Confidential`
   - **Redirect URIs**: `http://<server-ip>:5070/signin-oidc`
   - **Scopes**: Ensure `openid`, `email`, and `profile` are selected.
4. Save the provider, then create an **Application** and bind it to this provider.
5. In the provider details, copy the **Client ID**, **Client Secret**, and the **OpenID Configuration Issuer URL** (`Authority`).

---

## Step 2: Configure SSO in WireManager

Once your Identity Provider client is registered, apply the credentials in WireManager:

1. Log in to the WireManager web console as an **Admin**.
2. In the navigation sidebar, click on **Settings** (`/settings`).
3. You will see the **Single Sign-On (SSO / OIDC)** administration card.
4. Toggle the **Enable SSO** switch to the **Active** position.
5. Fill in the required fields:
   - **OIDC Authority**: The base issuer URL of your Identity Provider (e.g., `https://auth.example.com/realms/wiremanager`).
   - **Client ID**: The client identifier configured in your IdP (e.g., `wiremanager`).
   - **Client Secret**: The client secret generated by your IdP. Click the eye icon to verify the value.
6. Click **Save** (`Salva`).
7. A green notification will confirm: *"SSO configuration saved successfully"* (`Configurazione SSO salvata con successo`).

```
+-------------------------------------------------------------------------+
|                                Settings                                 |
+-------------------------------------------------------------------------+
|  [Key] Single Sign-On (SSO / OIDC)                                      |
|                                                                         |
|  [x] Enable SSO  [ Active ]                                             |
|                                                                         |
|  Authority:     [ https://auth.example.com/realms/wiremanager         ] |
|  Client ID:     [ wiremanager                                         ] |
|  Client Secret: [ ****************************************       (o)  ] |
|                                                                         |
|                                                          [ Save Config ]|
+-------------------------------------------------------------------------+
```

:::tip Immediate Dynamic Reload
The WireManager backend updates its OpenID Connect options in memory immediately upon saving. There is no need to restart the backend container.
:::

---

## Step 3: Test the SSO Login Flow

1. Open a new private/incognito browser window.
2. Navigate to your WireManager login page:
   ```text
   http://<server-ip>:3002/login
   ```
3. You will now see the **Sign in with SSO** (`Accedi con SSO`) button below the traditional login form.
4. Click **Sign in with SSO**:
   - The browser redirects to your Identity Provider login portal.
   - Enter your corporate credentials and complete any multi-factor authentication (MFA) challenges.
   - Once validated, the IdP redirects back to WireManager.

---

## Step 4: Approve Newly Provisioned Users (Zero-Trust)

To prevent unauthorized corporate users from accessing VPN controls, **all newly provisioned SSO users are initially created with the `Disabled` role**.

```
+-------------------------------------------------------------------------+
|  WireManager Login                                                      |
|                                                                         |
|  [!] Account Disabled: Your account has been created via SSO,           |
|      but requires an administrator to assign your role.                 |
+-------------------------------------------------------------------------+
```

When a user logs in for the first time via SSO:
1. WireManager verifies the OIDC tokens and extracts the user's claims (`email`, `name`, `sub`, `iss`).
2. An internal account is registered in the database with the `Disabled` role, and an audit event `Auth.RegisterSSO` is generated.
3. The user is prevented from logging in until an Administrator approves the account.

### How an Administrator Approves the Account:

1. Log in with your **Admin** account.
2. Navigate to **Users** (`/users`).
3. In the **Registered Users** table, locate the newly created user (identified by their email or name).
4. Note the gray **`Disabled`** badge next to their username.
5. Click the role dropdown selector and choose the appropriate privilege level:
   - **Operator**: To grant peer and VPN configuration management.
   - **Admin**: To grant full infrastructure administration.
6. The role update is saved instantly (`PATCH /api/auth/users/{uuid}/role/{role}`).
7. The user can now click **Sign in with SSO** and access WireManager immediately!

```
+-------------------------------------------------------------------------+
|                              User Management                            |
+------------------------------------+------------------------------------+
|          Create New User           |           Existing Users           |
+------------------------------------+------------------------------------+
|                                    | Search: [ bob                    ] |
|                                    |                                    |
|                                    | * bob@corp.net      [ Disabled v ] |
|                                    |                       Admin        |
|                                    |                     > Operator <   |
+------------------------------------+------------------------------------+
```

---

## Troubleshooting Common Issues

### 1. "SSO is not enabled on the system"
- **Cause**: The SSO switch in **Settings** is toggled off, or the configuration failed to save.
- **Solution**: Log in as Admin, visit `/settings`, toggle **Enable SSO** to on, fill in all fields, and click **Save**.

### 2. Identity Provider returns `Invalid redirect_uri` or `Redirect URI mismatch`
- **Cause**: The redirect URI registered in the IdP does not match the URI generated by the backend API (`${BACKEND_URL}/signin-oidc`), or `BACKEND_URL` is missing or misconfigured under `wiremanager-api`.
- **Solution**:
  - Verify that `BACKEND_URL` is set under `wiremanager-api` in `docker-compose.yaml` (e.g. `https://api-wiremanager.netrod.xyz` or `http://<server-ip>:5070`).
  - Verify that the IdP client has `${BACKEND_URL}/signin-oidc` registered under **Valid redirect URIs**.
  - Ensure protocol schemes (`http` vs `https`), domains, and ports match identically.

### 3. Infinite redirect loop or redirect to `localhost:3000` after IdP authentication
- **Cause**: The `FRONTEND_URL` environment variable was not specified in `docker-compose.yaml` under `wiremanager-api`.
- **Solution**: Set `FRONTEND_URL=https://wireguard.netrod.xyz` (or `http://<server-ip>:3002`) in `docker-compose.yaml` and restart `wiremanager-api`:
  ```bash
  docker compose up -d wiremanager-api
  ```

### 4. Backend logs report `Unable to obtain configuration from: .../.well-known/openid-configuration`
- **Cause**: The `wiremanager-api` container cannot reach the `OidcAuthority` URL over the network, or the TLS certificate on the IdP is self-signed/untrusted.
- **Solution**:
  - Check network connectivity between Docker containers and the IdP host.
  - Test DNS resolution inside the container (`docker exec -it wiremanager_api ping <idp-hostname>`).
  - If using custom internal CAs, ensure the root CA is mounted into the container's trust store.

### 5. Clicking "Sign in with SSO" fails or tries to connect to `http://wiremanager-api:8080`
- **Cause**: The `BACKEND_URL` environment variable was not specified in `docker-compose.yaml` under `wiremanager-web`. In Docker deployments, the frontend falls back to `API_BASE_URL` (`http://wiremanager-api:8080`), which is an internal container address inaccessible from the user's web browser.
- **Solution**: Set `BACKEND_URL` under `wiremanager-web` in `docker-compose.yaml` to the public address of the backend API (e.g. `https://api-wiremanager.netrod.xyz` or `http://<server-ip>:5070`) and restart `wiremanager-web`:
  ```bash
  docker compose up -d wiremanager-web
  ```

---

## Related Documentation

- **[SSO Architectural Concepts](../concepts/sso.md)** — In-depth explanation of two-phase token exchange and identity mapping.
- **[User Management Guide](./user-management.md)** — Detailed overview of RBAC privileges and user administration.
- **[Inspect Audit Logs Guide](./audit-logs.md)** — Tracking SSO login and registration events.
- **[API Authentication Guide](../api/authentication.md)** — Programmatic SSO endpoint documentation.
