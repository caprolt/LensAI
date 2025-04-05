# LensAI

Budget control and real-time cost/latency visibility for LLM usage.

## Overview

LensAI helps developers monitor and control their LLM spending with real-time cost tracking, budget alerts, and automatic kill-switches.

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+ and uv
- Docker Desktop
- Cloudflare Wrangler CLI

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd LensAI
   make install
   ```

2. **Set up environment:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start local infrastructure:**
   ```bash
   make infra.up
   ```

4. **Start development servers:**
   ```bash
   make dev
   ```

This will start:
- API server on http://localhost:8000
- Dashboard on http://localhost:3000
- Cloudflare Worker (dev mode)

### Development Commands

```bash
make help          # Show all available commands
make dev           # Start all services
make api           # Start API only
make dashboard     # Start dashboard only
make worker        # Start worker only
make test          # Run all tests
make lint          # Run linting
make format        # Format code
make seed          # Load seed data
make infra.up      # Start infrastructure
make infra.down    # Stop infrastructure
```

## Project Structure

```
LensAI/
├── apps/
│   ├── api/           # FastAPI backend
│   └── dashboard/     # Next.js frontend
├── packages/
│   ├── sdk-python/    # Python SDK
│   ├── sdk-node/      # Node.js SDK
│   ├── cli/           # Local CLI tool
│   └── shared/        # Shared schemas
├── jobs/
│   └── batch/         # Batch processing jobs
├── infra/
│   └── worker/        # Cloudflare Worker
├── docs/              # Documentation
└── scripts/           # Development scripts
```

## Architecture

- **API**: FastAPI with PostgreSQL, Redis
- **Dashboard**: Next.js 14 with TypeScript, Tailwind
- **Ingest**: Cloudflare Worker → R2/S3
- **Analytics**: DuckDB on Parquet files
- **Billing**: Stripe integration
- **Alerts**: Slack notifications

## Environment Variables

Copy `env.example` to `.env` and configure:

- Database connection
- Cloudflare R2 credentials
- Stripe API keys
- Slack webhook
- HMAC secrets

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `make test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.