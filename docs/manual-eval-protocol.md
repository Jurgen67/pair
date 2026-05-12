# Pair v0.1 — Protocol voor handmatige evaluatie

> Hoort bij Task 8 van `docs/superpowers/plans/2026-05-12-pair-v0.1-prompt-prototype.md`. Vult de spec aan op `docs/superpowers/specs/2026-05-12-pair-v0.1-design.md` §7.

## Doel

Toets of de Claude-prompt outfit-advies van voldoende kwaliteit levert om Plan 2 (Supabase + Edge Function) en Plan 3 (Expo-app) te rechtvaardigen.

**Wat dit protocol wél valideert:** of het kern-advies inhoudelijk goed kan zijn.
**Wat dit protocol NIET valideert:** of de app-ervaring werkt voor Simone. Dat komt pas in Plan 3 wanneer ze zelf op haar iPhone iets kan tikken in plaats van dat jij een terminal-commando voor haar runt.

Een groene gate hier betekent dus "het is zinnig om Plan 2 te bouwen" — niet "v0.1 gaat slagen."

## Voorbereiding

### Items kiezen (samen met Simone)

- 8–10 items, **divers** in kleur, stijl en gelegenheid — niet alleen haar lievelings-spullen.
- Spreiding over alle 4 categorieën: top, broek/rok, schoenen, jas.
- 2 outfit-foto's van haarzelf die ze mooi vond — voor `styleReferences`.

Reden voor diversiteit boven lievelingen: lievelingen vormen een te makkelijke testcase. De prompt moet kunnen werken met items die niet vanzelf bij elkaar passen.

### Foto's

- Helder licht, neutrale achtergrond (bed, vloer).
- Hernoemen naar de paden in `prototype/src/fixture.ts` (`top-1.jpg`, `bottom-1.jpg`, enz.).
- Plaatsen in `prototype/eval-data/`. Die map is gitignored — foto's blijven lokaal.

### Fixture aanpassen

- `prototype/src/fixture.ts`: pas `colors`, `category`, en `occasion` aan zodat ze kloppen met de echte items.
- `proportionsText`: laat Simone die zelf invullen in haar eigen woorden. Niet jouw samenvatting.

## Operationele definities

### Hallucinatie

Het advies bevat ten minste één van:

- **(a) Item-ID niet in fixture.** De `advise()`-functie heeft hier sinds commit `9b764a7` een runtime-guard voor — als dit optreedt zie je een foutmelding `Claude returned item IDs not in fixture: ...`. Als de guard ooit faalt of de output toch een onbekende ID toont, is het hallucinatie type (a).
- **(b) Bewering over Simone's lichaam, stijl of voorkeuren die NIET herleidbaar is uit de proporties-tekst.** Voorbeelden:
  - `proportionsText` zegt "korte benen, iets dikkere benen". Uitleg zegt "je houdt van klassieke stijlen" → **hallucinatie (b)**.
  - `proportionsText` zegt "liever geen strakke pijp onder de knie". Uitleg zegt "de wijde pijp werkt beter dan een skinny" → **OK** — directe gevolgtrekking.

### Persoonlijk (inversie-test)

Een uitleg is **persoonlijk** als de inversie-test faalt: vervang Simone's `proportionsText` mentaal door iets anders (bv. "lange benen, smal silhouet") en kijk of de uitleg nog steeds even goed past.

- Past de uitleg even goed met andere proporties → **generiek**.
- Past de uitleg NIET meer met andere proporties (er zou iets moeten veranderen) → **persoonlijk**.

Generieke uitleg is geen ramp — het betekent alleen dat de AI Simone's specifieke context niet benut. Voor advies dat zich onderscheidt van een willekeurige stylist wil je persoonlijk.

## Procedure per anchor

1. **Kies anchor.** Test minimum 4 — één per categorie (top, broek/rok, schoenen, jas). Bij voorkeur 8, één per item in de fixture.
2. **Pre-prediction (kritiek).** Voordat je de CLI runt: vraag Simone hardop *"als je dit [anchor] zou dragen, wat zou jij erbij pakken?"* Schrijf haar antwoord op — welke broek/rok, welke schoenen, welke jas. Doe dit ECHT eerst, anders verlies je de waarde van de meting.
3. **Run** `npm run advise -- <anchor-id>`.
4. **Verbatim noteren.** De output (anchor + 3 complement-IDs + uitleg) letterlijk in het eval-run-bestand.
5. **Vergelijk met pre-prediction:**
   - **zelfde:** AI komt op dezelfde combinatie uit (saai maar veilig).
   - **positieve verrassing:** AI kiest iets anders + Simone zegt *"ah, dat had ik niet bedacht, maar dat werkt."*
   - **negatieve verrassing:** AI kiest iets anders + Simone zegt *"nee, dat klopt niet omdat..."* — waardevol om te zien.
6. **Beoordeel** volgens de 5 velden (zie hieronder).
7. **Schrijf Simone's verbatim reactie op** — niet jouw samenvatting, haar exacte woorden.

## Per-advies beoordeling (5 velden)

| Veld | Waarden | Hoe te bepalen |
|---|---|---|
| Hallucinatie? | ja(a) / ja(b) / nee | Zie definities |
| Persoonlijk? | ja / nee | Inversie-test |
| Categorieën correct? | ja / nee | 4 unieke slots: top, broek-of-rok, schoenen, jas. Geen 2 broeken, geen accessoires. |
| Zou Simone dit dragen? | ja / nee / misschien | Haar antwoord |
| Verrassings-label | zelfde / positief / negatief | Vergelijk met pre-prediction |

## Gate-beslissing (3 onderscheiden uitkomsten)

### A. Doorgaan naar Plan 2

Alle van het volgende moeten waar zijn:

- ≥2 van 4 anchors hebben "zou dragen" = ja
- ≥1 positieve verrassing in de hele sessie
- 0 hallucinaties van type (a)
- ≤1 hallucinatie van type (b) over alle anchors heen
- ≥2 persoonlijke uitleg

Actie: ADR schrijven in `docs/adrs/2026-MM-DD-prompt-prototype-gate.md`. Daarna `/writing-plans` voor Plan 2.

### B. Itereren — diagnose eerst, dan gericht fixen

Drie verschillende failure modes vragen verschillende fixes. **Diagnose eerst — dan één failure-mode per iteratie. Niet meerdere tegelijk.**

| Failure mode | Wat zie je | Fix-locatie | Richting |
|---|---|---|---|
| **Categorie-fouten** | AI levert 2 broeken bij top-anchor; of noemt iets "jas" wat in jouw fixture een vest is | `prototype/src/fixture.ts` | Data corrigeren — NIET prompt aanpassen |
| **Generieke uitleg** | Uitleg faalt inversie-test consistent | `prototype/src/prompt.ts` SYSTEM_PROMPT | Strakker — meer expliciete instructies om naar proporties te verwijzen |
| **Hallucinaties** | Type (a) of (b) treedt op | `prototype/src/prompt.ts` SYSTEM_PROMPT | Losser — minder uitnodiging tot speculatie; expliciet "alleen beweringen herleidbaar uit proporties-tekst" toevoegen |

**Belangrijk:** mode B (strakker) en mode C (losser) trekken de prompt in tegengestelde richtingen. Tegelijk fixen = prompt-soep. Eén tegelijk, run opnieuw, vergelijk.

Werk per iteratie op een eigen branch (`prompt/iter-1`, `prompt/iter-2`, etc.) zodat je makkelijk kunt vergelijken en terug kunt rollen.

### C. Product heroverwegen

- 0 positieve verrassingen over 4+ anchors.
- Simone vindt geen enkele combinatie acceptabel.
- Anchor-flow voelt voor haar verkeerd ("ik wil het anders").

Pair-idee werkt mogelijk niet in deze vorm voor haar. Andere flow, andere scope, of stoppen.

## Eval-run template

Voor elke complete eval-sessie: maak `docs/eval-runs/2026-MM-DD-run-N.md` (één bestand per sessie). Commit het — zo kun je later vergelijken of een prompt-iteratie écht beter is geworden.

```markdown
# Eval-run 2026-MM-DD-N

## Setup
- Prompt commit: <hash van prototype/src/prompt.ts>
- Fixture commit: <hash van prototype/src/fixture.ts>
- Aantal items in fixture: <N>
- Anchors getest: <komma-lijst van IDs>

---

## Anchor: <id> (<categorie> — <kleur>)

### Pre-prediction (Simone, hardop, vóór AI-output)
- Broek/rok: <id of "weet niet">
- Schoenen: <id>
- Jas: <id>

### AI-output
- Complement 1: <id> (<categorie> — <kleur>)
- Complement 2: <id> (<categorie> — <kleur>)
- Complement 3: <id> (<categorie> — <kleur>)

Uitleg (verbatim):
> <verbatim Claude-tekst>

### Beoordeling
- Hallucinatie? ja(a) / ja(b) / nee — toelichting: <...>
- Persoonlijk? ja / nee — inversie-test: <past uitleg ook bij "lange benen, smal silhouet"? indien ja: generiek>
- Categorieën correct? ja / nee
- Zou Simone dit dragen? ja / nee / misschien
- Verrassings-label: zelfde / positief / negatief

### Simone's verbatim reactie
> "<...>"

### Notities
<eventueel>

---

## Anchor: <volgende id>
... (herhaal blok)

---

## Sessie-conclusie

- Aantal hallucinaties type (a): <N>
- Aantal hallucinaties type (b): <N>
- Aantal "zou dragen" = ja: <N> / <totaal>
- Aantal persoonlijk: <N> / <totaal>
- Aantal positieve verrassingen: <N>
- Aantal negatieve verrassingen: <N>
- Dominante failure-mode (indien iteratie nodig): A (categorie) / B (generiek) / C (hallucinaties) / geen

### Beslissing
- [ ] A. Doorgaan naar Plan 2
- [ ] B. Itereren — failure-mode <A/B/C> aanpakken op branch `prompt/iter-N`
- [ ] C. Product heroverwegen
```

## Tips

- **Eén sessie = één prompt-versie.** Niet tussendoor `prompt.ts` aanpassen — anders kun je niet vergelijken.
- **Simone's verbatim reactie noteren is écht belangrijk.** Jouw samenvatting introduceert bias en doodt het eval-signaal.
- **Item-foto's blijven in `eval-data/`** (gitignored). Ze gaan nooit naar GitHub.
- **API-spend per sessie**: orde van $0.30–0.60 voor 8 anchors. Houd zicht op je budget op `console.anthropic.com`.
- **Het eval-run-bestand zelf is wél te committen** — geen foto's erin, alleen IDs, kleuren, tekst.
