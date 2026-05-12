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

Volledig protocol met operationele definities (hallucinatie, persoonlijk), procedure, beoordelingscriteria, gate-beslissing en eval-run-template staat in **[`docs/manual-eval-protocol.md`](../docs/manual-eval-protocol.md)**. Lees dat voor je gaat zitten.

Snelle setup-volgorde:

1. Maak een persoonlijke Anthropic-account op https://console.anthropic.com (niet via Acto).
2. Maak een API key en zet een budget cap (Settings → Limits, ~$5–10).
3. `cp .env.example .env` en plak de key als `ANTHROPIC_API_KEY=sk-ant-...`.
4. Kies samen met Simone 8–10 **diverse** items (verschillende kleuren, stijlen, gelegenheden — niet alleen lievelingen) + 2 outfit-foto's voor style-references. Maak foto's, hernoem naar de paden in `src/fixture.ts` (`top-1.jpg`, `bottom-1.jpg`, etc.), plaats in `eval-data/`.
5. Pas `src/fixture.ts` aan zodat `colors`, `category`, `occasion` en `proportionsText` kloppen met wat ze werkelijk heeft.
6. Run minimum **4 anchors** — één uit elke categorie:
   ```
   npm run advise -- top-1
   npm run advise -- bottom-1
   npm run advise -- shoes-1
   npm run advise -- coat-1
   ```
7. **Vóór elk run:** vraag Simone hardop wat zij erbij zou pakken. Schrijf op. Dan pas runnen en vergelijken. Dit is de pre-prediction-stap uit het protocol.
8. Vul één eval-run-bestand in `docs/eval-runs/2026-MM-DD-run-N.md` volgens het template uit het protocol. Commit het.

`eval-data/` is gitignored; foto's blijven lokaal. Eval-run-bestanden zelf zijn wél te committen (geen foto's erin).
