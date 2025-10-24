# Quick Start Guide - EVE Online SSO Integration

This guide will help you get started with the EVE Online SSO integration.

## Prerequisites

- Node.js 18+ installed
- An EVE Online account
- Registered application on [EVE Developers Portal](https://developers.eveonline.com/)

## Setup Steps

### 1. Register Your Application

1. Visit https://developers.eveonline.com/
2. Click "Create New Application"
3. Fill in the application details:
   - **Application Name**: Your app name (e.g., "KillReport Dev")
   - **Description**: Brief description of your app
   - **Callback URL**: `http://localhost:3000/auth/callback` (for local development)
   - **Scopes**: Select the following:
     - ✅ `esi-killmails.read_killmails.v1`
     - ✅ `esi-killmails.read_corporation_killmails.v1`
     - ✅ `publicData`
4. Click "Create Application"
5. Copy your **Client ID** and **Client Secret**

### 2. Configure Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your credentials:
   ```env
   EVE_CLIENT_ID=your_client_id_here
   EVE_CLIENT_SECRET=your_client_secret_here
   PORT=4000
   NODE_ENV=development
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Generate GraphQL Types

```bash
npm run codegen
```

### 5. Start the Server

```bash
npm run dev
```

Server will start at: http://localhost:4000/graphql

## Testing the Integration

### Using GraphQL Playground

1. Open http://localhost:4000/graphql in your browser

2. **Test Login URL Generation:**
   ```graphql
   query {
     eveLoginUrl(redirectUri: "http://localhost:3000/auth/callback") {
       url
       state
     }
   }
   ```

3. **Copy the URL** from the response and open it in a new browser tab

4. **Log in with EVE Online** - You'll be redirected to EVE's login page

5. **After login**, you'll be redirected back to your callback URL with a `code` parameter in the URL

6. **Copy the code** and use it in the callback mutation:
   ```graphql
   mutation {
     eveCallback(
       code: "PASTE_CODE_HERE"
       state: "PASTE_STATE_HERE"
       redirectUri: "http://localhost:3000/auth/callback"
     ) {
       accessToken
       refreshToken
       expiresIn
       character {
         characterId
         characterName
         characterOwnerHash
         corporationId
         allianceId
       }
     }
   }
   ```

7. **Success!** You should receive:
   - Access token (valid for 20 minutes)
   - Refresh token (for renewing access)
   - Character information

## Next Steps - Frontend Integration

### 1. Login Flow

```javascript
// Step 1: Get login URL from backend
const { data } = await apolloClient.query({
  query: gql`
    query {
      eveLoginUrl(redirectUri: "http://localhost:3000/auth/callback") {
        url
        state
      }
    }
  `
});

// Step 2: Store state in sessionStorage
sessionStorage.setItem('eve_sso_state', data.eveLoginUrl.state);

// Step 3: Redirect user to EVE login
window.location.href = data.eveLoginUrl.url;
```

### 2. Callback Handler

```javascript
// In your /auth/callback route component
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const storedState = sessionStorage.getItem('eve_sso_state');
  
  // Verify state matches (CSRF protection)
  if (state !== storedState) {
    console.error('State mismatch - possible CSRF attack');
    return;
  }
  
  // Exchange code for tokens
  apolloClient.mutate({
    mutation: gql`
      mutation($code: String!, $state: String!) {
        eveCallback(
          code: $code
          state: $state
          redirectUri: "http://localhost:3000/auth/callback"
        ) {
          accessToken
          refreshToken
          expiresIn
          character {
            characterId
            characterName
          }
        }
      }
    `,
    variables: { code, state }
  }).then(({ data }) => {
    // Store tokens securely
    localStorage.setItem('eve_access_token', data.eveCallback.accessToken);
    localStorage.setItem('eve_refresh_token', data.eveCallback.refreshToken);
    
    // Redirect to dashboard
    navigate('/dashboard');
  });
}, []);
```

### 3. Token Refresh

```javascript
// Set up token refresh before expiration (20 minutes)
const scheduleTokenRefresh = (expiresIn) => {
  // Refresh 1 minute before expiration
  const refreshTime = (expiresIn - 60) * 1000;
  
  setTimeout(async () => {
    const refreshToken = localStorage.getItem('eve_refresh_token');
    
    // Call your backend refresh endpoint
    const newTokens = await refreshAccessToken(refreshToken);
    
    localStorage.setItem('eve_access_token', newTokens.accessToken);
    scheduleTokenRefresh(newTokens.expiresIn);
  }, refreshTime);
};
```

## Fetching Killmails

Once authenticated, you can fetch killmails using the EVE ESI service:

```typescript
import { eveSsoService } from './services/eve-sso.service';

// Get character's recent killmails
const killmails = await eveSsoService.getCharacterKillmails(
  characterId,
  accessToken,
  1 // page number
);

// Get details for each killmail
for (const km of killmails) {
  const details = await eveSsoService.getKillmailDetails(
    km.killmail_id,
    km.killmail_hash
  );
  
  console.log(`Kill at ${details.killmail_time}`);
  console.log(`Victim: ${details.victim.ship_type_id}`);
  console.log(`Attackers: ${details.attackers.length}`);
}
```

## Common Issues

### "client_id is empty"

**Problem**: The generated login URL has an empty client_id
**Solution**: Make sure you've set `EVE_CLIENT_ID` in your `.env` file

### "Invalid redirect URI"

**Problem**: EVE SSO rejects the callback
**Solution**: The redirect URI in your code must **exactly** match what you registered in EVE Developers Portal (including http/https, trailing slashes, etc.)

### "Invalid authorization code"

**Problem**: The code from EVE doesn't work
**Solution**: Authorization codes are single-use and expire quickly. Make sure you're using a fresh code and not reusing old ones.

### "Token expired"

**Problem**: Access token no longer works
**Solution**: Access tokens expire after 20 minutes. Implement token refresh using the refresh token.

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EVE_CLIENT_ID` | Yes | Your EVE application client ID | `abc123...` |
| `EVE_CLIENT_SECRET` | Yes | Your EVE application client secret | `xyz789...` |
| `PORT` | No | Backend server port | `4000` |
| `NODE_ENV` | No | Environment mode | `development` |

## Resources

- [EVE SSO Documentation](https://docs.esi.evetech.net/docs/sso/)
- [EVE ESI Swagger UI](https://esi.evetech.net/ui/)
- [Full Integration Guide](./EVE_SSO_INTEGRATION.md)
- [Test Queries](./EVE_SSO_TEST_QUERIES.md)

## Support

For issues specific to this integration, check the documentation files:
- Detailed implementation: `EVE_SSO_INTEGRATION.md`
- Test queries: `EVE_SSO_TEST_QUERIES.md`

For EVE SSO/ESI issues, visit:
- EVE Third-Party Developers Discord: https://discord.gg/eveonline-devs
- EVE Developers Portal: https://developers.eveonline.com/
