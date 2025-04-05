.PHONY: help dev api dashboard worker test infra.up infra.down seed clean install

help: ## Show this help message
	@echo "LensAI Development Commands"
	@echo "=========================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "Installing Node.js dependencies..."
	pnpm install
	@echo "Installing Python dependencies..."
	uv sync

dev: infra.up ## Start all services in development mode
	@echo "Starting development environment..."
	make -j3 api dashboard worker

api: ## Start FastAPI server
	@echo "Starting API server on http://localhost:8000"
	uv run uvicorn apps.api.main:app --reload --port 8000 --host 0.0.0.0

dashboard: ## Start Next.js dashboard
	@echo "Starting dashboard on http://localhost:3000"
	pnpm --filter @lensai/dashboard dev

worker: ## Start Cloudflare Worker in development mode
	@echo "Starting Cloudflare Worker..."
	cd infra/worker && wrangler dev

test: ## Run all tests
	@echo "Running Python tests..."
	uv run pytest
	@echo "Running dashboard tests..."
	pnpm test --filter @lensai/dashboard

test-python: ## Run Python tests only
	uv run pytest

test-dashboard: ## Run dashboard tests only
	pnpm test --filter @lensai/dashboard

lint: ## Run linting
	@echo "Linting Python code..."
	uv run ruff check .
	@echo "Linting dashboard code..."
	pnpm lint --filter @lensai/dashboard

format: ## Format code
	@echo "Formatting Python code..."
	uv run black .
	uv run isort .
	@echo "Formatting dashboard code..."
	pnpm format --filter @lensai/dashboard

infra.up: ## Start local infrastructure (Postgres, MinIO)
	@echo "Starting local infrastructure..."
	docker compose up -d
	@echo "Waiting for services to be ready..."
	@timeout 30 bash -c 'until docker compose exec -T postgres pg_isready -U lensai; do sleep 1; done' || true
	@echo "Infrastructure ready!"

infra.down: ## Stop local infrastructure
	@echo "Stopping local infrastructure..."
	docker compose down -v

infra.logs: ## Show infrastructure logs
	docker compose logs -f

seed: ## Load seed data
	@echo "Loading seed data..."
	uv run python scripts/seed.py

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf build/
	rm -rf .pytest_cache/
	rm -rf htmlcov/
	find . -type d -name __pycache__ -delete
	find . -type f -name "*.pyc" -delete
	pnpm clean

build: ## Build all packages
	@echo "Building packages..."
	pnpm build
	uv run python -m build

docker-build: ## Build Docker images
	@echo "Building Docker images..."
	docker compose build

docker-push: ## Push Docker images
	@echo "Pushing Docker images..."
	docker compose push

# Development shortcuts
logs: infra.logs ## Show logs (alias for infra.logs)
up: infra.up ## Start infra (alias for infra.up)
down: infra.down ## Stop infra (alias for infra.down)
