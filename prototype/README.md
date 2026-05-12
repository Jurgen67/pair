# Pair Prototype

Standalone prompt prototype for **Pair v0.1**. Validates the Claude prompt that produces outfit advice before we invest in Supabase/Expo infrastructure.

## Setup

1. `npm install`
2. `cp .env.example .env`
3. Set `ANTHROPIC_API_KEY` in `.env` to your personal key.

## Run tests

```
npm test
```

## Manual eval (the actual point of this prototype)

1. Maak een persoonlijke Anthropic-account op https://console.anthropic.com (niet via Acto).
2. Maak een API key en zet een budget cap (Settings → Limits, ~$5–10).
3. `cp .env.example .env` en plak de key als `ANTHROPIC_API_KEY=sk-ant-...`.
4. Kopieer ~8–10 foto's van kledingstukken naar `eval-data/`. Hernoem ze naar de paden in `src/fixture.ts` (`top-1.jpg`, `bottom-1.jpg`, `shoes-1.jpg`, `coat-1.jpg`, `style-ref-1.jpg`, etc.).
5. Pas indien nodig `src/fixture.ts` aan zodat `colors`, `category` en `occasion` per item kloppen met wat je daadwerkelijk hebt.
6. Run het advies-script:
   ```
   npm run advise -- top-1
   ```
7. Probeer minstens 3 verschillende anchors:
   ```
   npm run advise -- bottom-2
   npm run advise -- coat-3
   ```
8. Beoordeel met Simone — zie Task 8 in `docs/superpowers/plans/2026-05-12-pair-v0.1-prompt-prototype.md` voor de eval-criteria en gate-beslissing.

`eval-data/` is gitignored; foto's blijven lokaal.
