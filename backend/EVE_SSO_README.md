# Eve Online SSO Integration

This project integrates Eve Online SSO authentication system with GraphQL Yoga API.

## Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Create Eve Online Developer Application

1. Go to [Eve Online Developers](https://developers.eveonline.com/)
2. Click "CREATE NEW APPLICATION" button
3. Fill in the application details:

   - **Name**: Your application name
   - **Description**: Application description
   - **Connection Type**: Authentication & API Access
   - **Permissions**: Select the required scopes (e.g., `publicData`, `esi-characters.read_corporation_roles.v1`)
   - **Callback URL**: `http://localhost:4000/auth/callback`

4. After creation, save your **Client ID** and **Secret Key**

### 3. Environment Variables

Copy `.env.example` to `.env` and add your Eve SSO credentials:

```bash
cp .env.example .env
```

Edit the `.env` file:

```env
EVE_CLIENT_ID=your_client_id_here
EVE_CLIENT_SECRET=your_secret_key_here
EVE_CALLBACK_URL=http://localhost:4000/auth/callback
```

### 4. Database Migration

Run the migration to create the User model:

```bash
yarn prisma:migrate
```

### 5. Start the Server

```bash
yarn dev
```

The server will run at `http://localhost:4000/graphql`.

## Usage

### 1. Get Login URL

```graphql
mutation {
  login {
    url
    state
  }
}
```

This returns an Eve Online SSO URL. Redirect the user to this URL.

### 2. Authentication

After the user logs in through Eve SSO, they will be redirected to the callback URL with a `code` parameter. Use this code to authenticate:

```graphql
mutation {
  authenticateWithCode(
    code: "authorization_code_from_callback"
    state: "state_from_login_mutation"
  ) {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      name
      email
    }
  }
}
```

### 3. Authenticated Requests

After obtaining the access token, include it in the Authorization header for each request:

```http
Authorization: Bearer <access_token>
```

### 4. Get User Information

```graphql
query {
  me {
    id
    name
    email
    createdAt
  }
}
```

### 5. Token Refresh

When the access token expires, use the refresh token to get a new one:

```graphql
mutation {
  refreshToken(refreshToken: "your_refresh_token") {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      name
      email
    }
  }
}
```

## Architecture

### File Structure

```text
backend/
├── src/
│   ├── config.ts                 # Eve SSO configuration
│   ├── server.ts                 # Authentication context logic
│   ├── schema/
│   │   └── auth.graphql         # Auth GraphQL schema
│   ├── resolvers/
│   │   ├── auth.resolver.ts     # Auth resolvers
│   │   └── index.ts             # Combines all resolvers
│   └── services/
│       ├── eve-sso.ts           # SSO utility functions
│       └── prisma.ts            # Prisma client
└── prisma/
    └── schema.prisma            # User model definition
```

### SSO Flow

1. **Login**: User calls `login` mutation → Gets Eve SSO URL
2. **Authorization**: User logs in through Eve SSO → Redirected to callback URL with `code`
3. **Token Exchange**: Frontend sends `code` to `authenticateWithCode` mutation → Receives access token
4. **Authenticated Requests**: Each request includes token in Authorization header
5. **Token Verification**: Server verifies token on each request and adds user info to context

## Security Notes

- **State Parameter**: A unique state is generated for each login request for CSRF protection
- **Token Verification**: JWT tokens are verified using Eve Online's JWKS endpoint
- **HTTPS**: Always use HTTPS in production
- **Secret Key**: Never commit or make `EVE_CLIENT_SECRET` public

## Development

### Type Generation

To generate TypeScript types from GraphQL schema:

```bash
yarn codegen
```

### Watch Mode

To automatically track schema changes:

```bash
yarn codegen:watch
```

## Troubleshooting

### Token Verification Failed

- Check your Eve SSO configuration
- Ensure the callback URL is correct
- Verify that Client ID and Secret are correct

### User Not Found

- Ensure migrations have been run
- Check that database connection is working

## References

- [Eve Online SSO Documentation](https://docs.esi.evetech.net/docs/sso/)
- [GraphQL Yoga Documentation](https://the-guild.dev/graphql/yoga-server)
- [jose Library Documentation](https://github.com/panva/jose)
