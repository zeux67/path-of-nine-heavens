# Path of Nine Heavens

A text-based cultivation RPG for browser and Android. Your fate is rolled, not chosen - lock what you like, reroll the rest, and walk the path from a commoner to the Nine Heavens.

![Path of Nine Heavens](docs/screenshot.png)

## Play

- **Browser (current version):** https://zeelmramani.github.io/path-of-nine-heavens/
- **Android:** APKs are attached to each [GitHub Release](https://github.com/zeelmramani/path-of-nine-heavens/releases)
- **Every old version** is playable in the browser from the [version archive](https://zeelmramani.github.io/path-of-nine-heavens/archive/)

## The game

- Closed-door seclusion: cultivate for 1 month to 100 years, with a projection before you go and a full report when you come out.
- Random events shaped by your role, alignment, realm and crafts.
- Spiritual affinity: elements matter for spells and techniques; very rare Heavenly Affinity.
- Karma and heart-demon trials on major breakthroughs.
- Ten crafts: alchemy, refining, talismans, formation, beast taming, spirit farming, geomancy, divination, puppetry, poison.
- Beasts, farm plots, mining and guard puppets, a World Market with real stock, secret realms, tribulation.

## Releases and changelog

Each version has its own [GitHub Release](https://github.com/zeelmramani/path-of-nine-heavens/releases) with its notes in one format (NEW / CHANGED / FIXES) and its Android APK. The full history is also in [CHANGELOG.md](CHANGELOG.md).

## Source and building

`src/` is the released 0.2 game source (React + TypeScript). See [PROVENANCE.md](PROVENANCE.md) for exactly what was recovered and what was reconstructed; `source-manifest.json` lists per-file hashes against the original archive.

Build the browser version (the packaging config here is a labeled reconstruction - the original build setup was not part of the recovered archive):

```
npm install
npm run build
```

This produces a single self-contained `dist/index.html` you can open or host anywhere. `npm run dev` starts a local dev server.

## Saves

Saves are stored locally in your browser or app. To move a save between devices or versions, use Settings - This life - Back up or restore in the game.

## Repository layout

- `src/` - released 0.2 game source (the Android APK builds from this).
- `index.html`, `vite.config.ts`, `package.json`, `tsconfig.json` - reconstructed browser packaging.
- `CHANGELOG.md` - the full player-facing changelog.
- `docs/` - screenshots and documentation images.
- The `gh-pages` branch carries the hosted playable builds (current + archive); it is generated, not source.

## Credits

Made by Zeel Ramani.
