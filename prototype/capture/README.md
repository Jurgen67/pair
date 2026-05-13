# Pair Capture

Throwaway lokale webserver om foto's + labels van de Pair-kast te capturen tijdens de v0.1 manual eval. Vervangt de handmatige rename-flow.

## Gebruik

1. `npm install`
2. `npm start`
3. Server print een QR-code in de terminal. Scan met je iPhone (camera-app), of typ de URL in Safari.
4. Vul de pagina in (proporties → style refs → items).
5. Stop de server. Run dan vanaf `prototype/`: `npm run advise -- top-1`.

## Reset

Om opnieuw te beginnen: stop de server, verwijder `prototype/eval-data/items.json` en de foto's in `prototype/eval-data/`. Start de server opnieuw.

## Scope

Throwaway. Wordt weggegooid zodra Plan 3 (echte Expo-app) van start gaat.
