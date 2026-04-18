# Changelog — MayhAim

## 2.0.3 — 2026-04-18

### ✨ Daily Training — vraie rotation quotidienne
- **5 exercices par jour, figés** jusqu'à minuit (local) — le plan est généré une fois par jour à partir d'un seed déterministe et mis en cache dans `localStorage` (`dt_plan_YYYY-MM-DD`)
- **Validation, pas remplacement** — terminer un exo le coche (✅) et l'affiche en vert au lieu de le remplacer par un autre ; l'exo reste visible avec un bouton « Rejouer » pour améliorer son score
- **Barre de progression du jour** — `X/5` visible en haut, passe en vert quand le Daily est complété 🎉
- **Compte à rebours** jusqu'au prochain reset (minuit local) au lieu de texte statique
- **Nettoyage auto** — purge les plans/completions > 7 jours pour garder `localStorage` propre

### 🔧 Fiabilité
- Le marquage « terminé » utilise la date locale (pas UTC), donc plus de cas où un exo terminé à 23h50 apparaît non-validé le lendemain matin à 00h10
- Free-play (hors Daily) ne pollue plus la complétion du jour — seul un lancement depuis la liste Daily compte

## 2.0.2 — 2026-04-17

### 🛠 Fixes & correctness
- **KAST scoreboard** — fixed round-index alignment so per-player KAST% is no longer stuck at 100%
- **GPU memory** — `clearScene` now disposes target/room geometries between rounds (shared materials preserved)
- **Race-safe hits** — `hitTarget` guards against late clicks on targets destroyed mid-frame
- **Packaged builds** — Ctrl+Shift+I devtools shortcut disabled outside dev mode

### ⬇ Auto-update
- **"Vérifier les mises à jour"** bouton dans le modal *À propos* (version desktop) — statut live (vérification, disponible, téléchargement, installé)
- **CI release workflow** — push d'un tag `v*.*.*` déclenche le build Windows + upload automatique vers GitHub Releases avec `latest.yml`

### 🧹 Cleanup
- Removed dead legacy files: `game.js` (old 2D trainer), `netlify/`, `serve.pl`, `serve.ps1`, `netlify.toml`
- Pruned stale build exclusions from `package.json`

## 1.0.0 — 2026-04-15

**Initial public release 🎉**

### ✨ New
- Complete **Viscose Benchmark** — 42 scenarios across Clicking, Tracking, Switching and Drills
- **3-tier progression system** (Easier → Medium → Hard) with thread-based locking
- **Voltaic-style energy score** and rank ladder (Iron → Celestial)
- **Daily Training** integrated with Viscose threads
- **Warmup** — interactive Visual + Mental phases
- **Coaching Hub** — 21 tactical scenarios on 7 Valorant maps, 58 pro VODs, 24 agents with role guides
- **AI Coach** (Claude integration) for personalized performance feedback
- **Sensitivity converter** (Valorant, CS2, Overwatch, Apex, Fortnite + cm/360 ↔ in-game)
- **Full crosshair editor** (color, size, thickness, dot, outline)
- **4 themes** — Valorant, Midnight, Emerald, Sakura
- **Discord OAuth** + email/password + 2FA (TOTP)
- **Profile page** with stats history, MFA setup, public profile sharing
- **Electron desktop app** (.exe installer + portable for Windows x64)

### 🛠 Technical
- Neon Postgres backend via Vercel serverless
- Three.js WebGL rendering with pointer lock FPS control
- localStorage settings persistence across sessions
- Global toast + error boundary + modal system
- Animated splash screen on launch
