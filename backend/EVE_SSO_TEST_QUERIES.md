# EVE SSO Integration Test Queries

This file contains GraphQL queries for testing the EVE Online SSO integration.

## Step 1: Get Login URL

```graphql
query GetLoginUrl {
  eveLoginUrl(redirectUri: "http://localhost:3000/auth/callback") {
    url
    state
  }
}
```

Expected response:
```json
{
  "data": {
    "eveLoginUrl": {
      "url": "https://login.eveonline.com/v2/oauth/authorize?response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&client_id=...&scope=esi-killmails.read_killmails.v1%20esi-killmails.read_corporation_killmails.v1%20publicData&state=...",
      "state": "some_random_hex_string"
    }
  }
}
```

## Step 2: Handle Callback (After EVE Login)

After user logs in via EVE Online and is redirected back with a code:

```graphql
mutation HandleCallback {
  eveCallback(
    code: "AUTHORIZATION_CODE_FROM_EVE"
    state: "STATE_FROM_STEP_1"
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

Expected response (with valid code):
```json
{
  "data": {
    "eveCallback": {
      "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
      "refreshToken": "gEyuYF9FTy1T...",
      "expiresIn": 1200,
      "character": {
        "characterId": "123456789",
        "characterName": "Character Name",
        "characterOwnerHash": "abcdef123456789...",
        "corporationId": "987654321",
        "allianceId": "111222333"
      }
    }
  }
}
```

## Testing Notes

1. **Without EVE Developer Credentials:**
   - The `eveLoginUrl` query will work but generate a URL with empty client_id
   - The `eveCallback` mutation will fail with authentication errors
   - This is expected - you need to set up EVE developer credentials first

2. **With EVE Developer Credentials:**
   - Set `EVE_CLIENT_ID` and `EVE_CLIENT_SECRET` in `.env` file
   - The full OAuth flow will work end-to-end

3. **Manual Testing Flow:**
   ```
   1. Query eveLoginUrl → Get URL and state
   2. Visit the URL in browser → Login with EVE account
   3. Get redirected back with code parameter
   4. Mutation eveCallback with the code → Get tokens and character info
   ```

## Integration Verification

To verify the integration is working correctly:

1. Start the server: `npm run dev`
2. Open GraphQL playground: http://localhost:4000/graphql
3. Run the `eveLoginUrl` query
4. Verify it returns a properly formatted response with url and state fields
5. Check that the URL contains the correct OAuth2 parameters

Without setting up EVE developer credentials, this is as far as we can test automatically.
The full OAuth flow requires:
- Valid EVE developer application credentials
- Browser-based user authentication
- Callback handling in a frontend application
