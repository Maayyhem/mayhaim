# Changelog — MayhAim

## 2.4.3 — 2026-04-24

### 🎯 Déverrouillage FPS Electron — c'était ÇA la vraie cause
Le filtre adaptatif de 2.4.2 améliorait la situation mais n'adressait pas la racine : **Chromium capait à 60 FPS** par défaut sur l'app packagée, même avec un écran 144Hz+. Résultat : sur un 144Hz, l'utilisateur voyait 1 frame sur 2.4, ce qui donne cette triade "stutter + sensi trop basse + lag" — parce qu'entre deux frames affichées à 16.7ms, la souris bouge ~2× plus qu'attendu mais le rendu ne suit pas.

Switches Chromium ajoutés dans `electron-main.js` **avant `app.whenReady`** :
- `disable-frame-rate-limit` — supprime le cap 60Hz de rAF
- `disable-gpu-vsync` — laisse rAF tourner à la vitesse du GPU (tearing possible mais latence mini, comme Valorant `NoVSync`)
- `enable-gpu-rasterization` + `enable-zero-copy` — pipeline GPU plus efficace

L'overlay F3 détecte maintenant un cap probable (FPS ∈ [58, 63]) et affiche un warning jaune.

### ⚠ Côté web (mayhaim.vercel.app)
Le navigateur contrôle le framerate, pas MayhAim. Si tu vois 60 FPS dans Chrome alors que ton écran est 144Hz :
- Chrome : chrome://flags → "Disable frame rate limit" → Enabled
- Edge : edge://flags → idem
- Alternative : utiliser l'app Electron (recommandé pour le feel compétitif)

## 2.4.2 — 2026-04-23

### 🖱️ Fix sensi/lag — filtre anti-spike adaptatif
Le hotfix 2.4.1 n'adressait pas la vraie cause racine du couple "sensi trop basse + stutter + lag" signalé sur tous les scénarios dès l'ouverture de l'app. Analyse :
- Le filtre `if (Math.abs(rawX) > 300 || Math.abs(rawY) > 300) return;` dans `onMouseMove` datait d'un fix anti-teleport hardware (v2.0.2), mais il est **cassé face au batching d'events** : quand le navigateur regroupe plusieurs samples souris pendant un stall rAF (même léger, 20-30ms), le `movementX` cumulé peut dépasser 300 légitimement, surtout sur flicks rapides. Résultat : le delta est jeté → la caméra ne tourne pas assez → perception "sensi trop basse" + visuel stutter.
- **Fix** : seuil adaptatif calé sur `dtMs` du dernier frame. À 144fps (~7ms) → ~370. À 60fps (~17ms) → ~470. À 30fps (~33ms) → ~630. Les vrais glitches hardware (5000+ counts) restent filtrés.

### 🔍 Diagnostic FPS (F3)
Overlay toggleable pour signaler précisément un lag :
- FPS live + temps frame (actuel + pire sur la dernière fenêtre)
- cm/360 effectif (pour valider la sensi)
- Compteur de drops du filtre anti-spike (si ça monte pendant un stutter, c'est le filtre qui est trop strict)

### 🔄 Bouton "Réinitialiser les paramètres"
Dans Paramètres > Jeu. Wipe la clé `visc_settings` localStorage (sensi, DPI, crosshair, sons, thèmes) et réapplique les defaults. Scores et benchmark préservés. Utile si un save corrompu fait partir la sensi à des valeurs bizarres.

## 2.4.1 — 2026-04-23

### 🔧 Hotfix v2.4.0 — lag + cibles bloquées + fuite d'event listeners
- **Wide Peek / Flick + Delay figés** : les cibles avaient `reaction:true` + `ttl` mais `isDynamicMode` n'incluait pas ces deux modes → `updateDynamic` ne tournait jamais pour eux → le TTL n'expirait jamais, les cibles restaient coincées à l'écran jusqu'à ce qu'on clique. Ajout de `widepeek` et `flickdelay` dans `isDynamicMode`.
- **Spray Control (respawn 400ms inutile)** : la cible est HP-based (14 HP), pas TTL. L'intervalle 400ms allouait un nouveau tableau `G.targets.filter(...)` toutes les 400ms inutilement pendant que la cible était vivante. Retiré de `INTERVAL_MODES` et déplacé sur un `setTimeout` de 150ms dans `hitTarget` (même pattern que gridshot/speedflick).
- **Fuite d'event listeners sur `#click-to-start`** : chaque `startGame` ajoutait 2 listeners (`handler` + `resume`), seul `handler` s'auto-nettoyait. `resume` était dead code (toujours bloqué par `G.running=false`) mais s'accumulait. Avec Benchmark Run enchaînant 19 scénarios, 19 listeners s'empilaient → sur le click suivant, 19 `doCountdown()` + `startTimer()` simultanés → timer qui tick 19× plus vite, son countdown superposé, sensi qui semblait dérailler. Corrigé via `{once: true}` et suppression du `resume` dead code.
- **Race sur `resumeGame`** : `doResume` n'était pas garanti self-removing, et ne clear pas `G.spawnTimer` → deux `setInterval` de spawn possibles en parallèle. Ajout du `clearInterval(G.spawnTimer)` + `{once: true}`.

## 2.4.0 — 2026-04-23

### 🔊 Refonte audio — moins fatigant, plus modulable
Le son "tir sur les boules" actuel dérangeait certains joueurs. Rework complet :
- **3 nouveaux packs doux** : Wood (tock boisé, organique), Tonal (notes pures pentatoniques), Minimal (clic quasi inaudible)
- **4 packs existants retunés** (clean/retro/soft/mechanical) avec volumes et fréquences moins aggressives
- **Sub-volumes par type** : slider dédié au volume des hits (indépendant du master)
- **Mute sélectif** : toggle pour désactiver le son de miss et le son de combo (tous les 5 hits) — le chime répété en combo était la source principale de fatigue
- Stocké en localStorage (`soundVolumeHit`, `soundMissEnabled`, `soundComboEnabled`)

### 🎯 4 nouveaux scénarios d'entraînement pur
Hors benchmark, orientés gamesense + mécaniques spécifiques Valorant :
- **Counter-Strafe** (tracking) — cible suit un pattern ADAD (stop/move) pour pratiquer le stop-shot
- **Wide Peek** (clicking) — cible apparaît à l'extrême bord latéral, pour travailler les wide peeks
- **Spray Control** (clicking) — Phantom/Vandal simulation avec recul vertical puis horizontal sur 30 balles, HP-based
- **Flick + Delay** (clicking) — cible apparaît après délai variable (0.4-1.4s) pour entraîner la discipline + réactivité

### 🔁 Mode Benchmark Run
Enchaîne tous les scénarios débloqués du tier actuel en une seule session :
- Écran de transition entre scénarios avec barre de progression, score du scénario précédent, threads gagnés
- Bouton "Terminer maintenant" pour s'arrêter à tout moment (le partiel est conservé)
- Écran de summary final : rang Viscose global atteint, breakdown par catégorie (Control/Reactive/Flick/Click timing), total threads, accuracy moyenne
- Historique des 20 derniers runs via bouton "Historique" (clic sur une ligne pour re-voir le summary) — stocké en localStorage (`visc_bench_runs`)
- Accessible depuis la hub Viscose (bouton gradient "Benchmark Run")

### 📊 Corrélation Aim ↔ Valorant
Nouvelle carte sur la page Profil qui met en regard l'aim pur avec les stats in-game :
- **Côté aim** : 3 sous-scores (Tracking / Clicking / Flicking, 0-100) calculés depuis les threads Viscose du tier medium, plus une estimation de rang aim (Iron 1 → Radiant)
- **Côté IG** : rang Valorant live (via Henrik), HS%, K/D, ACS, WR — récupéré automatiquement si le compte Riot est lié
- **Delta de rang** : +X tiers quand l'aim dépasse l'IG (gamesense à travailler), -X quand l'IG dépasse l'aim pur (aim à bosser)
- **Diagnostic ciblé** (jusqu'à 3 tips) : détecte par ex. "clicking élevé mais K/D < 1.0 → travaille sous pression", "tracking faible → Smoothbot/Controlsphere 10min/j", "HS% IG < aim flick → crosshair trop bas, travaille Pasu Angelic"
- CTA vers le tracker si le compte Riot n'est pas encore lié

## 2.3.1 — 2026-04-23

### 🔧 Fix · tracker Valorant (API Henrik v4.0.0 breaking changes)
Le tracker Valorant ne répondait plus depuis que Henrik a poussé sa v4.0.0 :

- **URL v3 mmr** : depuis v4.0.0, `/valorant/v3/mmr/{region}/{name}/{tag}` a été remplacé par `/valorant/v3/mmr/{region}/{platform}/{name}/{tag}` — le segment `/pc/` manquant faisait 404 sur tous les clients. Migré l'extraction de l'historique RR vers l'endpoint dédié `/valorant/v2/mmr-history/{region}/pc/{name}/{tag}` qui retourne exactement ce dont on a besoin (map `match_id` → RR delta) et qui reste le path recommandé post-v4
- **Parser résilient** : la nouvelle structure renvoie `data[]` (array plat) avec `mmr_change_to_last_game`, alors que l'ancienne v3 exposait `data.history[]` avec `last_change`. Le code tente maintenant les deux pour éviter une régression si Henrik rechange
- **Clé API manquante côté serveur** : depuis v4.0.0, toutes les routes Henrik exigent un header `Authorization`. Si `HENRIK_API_KEY` n'est pas défini côté Vercel, `fetchHenrik` log désormais un warning explicite à chaque appel et les handlers renvoient un `503` clair (`"Service Valorant indisponible — clé API manquante ou invalide côté serveur"`) au lieu d'un 502 générique

### 🔍 Observabilité
- `fetchHenrik` log maintenant `[henrik] <status> <path> — <message>` sur toutes les erreurs 4xx/5xx (hors 404), visible directement dans les logs Vercel

## 2.3.0 — 2026-04-23

### 🎨 Refonte complète du système de rang → Viscose Benchmark
Bascule des noms de rang Voltaic (Iron/Bronze/Silver/Gold/Platinum/Diamond/Legendary/Mythic) vers les noms officiels **Viscose Benchmark** (benchmark communautaire Kovaaks par Viscose + pinguefy), avec des palettes distinctes **par tier** :

- **Easier (8 rangs)** : Lemming → Hare → Ermine → Penguin → Fox → Mammoth → Orca → Seal
- **Medium (8 rangs)** : Cinnabar → Vermillion → Saffron → Celadon → Cerulean → Lavender → Indigo → Fuchsia
- **Hard (6 rangs)** : Wool → Linen → Velvet → Chiffon → Satin → Silk

### 🔧 Interne
- **Nouvelle constante `VISCOSE_RANKS`** (game3d.js) — `{names, colors, pct}` par tier. `pct` = seuils 0-1 sur la proportion de threads accumulés vs max du tier, calibrés sur la distribution Viscose (le premier rang se débloque dès le premier thread, rangs suivants à 8% / 18% / 30% / 45% / 60% / 75% / 90% pour easier+medium, 10% / 25% / 42% / 60% / 80% pour hard)
- **`calcRankFromThreads(threads, tier?)`** — accepte un tier optionnel (défaut = `currentTier`). Plus de tableau de noms hardcodé
- **`scenarioRankName(threads, tier?)`** — nouveau helper per-scenario (remplace l'ancien tableau `_TNAMES`)
- **`_pfRenderBench`** (coaching.js) — la carte "Viscose Benchmark" du profil utilise désormais `VISCOSE_RANKS.medium` au lieu des noms Voltaic hardcodés
- **Écran de fin de run** — affiche désormais le nom de rang Viscose atteint (Cinnabar, Vermillion...) au lieu de juste "X/Y Threads" ; la carte threads reste visible en dessous
- **Rang Viscose sur la home** — `updateMenuStats()` calcule et affiche le rang global courant dans la hero card (champ `home-rank-value` qui restait à "Unranked")
- **Labels de scénarios** — le sheet Viscose référence les scénarios Kovaaks avec des noms verbeux ("VT Controlsphere Novice S5 Hard"), le jeu garde les labels courts existants qui restent lisibles en UI

### 📝 Note sur les seuils
Les seuils de tracking du jeu (`th` = 400-900) **ne matchent pas** les seuils du sheet Viscose (5000-22000) : le jeu stocke le score tracking en précision × 10 (0-1000) alors que Kovaaks utilise un score brut cumulé en milliers. L'architecture Viscose (noms, rangs, tiers, pct) est strictement respectée ; seule l'échelle de score diffère, ce qui est transparent pour le joueur

## 2.2.4 — 2026-04-23

### 🎯 Fix · scénarios clicking / switching qui ne collaient pas au nom Kovaaks
Second audit, cette fois sur les 17 scénarios click/switch. 5 corrections :

- **Controlsphere Click** — était une petite orbite 2D plate (sinus/cosinus sur X et Y), rien à voir avec le Kovaaks éponyme. Refait en dérive 3D libre bornée dans une sphère de 1.6m avec rebond élastique sur la paroi et changements de direction aléatoires (0.5-1.8s selon difficulté). La cible se déplace vraiment sur les trois axes comme un vrai bot Controlsphere
- **DomiSwitch** — séparation de 6m trop étroite pour un "dominant switching" + **bug** : `switch_move` utilisait `bx=[-3,0,3,4.5][idx]` hardcodé au lieu des positions passées à `mkSwitchTargets`, donc la cible idx=1 oscillait autour de x=0 au lieu de x=3. Corrigé : `mkSwitchTargets` capture maintenant les positions de spawn comme `baseX/baseY/baseZ`, utilisées par tous les movements `switch_*`. Séparation élargie à ±5m (10m de span)
- **w1w3ts Reload** (label "1w3ts" / "1w2ts" en hard) — le nom annonce 3 cibles (2 en hard), l'impl en affichait 5/4/6 via `d.maxT`. Forcé à 3 (2 en hard) pour coller au nom
- **Pasu Perfected** (label "1w2ts") — annonçait 2 cibles, en faisait 2/3/5 selon la difficulté. Forcé à 2 toujours
- **Pasu Micro** (label "1w3ts") — annonçait 3 cibles, en affichait 4. Forcé à 3. Cibles un peu plus petites (0.18-0.26) pour un vrai ressenti "micro"

### 🔧 Interne
- `mkSwitchTargets` expose `baseX/baseY/baseZ` sur chaque cible switch → tous les patterns `switch_float` / `switch_micro` / `switch_smooth` / `switch_move` oscillent désormais autour de la position de spawn (fin des positions hardcodées qui ne survivaient pas aux réutilisations du factory)

## 2.2.3 — 2026-04-23

### 🎯 Fix · scénarios tracking qui ne collaient pas au nom Kovaaks
Audit complet des 18 scénarios tracking. 4 corrections majeures :

- **Leaptrack** (CRITIQUE — était impossible) : téléportait la cible toutes les 0.65-1.35s à une nouvelle position, ce qui cassait complètement le tracking (le joueur se retrouvait à flicker au hasard). Le vrai Leaptrack Kovaaks fait *sauter* (arc parabolique avec gravité) un bot qui strafe horizontalement. Refait proprement : strafe ADAD wrist-scale + jumps paraboliques à cadence 1.1-2.2s selon la difficulté
- **Flicker Plaza** : téléportait la cible au lieu de la faire *clignoter* (visibilité ON/OFF). Désormais la cible bouge en continu et son opacité toggle à cadence rapide (0.20-0.55s). Le raycast reste actif pendant l'invisibilité → le joueur est récompensé s'il continue à tracker la trajectoire prédite. Matériau cloné par cible pour ne pas affecter les autres
- **Controlsphere rAim** : était une spirale expansive/contractante — rien à voir avec une sphère. Refait en mouvement 3D fluide borné dans une sphère de 1.6-2.2m, direction changes aléatoires tous les 0.35-1.6s, rebond élastique sur la paroi. Range wrist
- **Controlsphere Far** : était un flyby type avion — rien à voir avec une sphère. Même logique que rAim mais sphère plus grande (2.0-2.6m) centrée à z=-14, angles visuels plus petits → test la précision fingertip

### 🧹 Nettoyage
- `_disposeMesh` dispose maintenant les matériaux flaggés `userData.cloned = true` pour éviter les leaks (le flicker_plaza clone son material à chaque spawn)

## 2.2.2 — 2026-04-21

### 🔧 Fix · version affichée dans le "À propos"
- **Le site web affichait toujours `v2.0.2`** — le fallback hardcodé dans `ui.js` (ajouté en release 2.0.2 et jamais bumpé depuis) était utilisé quand `window.MAYHAIM_VERSION` est absent, c'est-à-dire **sur la version web** (le preload Electron qui injecte la version n'y tourne pas). Résultat : toutes les releases 2.0.3 → 2.2.1 étaient invisibles côté site
- **Nouveau mécanisme robuste** — la version est maintenant lue depuis une balise `<meta name="app-version">` présente dans `index.html` et `profile.html`. Source de vérité : (1) Electron preload (desktop), (2) meta tag (web), (3) fallback. À bumper à chaque release en même temps que `package.json`

## 2.2.1 — 2026-04-21

### 🔧 Fix · badges percentile sur le profil
- **Le badge suit désormais la difficulté du joueur** — en 2.2.0 la recherche de percentile était hard-codée sur `medium`, donc les joueurs qui font tout en `easier` ou `hard` ne voyaient jamais de badge. On prend maintenant le couple `(scenario, difficulty)` où le joueur a son meilleur score et on compare à la distribution de CETTE difficulté précise. Cohérent : les scores ne sont pas comparables entre tiers

## 2.2.0 — 2026-04-21

### 📊 Benchmark Analytics (sprint « les chiffres parlent »)
- **Nouvelle table `benchmark_stats_daily`** — snapshot quotidien pré-agrégé par `(scenario, difficulty, day)` contenant `p10 / p25 / p50 / p75 / p90`, `run_count`, `unique_users`, `avg_score`, `max_score`, `avg_accuracy`. Les lectures de percentiles deviennent O(1) au lieu de re-scanner `benchmark_runs` à chaque call
- **Script `scripts/aggregate-benchmark-stats.js`** — idempotent. Modes : hier+aujourd'hui (défaut, à caller quotidiennement), `BACKFILL_DAYS=N`, `FULL_BACKFILL=1`, ou un jour précis avec `DAY=YYYY-MM-DD`. Upsert `ON CONFLICT DO UPDATE`. Ne touche pas aux runs free-play (`is_benchmark=false`)
- **Badges percentile sur les profils publics** — chaque mode du top affiche un badge « TOP 10% / 25% / 50% » estimé par interpolation linéaire entre les breakpoints p10…p90 pré-calculés. Masqué en dessous du top 50% pour ne pas shame les joueurs. Basé sur la difficulté medium (la plus jouée)
- **Compteur d'heures d'entraînement** — nouveau pill bleu sur les profils : « ⏱ 42h d'entraînement ». Inclut free-play + benchmark (somme de `duration`). Formatage intelligent (`X min` / `Xh Ymin` / `Xh`)
- **Onglet Admin Analytics** — nouveau bloc dans le panneau `/admin` :
  - 4 cartes résumé : runs, benchmark runs, users actifs, temps cumulé (fenêtre 7/30/90j)
  - Table triable des `(scenario, difficulty)` avec runs, users, avg, p50, p90, max — cliquer une ligne sélectionne le chart
  - Chart.js mixte : ligne p50 quotidienne + barres run_count sur la fenêtre choisie
- **Nouveau `GET /api/benchmark?view=stats-overview`** (admin-only) — alimente le dashboard Analytics. Retourne la dernière snapshot par `(scenario, difficulty)` + totaux globaux sur la fenêtre
- **`GET /api/benchmark?view=stats`** étendu — renvoie maintenant aussi un champ `trend` (série quotidienne p50 + run_count) lu depuis la snapshot pré-agrégée

### ⚠️ Action requise côté ops (un seul coup, puis cron quotidien)
Premier backfill manuel après le déploiement de 2.2.0 (la table `benchmark_stats_daily` sera créée automatiquement au premier run) :
```
DATABASE_URL=... FULL_BACKFILL=1 node scripts/aggregate-benchmark-stats.js
```
Puis planifier un cron quotidien (Vercel Cron, GitHub Actions nightly, etc.) :
```
DATABASE_URL=... node scripts/aggregate-benchmark-stats.js
```
Tant que le cron n'a pas tourné, les badges et l'onglet Analytics affichent gracieusement « pas encore de données ».

### 📦 Sans impact utilisateur
- API rétrocompatible : `/api/coaching?view=public-profile` garde tous ses champs existants, on n'a fait qu'ajouter `training_hours`, `training_seconds`, `benchmark_runs_count` dans `stats` et `percentile` sur chaque `top_modes[]`
- Pas de migration localStorage — aucun changement client-side sur les caches existants
- Les clients 2.1.x continuent de fonctionner (les nouveaux champs sont ignorés par l'UI ancienne)

## 2.1.0 — 2026-04-21

### 📊 Benchmark Analytics (sprint fiabilité des runs)
- **Rate limit `/api/benchmark`** — 100 runs/heure, 2000 runs/jour par utilisateur non-admin. Ces bornes sont volontairement très larges (un grinder sérieux fait ~500 runs/jour) ; elles existent surtout pour empêcher l'empoisonnement automatisé de la table des percentiles. 429 avec message explicite si dépassé
- **Anti-outlier soft** — tout score soumis > 2.5 × max all-time du scénario (à difficulté égale, et seulement si le record existant > 100) est loggé dans `console.warn` avec `[benchmark] Suspicious score`, sans rejet. Faux positifs possibles quand un joueur bat réellement un record, donc on préfère logger pour review plutôt que bloquer
- **Offline queue (`window.bgFetch`)** — les POST `/api/history` et `/api/benchmark` sont désormais mis en file dans `localStorage` si le joueur est offline ou si le serveur renvoie 5xx. Rejoués automatiquement au retour du réseau. Cap : 100 entrées (FIFO), TTL 7 jours, les 4xx (token expiré, payload invalide) sont drop immédiatement. Les GET ne sont pas queues (les réessais naturels suffisent)
- **Nouveau `GET /api/benchmark?view=stats`** — renvoie `p10 / p25 / p50 / p75 / p90`, `run_count`, `unique_users`, `avg_score`, `max_score`, `avg_accuracy` pour un couple `(scenario, difficulty)` sur une fenêtre glissante (défaut 30j, max 365j). Calcul via `PERCENTILE_CONT WITHIN GROUP`. Servira aux tooltips « tu es dans le top X% » et à un futur onglet admin Analytics
- **Script `scripts/purge-old-runs.js`** — rétention 90j pour les runs benchmark (configurable via `RETENTION_DAYS`), 30j pour les free-play. **Les best-of-all-time par `(user_id, scenario, difficulty)` sont exemptés** pour préserver la progression longue-durée. Supporte `DRY_RUN=1` pour inspecter avant suppression

### 📦 Sans impact utilisateur
- Aucun changement de schéma DB (la table `benchmark_runs` existe depuis 1.0.0)
- Aucune migration localStorage — les clients 2.0.x continuent de fonctionner (la queue `mayhaim_bg_queue` est créée à la première utilisation)
- L'API reste rétrocompatible : les clients qui n'utilisent pas `view=stats` ne voient aucune différence

## 2.0.5 — 2026-04-20

### 🔧 Robustesse (sprint fiabilité)
- **Régression CSP corrigée** — la policy ajoutée en 2.0.4 bloquait `cdn.jsdelivr.net`, donc Chart.js ne se chargeait plus (graphiques vides sur le profil et le dashboard). `script-src` inclut désormais explicitement `https://cdn.jsdelivr.net`
- **Banner de connexion** — un bandeau rouge apparaît en haut de l'écran dès que le navigateur passe offline, et s'efface automatiquement au retour (toast « Connexion rétablie »). Fonctionne aussi côté Electron (suit l'état réseau de l'OS)
- **21 `alert()` remplacés par des toasts** — dans le panel admin (change-role, lock, unlock, reset-mfa, delete, create-announcement, delete-rel, seed-scenarios, etc.) : plus de popups bloquantes, messages contextuels avec icônes (warn / error / success)
- **14 `catch {}` muets instrumentés** — tous les catch qui enveloppaient un `fetch()` appellent désormais `logErr(context, err)` pour un log console structuré (ex. `[mayhaim:admin-load-stats]`). Les caches localStorage corruption-tolerants restent silencieux (comportement volontaire)
- **Helper `send-message` explicite** — un échec d'envoi de message dans le chat coach ↔ élève est maintenant notifié à l'utilisateur (« Message non envoyé »), au lieu d'être silencieusement perdu

### ♻️ Refactor
- **`san()` centralisé** — dédupliqué (3 copies) vers `window.san` dans `ui.js`, avec `window.logErr()` associé
- **Naming conventions** — messages d'erreur harmonisés ("Erreur : " au lieu de "Erreur: ")

### 📦 Sans impact utilisateur
- Aucun changement de format localStorage, pas de migration nécessaire
- Aucune modification d'API : les clients 2.0.4 restent compatibles

## 2.0.4 — 2026-04-19

### 🔒 Sécurité (sprint audit)
- **CORS strict** — la regex `mayhaim[^.]*.vercel.app` acceptait n'importe quel sous-domaine Vercel commençant par "mayhaim" (ex: un projet Vercel tiers nommé `mayhaimclone`). Remplacée par un match exact sur `ALLOWED_ORIGIN` (par défaut `https://mayhaim.vercel.app`)
- **Content-Security-Policy** — header `Content-Security-Policy` ajouté dans `vercel.json` : bloque l'injection de scripts tiers, iframes non-autorisés, plugins, etc. Tolère les embeds YouTube et les images HTTPS (Discord/Riot CDN)
- **Token Discord OAuth protégé** — après auth Discord, le token JWT est désormais renvoyé via le fragment d'URL (`#discord_token=…`) au lieu de la query-string. Les fragments ne sont ni envoyés au serveur, ni loggés par Vercel, ni inclus dans le header `Referer` vers d'autres sites
- **MFA défense-en-profondeur** — `api/update-role.js` (actions admin : lock, unlock, reset-mfa, delete-user, change-role) rejette désormais les tokens partiels ou non-vérifiés MFA
- **Warning JWT_SECRET faible** — détection automatique au cold-start d'un secret trop court (<32 chars) ou correspondant à un pattern dictionnaire connu. Log console immédiat

### ⚠️ Action requise côté ops
Le `JWT_SECRET` actuel en production correspond au pattern faible détecté. Pour rotater :
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
puis mettre la valeur dans Vercel → Settings → Environment Variables → `JWT_SECRET`. Cette rotation **invalide toutes les sessions existantes** (utilisateurs devront se reconnecter une fois).

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
