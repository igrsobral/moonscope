# Meme Coin Analyzer

A comprehensive Web3 application for real-time meme coin analysis, sentiment tracking, and trading insights.

## Project Structure

```
meme-coin-analyzer/
├── frontend/          # Next.js 15 frontend application
├── backend/           # Fastify backend API server
├── package.json       # Root workspace configuration
└── README.md         # This file
```

## Quick Start

### Prerequisites

- Node.js 20+ 
- npm 10+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Install dependencies for all workspaces
npm install

# Start development servers
npm run dev
```

This will start both the backend API server and frontend development server concurrently.

### Individual Services

```bash
# Backend only (http://localhost:3001)
npm run dev:backend

# Frontend only (http://localhost:3000)
npm run dev:frontend
```

## Development

### Testing

```bash
# Run all tests
npm test

# Run backend tests only
npm run test --workspace=backend

# Run frontend tests only
npm run test --workspace=frontend
```

### Linting & Formatting

```bash
# Lint all code
npm run lint

# Format all code
npm run format
```

## Architecture

- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **Backend**: Fastify with TypeScript, Prisma ORM, Redis caching
- **Database**: PostgreSQL with Prisma migrations
- **Real-time**: WebSocket connections for live data updates
- **Web3**: Wagmi v2 + Viem for blockchain integration

## Features

- Real-time price tracking and alerts
- Risk assessment and security analysis
- Social sentiment monitoring
- Portfolio management and analytics
- Whale movement tracking
- Liquidity pool analysis
- Mobile-responsive PWA design

## License

Private - All rights reserved