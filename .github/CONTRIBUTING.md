# Contributing to KillReport

First off, thank you for considering contributing to KillReport! It's people like you that make KillReport such a great tool for the EVE Online community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

- Make sure you have a [GitHub account](https://github.com/signup/free)
- Fork the repository on GitHub
- Clone your fork locally
- Set up your development environment (see [Development Setup](#development-setup))

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots or animated GIFs if possible**
- **Include your environment details** (OS, browser, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through `good-first-issue` and `help-wanted` issues:

- **good-first-issue** - issues which should only require a few lines of code
- **help-wanted** - issues which should be a bit more involved than beginner issues

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Follow the [coding guidelines](#coding-guidelines)
- Include screenshots and animated GIFs in your pull request whenever possible
- Document new code based on the project's documentation standards
- End all files with a newline

## Development Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 14+
- Redis 7+
- RabbitMQ 3.12+
- Yarn (recommended) or npm

### Backend Setup

```bash
cd backend

# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
yarn prisma migrate dev

# Start Redis and RabbitMQ (using Docker)
docker-compose up -d redis rabbitmq

# Start development server
yarn dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
yarn dev
```

### Running Tests

```bash
# Backend tests
cd backend
yarn test

# Frontend tests
cd frontend
yarn test
```

## Coding Guidelines

### TypeScript

- Use TypeScript for all new code
- Avoid using `any` type - use proper typing or `unknown`
- Use interfaces for object shapes, types for unions/intersections
- Enable strict mode in tsconfig.json

### Code Style

- Follow the existing code style
- Use ESLint and Prettier for code formatting
- Run `yarn lint` before committing
- Maximum line length: 100 characters (soft limit)
- Use meaningful variable and function names
- Write self-documenting code with clear comments when necessary

### File Naming

- Use kebab-case for file names: `my-component.tsx`, `user-service.ts`
- Use PascalCase for React components: `MyComponent.tsx`
- Use camelCase for utility functions and services: `userService.ts`

### React/Next.js Guidelines

- Use functional components with hooks
- Prefer composition over inheritance
- Keep components small and focused
- Use TypeScript interfaces for component props
- Follow Next.js 15 App Router conventions
- Use React Server Components where appropriate

### GraphQL Guidelines

- Use clear, descriptive names for queries and mutations
- Follow the established schema patterns
- Add proper descriptions to schema definitions
- Use DataLoader for efficient batching

### Database

- Use Prisma migrations for schema changes
- Never edit migration files after they've been committed
- Write clear migration names: `add_user_preferences_table`
- Test migrations in development before committing

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect the meaning of the code
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvements
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

### Examples

```
feat(auth): add EVE SSO token refresh

fix(killmail): correct alliance killmail fetching logic

docs: update installation instructions in README

refactor(api): simplify GraphQL resolver structure
```

## Pull Request Process

1. **Update your fork** with the latest changes from the main repository
2. **Create a new branch** from `main` for your feature or fix
   ```bash
   git checkout -b feat/my-new-feature
   ```
3. **Make your changes** following the coding guidelines
4. **Test your changes** thoroughly
5. **Commit your changes** with clear, descriptive commit messages
6. **Push to your fork** and submit a pull request
7. **Fill out the PR template** completely
8. **Wait for review** - maintainers will review your PR and may request changes
9. **Address feedback** - make requested changes and push them to your branch
10. **Get merged!** - once approved, your PR will be merged

### PR Review Checklist

Before submitting, ensure:

- [ ] Code follows the project's coding guidelines
- [ ] All tests pass
- [ ] New tests are added for new features
- [ ] Documentation is updated if needed
- [ ] Commit messages follow the conventional commits format
- [ ] No merge conflicts with main branch
- [ ] Code has been self-reviewed
- [ ] Changes have been tested locally

## Questions?

Feel free to open an issue with your question, or reach out to the maintainers directly.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to KillReport! 🚀
