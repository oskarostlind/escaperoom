# AW-utmaningar: Escaperoom + Tidsspelet

Next.js (App Router) + TypeScript + Neon (Postgres) på Vercel (projekt `escaperoom` i Oskars team).

## Två spel, ett repo
- **Escaperoom** – `/` (QR-kod i rummet). Lag registrerar sig, löser gåtor från `data/clues.ts`.
- **Tidsspelet** – `/tid` på en laptop/projektor. Laget skriver in sitt namn, trycker **mellanslag** för att starta,
  och igen när de tror att 60 s gått. Störningar (ljud + bild) hela tiden. **Ett försök per lag.**
  Lägg till `?board=1` i URL:en om topplistan ska synas på skärmen.
- **Admin** – `/admin` (lösenord i env `ADMIN_PASSWORD`). Flikar för båda spelen med pall + alla resultat.
  I Tidsspelet-fliken går det att "Nollställa" ett lag så de får köra igen.

## Lägga till gåtor under dagen
Redigera `data/clues.ts`, committa och pusha till `main` – Vercel deployar på ~1 min. Antalet gåtor är dynamiskt
(nya lag får alla aktiva gåtor i ordning). Sätt `active: false` för att tillfälligt dölja en gåta.

## Databas
Migrationer i `drizzle/` körs automatiskt före varje build (`npm run build` → `scripts/migrate.ts`), så Neon
behöver aldrig röras manuellt.

## Kör lokalt
1) `cp .env.example .env.local` och fyll variabler.
2) `pnpm i` (eller `npm i`).
3) Init DB:
   - `npm run db:migrate`
4) `npm run dev`
5) Öppna `http://localhost:3000`.

## Deploy
- Envs på Vercel:
  - `DATABASE_URL` (sätts av Neon-integrationen)
  - `ADMIN_PASSWORD`
- Deploya via GitHub → Vercel.

## Flöde
- Spelare: `/` → regler + start (skapar team, startar timer).
- Spel: `/play` → ledtråd + siffra → validering, –30s vid fel, 3s cooldown.
- Slut: visar om klart + tid kvar, ej ranking.
- Admin: `/api/admin/login` → `/api/admin` för översikt.

## Data
- `teams`, `submissions`, `content_clues` i Postgres.
- `time_runs` för Tidsspelet (ett lag per rad, unikt på normaliserat lagnamn).

