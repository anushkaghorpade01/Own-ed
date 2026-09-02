# Own-ed

Private founder operating system for planning, launching, and operating **OWN** — a boutique premium Pilates studio.

## Features

- **Command Centre** — founder dashboard with key metrics, decisions, and actions
- **Math** — central financial engine with capacity, pricing, unit economics, scenarios, P&L, cash flow, break-even, and payback
- **Space** — Pinterest-style moodboards for studio design
- **Studios** — competitor intelligence database
- **Library** — universal founder inbox with global search (⌘K)

## Tech Stack

- Next.js 16 + TypeScript + React
- Tailwind CSS 4
- decimal.js for all financial calculations
- Zod for validation
- Recharts for charts
- Supabase/Postgres (optional — localStorage fallback for MVP)
- Vitest for financial engine tests

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Supabase (optional)

1. Create a Supabase project
2. Copy `.env.example` to `.env.local` and fill in credentials
3. Run `supabase/migrations/001_initial_schema.sql` in the SQL editor

Without Supabase, all data persists to localStorage with autosave.

## Financial Engine

All financial calculations use a **single engine** at `src/lib/finance/`. See [docs/finance-model.md](docs/finance-model.md) for formula documentation.

```bash
npm test        # Run financial engine tests
npm run build   # Production build
```

## Sample Data

The app ships with clearly labelled **SAMPLE / NOT ACTUAL** data:
- 3 reformers, 5 classes/day, 6 days/week
- Drop-in ₹2,000 (GST inclusive)
- Credit packs at ₹7,200 / ₹13,600 / ₹19,200

## License

Private — not for public distribution.
