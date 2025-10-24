# EVE Online SSO Integration

This backend implementation provides OAuth2 authentication with EVE Online's Single Sign-On (SSO) system.

## Features

- OAuth2 authentication flow with EVE Online SSO
- Token exchange and verification
- Character information retrieval
- Killmail data fetching from EVE ESI (EVE Swagger Interface)
- Automatic token refresh support

## Setup

### 1. Register your application on EVE Developers

1. Go to https://developers.eveonline.com/
2. Create a new application
3. Set the callback URL to match your application (e.g., `http://localhost:3000/auth/callback`)
4. Note your Client ID and Client Secret
5. Select the following scopes:
   - `esi-killmails.read_killmails.v1` - Read killmails
   - `esi-killmails.read_corporation_killmails.v1` - Read corporation killmails
   - `publicData` - Public character data

### 2. Configure environment variables

Copy `.env.example` to `.env` and update with your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
EVE_CLIENT_ID=your_client_id_here
EVE_CLIENT_SECRET=your_client_secret_here
PORT=4000
NODE_ENV=development
```

### 3. Install dependencies

```bash
npm install
```

### 4. Generate GraphQL types

```bash
npm run codegen
```

### 5. Start the server

```bash
npm run dev
```

The GraphQL playground will be available at http://localhost:4000/graphql

## GraphQL API

### Authentication Flow

#### 1. Get Login URL

Query to generate the EVE SSO login URL:

```graphql
query GetLoginUrl {
  eveLoginUrl(redirectUri: "http://localhost:3000/auth/callback") {
    url
    state
  }
}
```

Response:
```json
{
  "data": {
    "eveLoginUrl": {
      "url": "https://login.eveonline.com/v2/oauth/authorize?...",
      "state": "random_state_string_for_csrf_protection"
    }
  }
}
```

**Frontend Integration:**
1. Store the `state` value in session/localStorage
2. Redirect the user to the `url`
3. User logs in via EVE Online
4. EVE redirects back to your `redirectUri` with `code` and `state` parameters

#### 2. Handle Callback

After EVE redirects back, exchange the code for tokens:

```graphql
mutation HandleCallback {
  eveCallback(
    code: "authorization_code_from_eve"
    state: "state_from_step_1"
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

Response:
```json
{
  "data": {
    "eveCallback": {
      "accessToken": "eyJ0eXAi...",
      "refreshToken": "gEyuYF...",
      "expiresIn": 1200,
      "character": {
        "characterId": "123456789",
        "characterName": "Character Name",
        "characterOwnerHash": "abcdef123456...",
        "corporationId": "987654321",
        "allianceId": "111222333"
      }
    }
  }
}
```

**Frontend Integration:**
1. Verify `state` matches the stored value
2. Store `accessToken` and `refreshToken` securely
3. Use `characterId` to identify the logged-in user
4. Set up token refresh before `expiresIn` seconds

## EVE ESI Service

The `EveSsoService` provides methods for interacting with EVE's ESI API:

### Available Methods

- `generateLoginUrl(redirectUri)` - Generate OAuth2 authorization URL
- `exchangeCodeForToken(code, redirectUri)` - Exchange authorization code for tokens
- `verifyToken(accessToken)` - Verify and decode access token
- `getCharacterPublicInfo(characterId)` - Get character's public information
- `getCharacterKillmails(characterId, accessToken, page)` - Get character's recent killmails
- `getKillmailDetails(killmailId, killmailHash)` - Get detailed killmail data
- `refreshAccessToken(refreshToken)` - Refresh an expired access token

### Example: Fetching Killmails

```typescript
import { eveSsoService } from './services/eve-sso.service';

// Get recent killmails for a character
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
  console.log(details);
}
```

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS in production environments
2. **State Validation**: Verify the `state` parameter to prevent CSRF attacks
3. **Token Storage**: Store tokens securely (e.g., httpOnly cookies, encrypted storage)
4. **Token Refresh**: Implement automatic token refresh before expiration
5. **Environment Variables**: Never commit `.env` file to version control
6. **Scopes**: Only request the minimum scopes needed for your application

## Architecture

The implementation follows the modular architecture pattern:

```
backend/src/
├── schema/
│   └── auth.graphql          # GraphQL schema for authentication
├── resolvers/
│   ├── index.ts              # Resolver aggregator
│   └── auth.resolver.ts      # Auth query/mutation resolvers
├── services/
│   └── eve-sso.service.ts    # EVE SSO and ESI API client
└── types/
    └── eve.types.ts          # TypeScript types for EVE API responses
```

## Testing

To test the authentication flow:

1. Start the backend server: `npm run dev`
2. Open GraphQL playground: http://localhost:4000/graphql
3. Execute the `eveLoginUrl` query
4. Open the returned URL in a browser
5. Log in with your EVE Online account
6. Copy the `code` from the callback URL
7. Execute the `eveCallback` mutation with the code

## Resources

- [EVE Online SSO Documentation](https://docs.esi.evetech.net/docs/sso/)
- [EVE ESI Documentation](https://esi.evetech.net/ui/)
- [EVE Developers Portal](https://developers.eveonline.com/)
- [EVE Third-Party Developer Blog](https://developers.eveonline.com/blog)

## Troubleshooting

### "Invalid client_id or client_secret"
- Verify your EVE_CLIENT_ID and EVE_CLIENT_SECRET in .env
- Make sure there are no extra spaces or quotes

### "Redirect URI mismatch"
- The redirectUri parameter must exactly match what you registered in EVE Developers
- Check for http vs https, trailing slashes, port numbers

### "Invalid authorization code"
- Authorization codes are single-use and expire quickly
- Don't reuse codes
- Make sure you're using the correct code from the callback

### "Token expired"
- Access tokens expire after 20 minutes (1200 seconds)
- Implement token refresh using the refresh token
- Use `refreshAccessToken()` method before the token expires
