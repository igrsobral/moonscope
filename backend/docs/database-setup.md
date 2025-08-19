# Database Setup Guide

This document explains how to set up and manage the database for the Meme Coin Analyzer backend.

## Prerequisites

- PostgreSQL 14+ installed and running
- Node.js 20+ installed
- Environment variables configured (see `.env.example`)

## Quick Start

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Generate Prisma client**:
   ```bash
   npm run db:generate
   ```

4. **Run migrations and seed data**:
   ```bash
   npm run db:setup
   ```

## Database Scripts

### Available Scripts

- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database (development)
- `npm run db:migrate` - Create and run migrations (development)
- `npm run db:migrate:prod` - Run migrations in production
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:setup` - Full setup (migrate + generate + seed)
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset database and reseed

### Manual Setup Steps

If you prefer to run setup steps manually:

1. **Create database migration**:
   ```bash
   npx prisma migrate dev --name init
   ```

2. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

3. **Seed database**:
   ```bash
   tsx scripts/db-setup.ts --seed
   ```

## Database Schema

The database includes the following main entities:

### Core Tables

- **users** - User accounts and preferences
- **coins** - Meme coin information and metadata
- **price_data** - Historical price and market data
- **social_metrics** - Social media metrics and sentiment
- **risk_assessments** - Risk analysis scores and factors

### User-Related Tables

- **portfolios** - User portfolio holdings
- **alerts** - Price and event alerts
- **whale_transactions** - Large transaction tracking

### Relationships

- Users can have multiple portfolio entries and alerts
- Coins have associated price data, social metrics, and risk assessments
- All time-series data is indexed for efficient querying

## Environment Configuration

Required environment variables:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/meme_coin_analyzer"
```

Optional database-related variables:

```env
# Prisma logging (development)
PRISMA_LOG_LEVEL="info"

# Connection pool settings
DATABASE_POOL_SIZE=10
DATABASE_TIMEOUT=30000
```

## Development Workflow

### Making Schema Changes

1. **Modify the schema** in `prisma/schema.prisma`

2. **Create migration**:
   ```bash
   npx prisma migrate dev --name describe_your_change
   ```

3. **Generate client**:
   ```bash
   npm run db:generate
   ```

### Seeding Data

The seeding script (`scripts/db-setup.ts`) includes:

- Sample meme coins with realistic data
- Price history and market metrics
- Risk assessments and social metrics
- Test user with portfolio entries

### Database Inspection

Use Prisma Studio for a visual database interface:

```bash
npm run db:studio
```

## Production Deployment

### Migration Strategy

1. **Run migrations**:
   ```bash
   npm run db:migrate:prod
   ```

2. **Generate client** (if not done in build):
   ```bash
   npm run db:generate
   ```

### Connection Pooling

For production, consider using connection pooling:

- PgBouncer for PostgreSQL
- Prisma Data Proxy for managed pooling
- Configure appropriate pool sizes based on load

### Backup Strategy

Implement regular backups:

```bash
# Example backup command
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Troubleshooting

### Common Issues

1. **Connection refused**:
   - Ensure PostgreSQL is running
   - Check DATABASE_URL format
   - Verify network connectivity

2. **Migration conflicts**:
   - Reset development database: `npm run db:reset`
   - Resolve conflicts manually if needed

3. **Client generation fails**:
   - Clear node_modules and reinstall
   - Check Prisma version compatibility

### Health Checks

The application includes database health checks:

- `/health/detailed` - Shows database connection status
- `/health/ready` - Readiness probe for containers

### Logging

Database operations are logged with appropriate levels:

- Connection events: INFO level
- Query errors: ERROR level
- Performance issues: WARN level

## Performance Considerations

### Indexing

The schema includes indexes on:

- Foreign key relationships
- Timestamp fields for time-series queries
- Frequently queried fields (coin addresses, user IDs)

### Query Optimization

- Use appropriate `select` clauses to limit data
- Implement pagination for large result sets
- Consider caching for frequently accessed data

### Monitoring

Monitor these metrics:

- Connection pool utilization
- Query execution times
- Database size and growth
- Index usage statistics