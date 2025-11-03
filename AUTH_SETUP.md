# Authentication Flow - Complete Setup Guide

## Overview

This project uses Eve Online SSO authentication. Users can log in with their Eve Online accounts and access killmail data.

## Architecture

### Flow Diagram

```
1. Frontend (localhost:3000)
   ↓ User clicks LOGIN button
   ↓ GraphQL mutation: login

2. Backend (localhost:4000/graphql)
   ↓ Returns Eve SSO URL

3. User → Eve Online SSO
   ↓ User logs in with Eve credentials
   ↓ Eve redirects back with code

4. Backend (localhost:4000/auth/callback)
   ↓ Exchanges code for token
   ↓ Creates/updates user in database
   ↓ Redirects to frontend with token

5. Frontend (localhost:3000/auth/success)
   ↓ Saves token to localStorage
   ↓ Updates auth state
   ↓ Redirects to home page

6. All subsequent requests
   ↓ Apollo Client adds "Authorization: Bearer <token>" header
   ↓ Backend verifies token and adds user to context
```

## Components

### Backend (Port 4000)

**Server**: `/root/killreport/backend/src/server.ts`

- GraphQL endpoint: `/graphql`
- SSO callback endpoint: `/auth/callback`

**Services**:

- `eve-sso.ts`: Eve Online SSO integration
- GraphQL context middleware: Verifies Bearer token

**Resolvers**: `auth.resolver.ts`

- `login`: Generate SSO URL
- `authenticateWithCode`: Exchange code for token
- `me`: Get current user info

### Frontend (Port 3000)

**Apollo Client**: `/root/killreport/frontend/src/lib/apolloClient.ts`

- Automatically adds Authorization header from localStorage

**Pages**:

- `/auth/success`: Token handler and redirect page

**Components**:

- `AuthButton`: Smart login/logout button
- `Header`: Shows user info when logged in

**Hooks**:

- `useAuth`: Auth state management

## Setup

### 1. Backend Environment Variables

Create `/root/killreport/backend/.env`:

```env
EVE_CLIENT_ID=your_client_id_here
EVE_CLIENT_SECRET=your_secret_key_here
EVE_CALLBACK_URL=http://localhost:4000/auth/callback
FRONTEND_URL=http://localhost:3000
```

### 2. Eve Developer Application

1. Go to https://developers.eveonline.com/
2. Create new application:
   - **Callback URL**: `http://localhost:4000/auth/callback`
   - **Scopes**: Select required permissions
3. Copy Client ID and Secret to `.env`

### 3. Start Services

```bash
# Terminal 1: Backend
cd /root/killreport/backend
yarn dev

# Terminal 2: Frontend
cd /root/killreport/frontend
yarn dev
```

### 4. Test Authentication

1. Open http://localhost:3000
2. Click **LOGIN** button in header
3. Login with Eve Online
4. You'll be redirected back and see your character name
5. Click **LOGOUT** to sign out

## How It Works

### Login Process

```typescript
// 1. User clicks LOGIN
<AuthButton />; // calls handleLogin()

// 2. Get SSO URL from backend
const { data } = await loginMutation();
window.location.href = data.login.url;

// 3. User logs in at Eve SSO
// Eve redirects to: http://localhost:4000/auth/callback?code=xxx

// 4. Backend exchanges code for token
const tokenData = await exchangeCodeForToken(code);
const character = await verifyToken(tokenData.access_token);

// 5. Backend redirects to frontend with token
res.writeHead(302, {
  Location: `http://localhost:3000/auth/success?token=xxx&...`,
});

// 6. Frontend saves token
localStorage.setItem("eve_access_token", token);
window.dispatchEvent(new Event("auth-change"));
```

### Authenticated Requests

```typescript
// Apollo Client automatically adds header:
headers: {
  authorization: `Bearer ${localStorage.getItem("eve_access_token")}`;
}

// Backend verifies and adds user to context:
const character = await verifyToken(token);
return { user: character };

// Use in resolvers:
me: async (_, __, context) => {
  if (!context.user) {
    throw new Error("Not authenticated");
  }
  // Access user data: context.user.characterId
};
```

## Security Notes

- Tokens stored in localStorage (survives page refresh)
- Token expiry checked on mount
- CSRF protection via state parameter
- Tokens verified on backend for each request

## Troubleshooting

### "Not authenticated" errors

- Check if token exists: `localStorage.getItem('eve_access_token')`
- Check token expiry: `localStorage.getItem('eve_token_expiry')`
- Try logging out and back in

### Redirect issues

- Verify `FRONTEND_URL` in backend `.env`
- Check Eve application callback URL matches

### CORS errors

- Backend server.ts already has CORS headers
- Make sure both servers are running

## Development Tips

### Check Current Auth State

```javascript
// In browser console:
localStorage.getItem("eve_access_token");
localStorage.getItem("eve_user");
```

### Clear Auth State

```javascript
// In browser console:
localStorage.clear();
location.reload();
```

### Test Protected Query

You can test the following query in the GraphQL Yoga Playground at [http://localhost:4000/graphql](http://localhost:4000/graphql)

```graphql
query {
  me {
    id
    name
    email
  }
}
```

This should work when logged in, and fail when logged out.
