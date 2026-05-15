# Capture-UI — Item delete + lijst — Design

Datum: 2026-05-15. Status: design, nog niet geïmplementeerd. Branch: `feat/capture-ui`.

## 1. Doel

Eén pijnpunt wegnemen dat de eerste echte capture-sessie met Simone (Task 8 in `docs/superpowers/plans/2026-05-12-pair-v0.1-prompt-prototype.md`) zou laten vastlopen: **een foute item-upload kan nu niet ongedaan gemaakt worden** zonder de server te stoppen of via `curl POST /api/reset` álles te wissen. Bij ~30 items garandeert die afwezigheid dat de sessie ergens halverwege strandt.

Dit ontwerp voegt een items-lijst met een delete-knop per rij toe aan de bestaande throwaway capture-UI (`prototype/capture/`). Niets meer.

## 2. Wat bewust NIET in scope zit

- Delete van style-references (komt nu niet voor in de pijn — buiten scope).
- Edit van bestaande items (kleur/categorie/occasion corrigeren). Delete + opnieuw uploaden is voldoende.
- Foto-preview direct na upload als aparte feature. Komt deels gratis mee doordat de lijst thumbnails toont.
- Voortgangsindicatie of "klaar"-knop met spec-validatie.
- UI-knop voor full reset.
- Retroactief tests schrijven voor de bestaande POST-routes (`/api/items`, `/api/style-refs`, `/api/proportions`, `/api/reset`).
- EXIF-rotatie expliciet uitlezen of corrigeren.
- Authenticatie / lockscreen op de lokale server.

Reden om strak te blijven: deze tool wordt weggegooid zodra Plan 3 (echte Expo-app) van start gaat — zie `prototype/capture/README.md`. Throwaway tools verdienen throwaway-sized designs.

## 3. UI-wijziging (`public/index.html`, `public/app.js`)

Binnen de bestaande **Sectie 3 — Items** verschijnt vóór het formulier een lijst van reeds toegevoegde items.

```
Sectie 3 — Items
  Ingevoerde items (5)
    [thumb 48×48]  top-1     wit, casual              [Verwijder]
    [thumb 48×48]  top-2     donkerblauw, werk        [Verwijder]
    [thumb 48×48]  bottom-1  donkerblauwe jeans       [Verwijder]
    [thumb 48×48]  shoes-1   witte sneakers, casual   [Verwijder]
    [thumb 48×48]  coat-1    donkergrijs trenchcoat   [Verwijder]
  ────────────────────────────────────────────────
  Nieuw item toevoegen
    [bestaande formulier blijft ongewijzigd]
```

- Lege staat: kopje "Ingevoerde items (0) — nog geen items toegevoegd". Geen tabel.
- Thumbnails: `<img src="/photos/<filename>" width="48" height="48">`. Pad komt uit `state.items[i].photoPath`, waar `eval-data/` als prefix afgehaald wordt om matchen met de nieuwe static-route.
- Tap op `[Verwijder]` → native `confirm("<id> verwijderen?")`. Bij OK volgt `DELETE /api/items/<id>`. Bij succes wordt de lijst opnieuw gerenderd via de bestaande `updateProgress(data.state)` (uitgebreid om ook de lijst te tekenen, niet alleen de aantallen).
- De render-functie voor de lijst leeft binnen `app.js` als plain JS — consistent met de huidige stijl, geen framework introduceren.

## 4. Server-side wijziging (`src/app.ts`, `src/server.ts`, `src/state.ts`)

### 4.1 Refactor: splits `server.ts` in `app.ts` + `server.ts`

`src/server.ts` start nu meteen `app.listen()` bij import — dat blokkeert supertest. Daarom splitsen we:

- **`src/app.ts`** — bouwt en exporteert `app` (alle routes, multer-setup, static-routes). Geen `listen`, geen QR-print.
- **`src/server.ts`** — wordt klein: `import { app } from "./app.js"` + `app.listen(...)` + QR-print bij startup.

Wat **niet** opgesplitst wordt (om scope te bewaken): geen aparte route-bestanden per resource, geen middleware-modules, geen extra abstractielagen.

### 4.2 Static photos route

Eén regel in `app.ts`, vóór de bestaande routes:

```ts
app.use("/photos", express.static(EVAL_DATA_DIR));
```

Veilig genoeg omdat de server alleen op het lokale netwerk draait (binnen `app.listen(PORT, "0.0.0.0")`) en `eval-data/` toch al door de gebruiker zelf gevuld is. Geen authenticatie nodig.

### 4.3 `DELETE /api/items/:id` endpoint

Gedrag:

1. Laad de fixture uit `items.json` (via bestaande `loadItemsJson`).
2. Zoek het item met de gegeven `id` in `fixture.items`. Niet gevonden → `404 { error: "item not found" }`.
3. Verwijder de fysieke foto van schijf: `fs.unlinkSync(resolve(PROTOTYPE_DIR, item.photoPath))`.
   - `ENOENT` slikken — foto al weg betekent niet dat het verzoek faalt; `items.json` is de waarheid.
   - Andere fouten gooi je door — throwaway tool, geen rollback.
4. Bereken nieuwe state via de nieuwe pure helper `removeItem(fixture, id)` in `state.ts`.
5. Schrijf weg via bestaande `saveItemsJson`.
6. Respons: `200 { state: newFixture }`. Zelfde shape als de andere mutate-endpoints, zodat de client `updateProgress(data.state)` ongewijzigd kan blijven aanroepen.

### 4.4 Nieuwe helper in `state.ts`

`removeItem(fixture, id): WardrobeFixture | null`

- Pure functie, past bij stijl van bestaande `addItem` / `addStyleRef` / `setProportionsText`.
- Geeft `null` als id niet bestaat (laat de route 404 returnen).
- Geeft anders een nieuwe fixture terug met het item gefilterd uit de array. Geen mutatie van de input.

### 4.5 Auto-id gap-fill blijft onveranderd

`nextIdForCategory` vult al gaten (`top-1` + `top-3` aanwezig → next is `top-2`). Geen aanvullende code nodig. Wel een testcase die dit gedrag na een delete bevestigt.

## 5. Tests (TDD vanaf commit 1)

Vitest is in `prototype/capture/vitest.config.ts` al geconfigureerd. `test/` bevat al `qr.test.ts` (3 tests) en `state.test.ts` (~21 tests) — die respecteren we en breiden we uit. Bestaande POST-routes (`/api/items`, `/api/style-refs`, `/api/proportions`, `/api/reset`) krijgen géén retroactieve tests in deze ronde (afzonderlijke beslissing).

### 5.1 `test/state.test.ts` — `removeItem`-tests appenden

Het bestaande bestand bevat al tests voor `emptyFixture`/`loadItemsJson`/`saveItemsJson`/`nextIdForCategory`/`addItem`/`addStyleRef`/`setProportionsText`. Daaraan appenden we een nieuwe `describe("removeItem", …)` met:

- Verwijdert het item met de gegeven id en laat de rest staan.
- Geeft `null` terug bij onbekende id.
- Is immutable: originele fixture-object ongewijzigd.
- Na verwijderen van `top-2` (met `top-1` en `top-3` aanwezig) geeft `nextIdForCategory(newFixture, "top")` terug: `"top-2"` (regressiecheck op gap-fill).

### 5.2 `test/server.test.ts` — integratie-tests met `supertest`

Setup: per test een tijdelijke `EVAL_DATA_DIR` via `os.tmpdir()`, `afterEach` ruimt op. Geen echte eval-data raakt zien.

- **Happy path:** POST een item via `/api/items` (multipart, dummy buffer als foto) → DELETE `/api/items/<id>` → respons 200, `items.json` heeft het item niet meer, fotobestand is van schijf.
- **404 bij onbekende id:** DELETE `/api/items/does-not-exist` → 404 met `error`-veld.
- **Foto al weg (ENOENT geslikt):** POST een item → handmatig de foto van schijf halen → DELETE → 200, `items.json` is bijgewerkt (geen 500).

### 5.3 Niet getest in deze ronde

- Client-side `app.js` (geen browser-test-infra, throwaway, handmatig verifiëren op iPhone).
- Bestaande POST-routes (afzonderlijke beslissing later).
- Visuele check van thumbnails (handmatig).

## 6. Bestanden die aangeraakt worden

- `prototype/capture/src/app.ts` — **nieuw** (splitsing uit `server.ts` + nieuwe DELETE-route + static photos-route).
- `prototype/capture/src/server.ts` — gereduceerd tot `import` + `listen` + QR-print.
- `prototype/capture/src/state.ts` — nieuwe `removeItem`-functie toegevoegd.
- `prototype/capture/public/index.html` — items-lijst-container vóór het formulier in sectie 3.
- `prototype/capture/public/app.js` — render-functie voor lijst + delete-handler met confirm.
- `prototype/capture/test/state.test.ts` — **nieuw**.
- `prototype/capture/test/server.test.ts` — **nieuw**.
- `prototype/capture/package.json` — `supertest` + `@types/supertest` als devDependency.

## 7. Acceptatiecriteria

Klaar wanneer:

- Server start zonder errors; QR-code werkt zoals voorheen.
- Op de iPhone-pagina is een lijst zichtbaar met thumbnails van reeds toegevoegde items.
- Tap op `[Verwijder]` → systeem-popup vraagt bevestiging → bij OK is het item weg uit de lijst, weg uit `items.json` en de fotofile is van schijf.
- Een nieuw item van dezelfde categorie krijgt het laagste vrije id (gap-fill werkt nog).
- `npm test` in `prototype/capture/` draait groen op de nieuwe tests.
- `npm run typecheck` (toe te voegen aan `package.json` indien nog niet aanwezig — open punt voor het plan) is groen, of: TS-strict-build is groen.
- Manuele check op iPhone Safari: kant van een verkeerd toegevoegd item kan binnen 5 seconden gerecovered worden.

## 8. Open punten voor het implementatieplan

- Heeft `prototype/capture/package.json` al een `typecheck` script? Indien niet: toevoegen samen met dit werk of bewust laten?
- `supertest`-versie pinnen (lockfile staat ervoor; check op breuk met huidige Vitest 4.x).
- Concrete commit-volgorde: refactor splitsen eerst (één commit), dan `removeItem` met test, dan endpoint met test, dan UI. Conform commit-stijl-discipline (zie [[feedback-commit-style]] in memory).
