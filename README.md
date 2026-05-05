# Padel App

A private padel session tracker for your friend group. Built with Next.js 15 (App Router), Supabase, and Tailwind CSS. Deployed on Vercel.

---

## Stack

| Layer      | Tech                              |
|------------|-----------------------------------|
| Frontend   | Next.js 15 · App Router · React 19 |
| Styling    | Tailwind CSS · shadcn/ui          |
| Backend    | Next.js API Routes (Node.js)      |
| Database   | Supabase (Postgres)               |
| Auth       | Supabase Auth (email/password)    |
| Storage    | Supabase Storage (avatars)        |
| Deployment | Vercel                            |

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once provisioned, go to **Settings → API** and copy:
   - `Project URL`
   - `anon public` key

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Supabase values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the database migration

1. Open your Supabase project dashboard.
2. Go to **SQL Editor**.
3. Paste the contents of `supabase/migrations/001_initial.sql` and run it.

This creates all tables, indexes, RLS policies, triggers, and the avatars storage bucket.

### 5. Install shadcn/ui components

Run these commands to add the UI components used throughout the app:

```bash
npx shadcn@latest init
npx shadcn@latest add button input label dialog tabs switch select toast avatar separator
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo.
3. Add the two environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy. Vercel auto-detects Next.js.

---

## Project Structure

```
padel-app/
├── app/
│   ├── (auth)/login/         ← Login + signup screen
│   ├── (app)/
│   │   ├── home/             ← Home dashboard
│   │   ├── sessions/
│   │   │   ├── page.tsx      ← Sessions list
│   │   │   ├── new/          ← New session wizard (4 steps)
│   │   │   └── [id]/         ← Active session + past session detail
│   │   ├── leaderboard/      ← Ranked player table
│   │   ├── stats/            ← Player stats & analytics
│   │   ├── profile/
│   │   │   ├── page.tsx      ← Own profile + badge gallery
│   │   │   └── [id]/         ← Public player profile
│   │   └── achievements/     ← Full badge catalogue
│   └── api/
│       ├── sessions/[id]/end ← End session → ELO + points + badges
│       ├── sessions/         ← List sessions
│       ├── leaderboard/      ← Leaderboard data
│       └── profile/          ← Update profile
├── components/
│   ├── nav/bottom-nav.tsx    ← Mobile bottom navigation
│   ├── profile/avatar.tsx    ← Avatar with initials fallback
│   ├── session/session-card.tsx
│   ├── leaderboard/leaderboard-row.tsx
│   └── achievements/badge-card.tsx
├── lib/
│   ├── supabase/             ← Browser + server Supabase clients
│   ├── elo.ts                ← ELO calculation + auto-teaming
│   ├── points.ts             ← Points system
│   └── achievements.ts      ← Badge checker (runs on session end)
├── types/index.ts            ← All TypeScript types
└── supabase/migrations/
    └── 001_initial.sql       ← Full DB schema
```

---

## Key Features

- **Auth** — Email/password via Supabase Auth. Auto-profile creation on sign-up.
- **Sessions** — 4-step wizard: pick players → teaming method → format (Bo3/Bo5) → Winner Stays On options.
- **Active Session** — Live score entry, match winner declaration, waiting queue for WSO, 3-win rotation tracking.
- **ELO** — Calculated per match on session end. Team average vs team average, K=32.
- **Points** — 3pts per win, 1pt per loss, 1pt participation bonus per session.
- **Achievements** — 12 badges checked automatically on session end.
- **Leaderboard** — Ranked by total points, shows ELO alongside.
- **Stats** — Win rate, ELO history chart, partnership stats, head-to-head records.
- **Profiles** — Avatar upload to Supabase Storage, public profile with H2H callout.
