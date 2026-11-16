# Version 0.2 source provenance

Recovered November 16, 2026 from the archived source named `nine-heavens-0.2-source.tgz`. Original archive SHA-256: `927f2870ec477ddd7d01c0f841d1fa43757e988faa757920fde0787ec9ea4a5b`. Its embedded `GAME_VERSION` is `0.2`.

This is a sanitized standalone PORT of that archive, not a byte-identical reconstruction of the released Android application. All 64 original game, UI, asset and style files other than `src/App.tsx` and `src/main.tsx` are byte-identical. Those two files replace the original hosting shell/persistence dependency with a plain React root and the independently written `src/storage.ts` browser-local adapter. No gameplay changes or unreleased alchemy additions are included.

The source archive contains only src/, no original package manifest, lockfile, build configuration, signing key, Android wrapper, release binary or license grant. This bundle does not invent them. Build/Android configuration must be supplied separately and identified as a new reconstruction. Match React/Vite versions through an actual build, not a claimed original dependency lockfile.

Persistence uses the original game save keys but a new deployment origin has its own storage. Existing hosted/Android saves are NOT automatically carried over. Use the game's save export/import on each device; verify import and offline catch-up before claiming parity. The adapter writes browser localStorage synchronously and does not swallow storage read, parse or write errors. Damaged storage is left untouched and the game error boundary handles the failure. This changes hosting infrastructure behavior, so storage-denied/quota errors and old-save import require integration testing.

No claim of exact binary reproducibility, original Android source completeness or tested browser parity is made. Retain version 0.2 for gameplay provenance but identify the standalone packaging reconstruction separately.
