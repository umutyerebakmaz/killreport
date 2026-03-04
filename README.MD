# KillReport

**Modern EVE Online Killmail Tracking & Analytics Platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/) [![GraphQL](https://img.shields.io/badge/GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white)](https://graphql.org/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/) [![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/) [![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)

[![Powered by DigitalOcean](https://img.shields.io/badge/Powered_by-DigitalOcean-0080FF?style=for-the-badge&logo=digitalocean&logoColor=white)](https://www.digitalocean.com/)

_Track, analyze, and visualize EVE Online killmails with real-time data synchronization_

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Architecture](#architecture) • [Contributing](#contributing)

---

## Overview

KillReport is a full-stack application built for EVE Online players and corporations to track, monitor, and analyze killmail data. It provides real-time synchronization with zKillboard and EVE ESI APIs, offering comprehensive analytics and a modern, responsive UI.

### Why KillReport?

- **Real-time Sync**: Automated background workers fetch killmails for characters, corporations, and alliances
- **Secure Authentication**: EVE Online SSO integration for seamless login
- **Rich Analytics**: Detailed statistics, filters, and visualizations
- **High Performance**: GraphQL API with DataLoader optimization and efficient caching
- **Scalable**: Distributed job processing with RabbitMQ for horizontal scaling
- **Modern UI**: Built with Next.js 15, React 19, and Tailwind CSS

---

## Features

### Core Functionality

- **EVE SSO Authentication** - Secure login with EVE Online accounts
- **Character Killmail Tracking** - Sync and view killmail history for any character
- **Corporation/Alliance Tracking** - Organization-level killmail aggregation
- **Real-time Updates** - Automated background synchronization via RabbitMQ
- **Advanced Filtering** - Filter by date, ship type, system, and more
- **Pagination** - Efficient loading of large datasets
- **Worker Monitoring** - Real-time status dashboard for background jobs

### Technical Highlights

- **Modern Stack**: Next.js 16 (App Router), React 19, TypeScript 5+
- **GraphQL API**: Type-safe API with automatic code generation
- **Database**: PostgreSQL with Prisma ORM and Materialized Views
- **Background Jobs**: RabbitMQ-based distributed task queue
- **External APIs**: Integration with zKillboard and EVE ESI
- **Type Safety**: Full TypeScript coverage across frontend and backend
- **DataLoader**: Optimized database queries to prevent N+1 problems
- **Performance**: Redis caching and optimized query patterns

---

## Quick Start

### Prerequisites

- Node.js 18+ and Yarn
- PostgreSQL database
- RabbitMQ server (for background workers)
- EVE Online Developer Application ([Create one here](https://developers.eveonline.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/umutyerebakmaz/killreport.git
cd killreport

# Install dependencies (monorepo)
yarn install

# Setup backend environment
cd backend
cp .env.example .env
# Edit .env with your EVE_CLIENT_ID, EVE_CLIENT_SECRET, DATABASE_URL, etc.

# Setup database
yarn prisma:migrate
yarn prisma:generate

# Setup frontend environment
cd ../frontend
cp .env.example .env.local
# Edit .env.local with NEXT_PUBLIC_GRAPHQL_URL

# Return to root and start development servers
cd ..
yarn dev:backend  # Terminal 1 - Starts on http://localhost:4000
yarn dev:frontend # Terminal 2 - Starts on http://localhost:3000
```

## Documentation

### Table of Contents

#### Getting Started

- **[Authentication Setup](./AUTH_SETUP.MD)** - Complete guide to EVE SSO authentication flow
- **[Backend README](./backend/README.MD)** - Backend architecture and API documentation
- **[Frontend README](./frontend/README.MD)** - Frontend setup and component structure

#### Architecture & Design

- **[Database Schema](./backend/prisma/schema.prisma)** - Prisma data models and relations
- **[GraphQL Schema](./backend/src/generated-schema.graphql)** - Auto-generated GraphQL schema

#### Workers & Background Jobs

- **[Complete Workers Documentation](./backend/src/docs/WORKERS_DOCUMENTATION.MD)** - All workers and queues
- **[Character Killmail Worker](./backend/src/docs/CHARACTER_KILLMAIL_WORKER.MD)** - Sync killmails for any character
- **[Killmail Enrichment](./backend/src/docs/ENRICHMENT_README.MD)** - Auto-populate missing entity data
- **[Worker Status Monitoring](./backend/src/docs/WORKER_STATUS_MONITORING.MD)** - Real-time worker health checks
- **[Queue Naming Standards](./backend/src/docs/QUEUE_NAMING_CHANGES.MD)** - Queue naming conventions

#### Quick References

- **[Character Sync Quick Reference](./backend/src/docs/CHARACTER_SYNC_QUICKREF.MD)** - Quick commands for character sync
- **[EVE SSO Documentation](./backend/src/docs/EVE_SSO_README.MD)** - Deep dive into SSO integration

#### Performance & Analysis

- **[Top Charts Cost Analysis](./TOP_CHARTS_COST_ANALYSIS.md)** - Materialized views performance analysis and cost comparison
- **[Unique Features Proposal](./UNIQUE_FEATURES_PROPOSAL.md)** - Planned features and roadmap

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Auth Flow  │  │  Killmails   │  │  Analytics   │          │
│  │   (EVE SSO)  │  │   (Lists)    │  │  (Graphs)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ GraphQL (Apollo Client)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (GraphQL Yoga)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Resolvers  │  │  DataLoaders │  │   Services   │          │
│  │  (Modular)   │  │ (Optimized)  │  │  (ESI/zKill) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────┬──────────────────────────┬──────────────────────┬──────────┘
     │                          │                      │
     ▼                          ▼                      ▼
┌──────────┐          ┌──────────────────┐   ┌─────────────────┐
│PostgreSQL│          │     RabbitMQ     │   │  External APIs  │
│ (Prisma) │          │  (Task Queue)    │   │  - zKillboard   │
│          │          │                  │   │  - EVE ESI      │
│  Users   │          │  ┌────────────┐  │   └─────────────────┘
│  Chars   │          │  │  Workers   │  │
│  Kills   │          │  │  (Sync)    │  │
│  Corps   │          │  └────────────┘  │
│  Alliances│         └──────────────────┘
└──────────┘
```

### Tech Stack

**Frontend:**

- Next.js 16.0.10 with App Router
- React 19.2.0 with Server Components
- Apollo Client 3.11 for GraphQL
- Tailwind CSS 4.1.15 for styling
- TypeScript 5+ for type safety

**Backend:**

- GraphQL Yoga (GraphQL Server)
- Prisma ORM with PostgreSQL
- RabbitMQ for job queues
- DataLoader for query optimization
- TypeScript with auto-generated types

**External Services:**

- EVE Online ESI API
- zKillboard API
- EVE SSO for authentication

---

## Development

### Project Structure

```text
killreport/
├── frontend/              # Next.js application
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components
│   │   ├── generated/     # Auto-generated GraphQL types
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities (Apollo Client)
│   └── package.json
│
├── backend/               # GraphQL API server
│   ├── src/
│   │   ├── schema/        # GraphQL schema files
│   │   ├── resolvers/     # GraphQL resolvers
│   │   ├── services/      # External API integrations
│   │   ├── workers/       # Background job workers
│   │   └── server.ts      # GraphQL Yoga server
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── package.json
│
└── package.json           # Monorepo root
```

### Available Scripts

**Root Level (Monorepo):**

```bash
yarn dev              # Start frontend dev server
yarn dev:frontend     # Start frontend on port 3000
yarn dev:backend      # Start backend on port 4000
```

**Frontend:**

```bash
yarn dev              # Start Next.js dev server
yarn build            # Production build
yarn codegen          # Generate Apollo Client hooks
```

---

## Configuration

### Backend Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/killreport"

# EVE Online SSO
EVE_CLIENT_ID="your_eve_client_id"
EVE_CLIENT_SECRET="your_eve_client_secret"
EVE_CALLBACK_URL="http://localhost:4000/auth/callback"

# Server
PORT=4000
FRONTEND_URL="http://localhost:3000"

# RabbitMQ
RABBITMQ_URL="amqp://localhost"
```

### Frontend Environment Variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_GRAPHQL_URL="http://localhost:4000/graphql"
```

---

## Testing

### GraphQL Playground

Visit `http://localhost:4000/graphql` to access the GraphQL Playground and test queries.

---

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and commit: `git commit -m 'Add amazing feature'`
4. **Push to your branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Contribution Guidelines

- Write clear, descriptive commit messages
- Add documentation for new features
- Ensure TypeScript types are properly defined
- Test your changes thoroughly
- Follow the existing code style

### Areas for Contribution

- Bug fixes and issue resolution
- New features and enhancements
- Documentation improvements
- UI/UX enhancements
- Performance optimizations
- Test coverage
- Internationalization

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

## Acknowledgments

- **[EVE Online](https://www.eveonline.com/)** - For the amazing game and APIs
- **[zKillboard](https://zkillboard.com/)** - For providing public killmail data
- **[CCP Games](https://www.ccpgames.com/)** - For the EVE ESI API

---

## Support & Contact

- **Issues**: [GitHub Issues](https://github.com/umutyerebakmaz/killreport/issues)
- **Discussions**: [GitHub Discussions](https://github.com/umutyerebakmaz/killreport/discussions)
- **In-Game Contact**: General XAN (EVE Online character)
  - Feel free to send ISK, feedback, or questions in-game
  - All donations and feedback are appreciated!

---

**Made with ❤️ for the EVE Online community**
