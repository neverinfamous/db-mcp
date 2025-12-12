# Keycloak Setup for db-mcp

This guide explains how to configure Keycloak as the OAuth 2.0 authorization server for db-mcp.

## Prerequisites

- Java 17+ installed
- Keycloak downloaded to `keycloak-{version}/` folder

## Quick Start

### 1. Start Keycloak

```powershell
cd keycloak-{version}
.\bin\kc.bat start-dev
```

### 2. Initial Setup (First Run)

1. Open http://localhost:8080
2. Create admin account when prompted
3. Access the Admin Console

### 3. Create Realm

1. Click dropdown in top-left (says "master")
2. Click "Create realm"
3. Name: `db-mcp`
4. Click "Create"

### 4. Create OAuth Client

1. Go to **Clients** → **Create client**
2. Client type: `OpenID Connect`
3. Client ID: `db-mcp-server`
4. Click **Next**
5. Enable **Client authentication** (ON)
6. Click **Next**
7. Valid redirect URIs: `http://localhost:3000/*`
8. Web origins: `http://localhost:3000`
9. Click **Save**

### 5. Get Client Secret

1. Go to **Clients** → **db-mcp-server** → **Credentials** tab
2. Copy the **Client secret**
3. Store it in your `.env` file

### 6. Create Scopes

Using Keycloak Admin CLI:

```powershell
.\bin\kcadm.bat config credentials --server http://localhost:8080 --realm master --user admin --password YOUR_ADMIN_PASSWORD
.\bin\kcadm.bat create client-scopes -r db-mcp -s name=read -s protocol=openid-connect
.\bin\kcadm.bat create client-scopes -r db-mcp -s name=write -s protocol=openid-connect
.\bin\kcadm.bat create client-scopes -r db-mcp -s name=admin -s protocol=openid-connect
```

### 7. Create Test User

1. Go to **Users** → **Add user**
2. Username: `testuser`
3. Click **Create**
4. Go to **Credentials** tab → **Set password**

---

## OAuth Endpoints

| Endpoint | URL |
|----------|-----|
| Issuer | `http://localhost:8080/realms/db-mcp` |
| JWKS URI | `http://localhost:8080/realms/db-mcp/protocol/openid-connect/certs` |
| Token Endpoint | `http://localhost:8080/realms/db-mcp/protocol/openid-connect/token` |
| Discovery | `http://localhost:8080/realms/db-mcp/.well-known/openid-configuration` |

---

## db-mcp Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=db-mcp
KEYCLOAK_CLIENT_ID=db-mcp-server
KEYCLOAK_CLIENT_SECRET=your_client_secret_here
```

### TypeScript Configuration

```typescript
import { McpServer } from './server/McpServer.js';

const server = new McpServer({
    name: 'db-mcp',
    version: '1.0.0',
    transport: 'http',
    port: 3000,
    oauth: {
        enabled: true,
        authorizationServerUrl: process.env.KEYCLOAK_URL + '/realms/' + process.env.KEYCLOAK_REALM,
        issuer: process.env.KEYCLOAK_URL + '/realms/' + process.env.KEYCLOAK_REALM,
        audience: process.env.KEYCLOAK_CLIENT_ID,
        jwksUri: process.env.KEYCLOAK_URL + '/realms/' + process.env.KEYCLOAK_REALM + '/protocol/openid-connect/certs',
        clockTolerance: 60,
        publicPaths: ['/health']
    }
});

await server.start();
```

---

## Test Token Generation

```powershell
$body = @{
    client_id = $env:KEYCLOAK_CLIENT_ID
    client_secret = $env:KEYCLOAK_CLIENT_SECRET
    username = "testuser"
    password = "your_password"
    grant_type = "password"
    scope = "openid read"
}
$response = Invoke-RestMethod -Uri "$env:KEYCLOAK_URL/realms/$env:KEYCLOAK_REALM/protocol/openid-connect/token" -Method POST -Body $body
$response.access_token
```

---

## Security Notes

> **⚠️ Important**: Never commit credentials to version control.
> - Store secrets in `.env` (gitignored)
> - Use environment variables in production
> - Rotate client secrets regularly
