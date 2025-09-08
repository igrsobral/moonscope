.PHONY: help build up down logs clean dev-up dev-down dev-logs test

# Default target
help:
	@echo "Available commands:"
	@echo "  build      - Build all Docker images"
	@echo "  up         - Start production services"
	@echo "  down       - Stop production services"
	@echo "  logs       - View production logs"
	@echo "  dev-up     - Start development services"
	@echo "  dev-down   - Stop development services"
	@echo "  dev-logs   - View development logs"
	@echo "  clean      - Remove all containers and volumes"
	@echo "  test       - Run tests in container"
	@echo "  db-reset   - Reset database with fresh data"
	@echo "  db-migrate - Run database migrations"

# Production commands
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

# Development commands
dev-up:
	docker-compose -f docker-compose.dev.yml up -d

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

# Utility commands
clean:
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -f

test:
	docker-compose exec backend pnpm test

db-reset:
	docker-compose exec backend pnpm run db:reset

db-migrate:
	docker-compose exec backend pnpm run db:migrate:prod

# Database management
db-shell:
	docker-compose exec postgres psql -U moonscope -d meme_coin_analyzer

db-studio:
	docker-compose exec backend pnpm run db:studio

# Container shell access
shell:
	docker-compose exec backend sh

# Health checks
health:
	docker-compose ps
	docker-compose exec backend node healthcheck.js