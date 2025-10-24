# KillReport Backend

GraphQL API backend for EVE Online killmail tracking with SSO authentication.

## Features

- 🔐 **EVE Online SSO Integration** - OAuth2 authentication with EVE's Single Sign-On
- 📊 **GraphQL API** - Type-safe API built with GraphQL Yoga
- 🎯 **Modular Architecture** - Clean separation of concerns with domain-based modules
- 🔄 **Auto-generated Types** - TypeScript types generated from GraphQL schemas
- ⚡ **EVE ESI Integration** - Direct integration with EVE's Swagger Interface for killmail data

## Quick Start

**New to EVE SSO?** Check out the [Quick Start Guide](./QUICK_START.md)

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Add your EVE Developer credentials (get them at https://developers.eveonline.com/)

```env
EVE_CLIENT_ID=your_client_id_here
EVE_CLIENT_SECRET=your_client_secret_here
```

### Development

```bash
# Generate GraphQL types
npm run codegen

# Start development server
npm run dev
```

Server runs at: http://localhost:4000/graphql

## Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Get up and running quickly
- **[EVE SSO Integration](./EVE_SSO_INTEGRATION.md)** - Detailed OAuth2 implementation guide
- **[Test Queries](./EVE_SSO_TEST_QUERIES.md)** - Example GraphQL queries
- **[Modular Architecture](./MODULAR_ARCHITECTURE.md)** - Architecture deep dive

## GraphQL API

### Authentication Endpoints

```graphql
# Get EVE SSO login URL
query {
  eveLoginUrl(redirectUri: "http://localhost:3000/auth/callback") {
    url
    state
  }
}

# Exchange authorization code for tokens
mutation {
  eveCallback(code: "...", state: "...", redirectUri: "...") {
    accessToken
    refreshToken
    expiresIn
    character {
      characterId
      characterName
    }
  }
}
```

### Data Queries

See [TEST_QUERIES.md](./TEST_QUERIES.md) for all available queries and mutations.

## Project Structure

```
backend/
├── src/
│   ├── schema/              # GraphQL schemas (.graphql files)
│   │   ├── auth.graphql     # EVE SSO authentication
│   │   ├── character.graphql
│   │   ├── killmail.graphql
│   │   └── user.graphql
│   ├── resolvers/           # GraphQL resolvers
│   │   ├── index.ts         # Resolver aggregator
│   │   ├── auth.resolver.ts
│   │   ├── character.resolver.ts
│   │   ├── killmail.resolver.ts
│   │   └── user.resolver.ts
│   ├── services/            # Business logic & external APIs
│   │   └── eve-sso.service.ts
│   ├── types/               # TypeScript type definitions
│   │   └── eve.types.ts
│   ├── generated-types.ts   # Auto-generated from schemas
│   ├── generated-schema.graphql
│   └── server.ts            # Express + GraphQL Yoga server
└── package.json
```

## Tech Stack

- **GraphQL Yoga** - Modern GraphQL server
- **TypeScript** - Type-safe development
- **GraphQL Code Generator** - Automatic type generation
- **Axios** - HTTP client for EVE APIs
- **Node.js** - Runtime environment

## Contributing

This project follows a modular architecture pattern. When adding new features:

1. Create schema in `src/schema/your-domain.graphql`
2. Run `npm run codegen` to generate types
3. Implement resolvers in `src/resolvers/your-domain.resolver.ts`
4. Add to resolver index in `src/resolvers/index.ts`

See [MODULAR_ARCHITECTURE.md](./MODULAR_ARCHITECTURE.md) for detailed guidelines.

## License

See root LICENSE file.
