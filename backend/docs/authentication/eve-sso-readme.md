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

Apply pending migrations:

```bash
npx prisma migrate deploy
```

`prisma migrate dev` (and `yarn prisma:migrate`, which is an alias for it) is
never used in this repository, because it would read the drift below as an
invitation to drop tables.

> **Dağıtım notu:** `sessions` tablosu `prisma/migrations/20260921180433_add_sessions`
> migration'ıyla geliyor; bu migration commit edilmiş ama **henüz
> uygulanmamış**. `backend/` dizininden `npx prisma migrate deploy` ile
> uygulanır — bu komut yalnızca bekleyen migration'ları uygular, hiçbir şeyi
> silmez. `npx prisma migrate dev` bu repoda asla kullanılmamalı: `killmail_filters`,
> `character_kill_stats`, `corporation_kill_stats`, `alliance_kill_stats` ve
> `refresh_log` tabloları veritabanında bilerek var ama `prisma/schema/`
> içinde bilerek yok, bu yüzden Prisma bunları drift olarak okur ve silmeyi
> teklif eder. Migration uygulanana kadar her oturum yolu başarısız olur: hem
> `refreshSession` hem de callback var olmayan bir tabloya çarpar, yani kimse
> giriş yapamaz. Önce migration, sonra kod.

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

After the user logs in through Eve SSO, the browser is redirected to the
callback URL with a `code` parameter. The frontend never sees this exchange:
`backend/src/handlers/auth-callback.handler.ts` exchanges the code for an EVE
token, verifies it against EVE's JWKS, upserts the user, creates a row in
`sessions`, sets an `HttpOnly` `kr_session` cookie, and redirects the browser
to `/auth/success` **with no query string at all** — no code, no tokens, no
character id ever appear in the URL, the browser's history, or an access log.

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

### 5. Session Renewal

The frontend never handles a refresh token — there isn't one in the browser.
`/auth/success` calls the argument-less `refreshSession` mutation with
`credentials: 'include'`, so the `kr_session` cookie travels with it instead of
anything in the request body:

```graphql
mutation {
  refreshSession {
    accessToken
    expiresIn
    user {
      id
      name
    }
  }
}
```

The server reads the cookie, resolves the session row, slides its 30-day
lifetime forward, and refreshes the underlying EVE token itself if it is
inside the five-minute expiry buffer — refreshing that token is the server's
job, not the browser's. The browser stores only the returned `accessToken`,
its expiry, and the user summary in `localStorage` (`eve_access_token`,
`eve_token_expiry`, `eve_user`); it keeps no refresh token anywhere. Calling
`refreshSession` again later (e.g. from `useAuth`'s refresh timer) renews the
session the same way.

The cookie itself is `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`, plus
`Secure` in production, and carries no `Domain`, so it is host-only.
`SameSite=Lax` is enough in both environments and `None` is never needed,
because `SameSite` is judged by the registrable domain, not the origin:
`killreport.com` and `api.killreport.com` are the same site, and in
development both ends are `localhost` (cookies ignore the port) — this is also
why CSRF needs no separate token here, since a cross-site POST carries no
cookie and GraphQL's `application/json` body is preflighted, so CORS stops it
too.

The Bearer path is otherwise unchanged: the access token still goes up as
`Authorization: Bearer <token>` on every request, `server.ts` still verifies
it with `verifyToken` against EVE's own JWKS, and the WebSocket
`connectionParams` bridge used for subscriptions is untouched.

### 6. Oturumu Kapatma (Logout)

```graphql
mutation {
  logout
}
```

> **Not:** `logout`, `sessions` tablosundaki satırı `revoked_at` alanını
> doldurarak iptal eder ve `kr_session` çerezini temizler — ama Bearer akışına
> bilerek dokunmaz. Tarayıcıda hâlâ duran EVE erişim tokenı kendi süresi
> dolana kadar (yaklaşık yirmi dakika) çalışmaya devam eder, ve
> `users.access_token` / `users.refresh_token` alanları da olduğu gibi
> bırakılır — arka plan worker'ları o karakteri senkronize etmeye devam eder.
> Yani `logout` tarayıcının oturumunu kapatır; EVE hesabına bağlı erişimi
> anında iptal etmez.

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

1. **Login**: `AuthButton` calls the `login` mutation → gets an EVE SSO URL.
2. **Authorization**: EVE redirects to `/auth/callback`, handled by
   `backend/src/handlers/auth-callback.handler.ts` — it exchanges the code,
   verifies the token against EVE's JWKS, upserts the user, creates a row in
   `sessions`, sets the `kr_session` cookie, and redirects to `/auth/success`
   with no query string.
3. **Session Renewal**: The page calls the argument-less `refreshSession`
   mutation with `credentials: 'include'`; the server reads the cookie,
   resolves the session, slides its 30-day lifetime, refreshes the EVE token
   if it is inside the five-minute buffer, and returns a fresh access token.
4. **Client Storage**: The browser keeps `eve_access_token`,
   `eve_token_expiry` and `eve_user` in `localStorage`. It no longer keeps a
   refresh token anywhere.
5. **Authenticated Requests**: Each request includes the access token as
   `Authorization: Bearer <token>` — this part is unchanged.
6. **Token Verification**: Server verifies the token on each request with
   `verifyToken` against EVE's own JWKS and adds user info to context.

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
