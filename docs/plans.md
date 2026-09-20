# Tome of Secrets: build plan

Working title. A deckbuilding roguelike in the Slay the Spire family: three classes,
branching chapter maps, stealable enemy abilities, a persistent Tome of unlocks,
student-drawn enemies with credits, and a story layer written by Paul.

Location now: `make/tomeofsecrets/` (this file and `design.md`). Nothing in this
directory is a game. `make` serves raw files with no build step, so the code lives in
its own repo: **`contrapaul/tomeofsecrets` → `tome.contrapaul.com`**. Phase 0 creates
it; these two files move to `tomeofsecrets/docs/` and a one-line pointer stays here.

`design.md` is the content bible (rules, classes, cards, enemies, relics, events, meta,
dialogue format, schemas, art spec). This file is the roadmap. Update the checkboxes
and the status line as work lands so a new session can pick up without re-reading the
conversation.

**Status:** Phases 0–6 built. **The game is playable start to finish through Chapter 1**
at https://tome.contrapaul.com, and the Tome persists between runs: Bestiary pages,
Secrets, Lore, Pages, Origins, Seals, Boons, Companions, save codes. Checkpoint 1
happened (students wanted a stronger tutorial; done, and the game is a hit). Next:
**Phases 6.1–6.3** from the student feedback (explain on hover/tap, the Tome of
Knowledge, accounts), then **Phase 7**, Chapters 2 and 3. Students can draw now
(`docs/CONTRIBUTING-ART.md`) and record sound (`docs/CONTRIBUTING-AUDIO.md`).
Last updated 2026-09-18.

---

## How this file is used

- Each phase ends in something playable and deployed. Never leave `main` with a
  half-wired build.
- Each phase has an acceptance list. A phase is done when every line is true in a
  browser on a school MacBook, not when the code is written.
- Logic is done when its tests pass. Feel is done when it has been watched at 60 fps.
- When a phase finishes: tick it, bump the status line, write what the next phase
  needs under **Handoff notes** at the bottom.
- Scope creep goes to **Backlog**, not into the current phase.
- Rules and content live in `design.md`. Changing a number there is fine; changing a
  rule needs a dated line under **Decisions** here.

---

## Decisions (confirmed 2026-09-16; do not reopen without asking)

| # | Decision |
|---|---|
| 1 | **Own repo and subdomain.** `contrapaul/tomeofsecrets`, Cloudflare Pages, `tome.contrapaul.com`. Static site. No server, no accounts. |
| 2 | **Stack:** PixiJS v8 + TypeScript + Vite + GSAP (fully free since 2025). Vitest, ESLint, a boundary-check script. |
| 3 | **Fixed 1920×1080 stage, uniformly scaled, letterboxed.** Nothing is responsive. Nothing reflows. No DOM layout; the canvas is the whole page. |
| 4 | **Art:** HD hand-drawn or painted (scanned or tablet). No pixel art. Enemies are one idle PNG animated procedurally (the "puppet"); Aseprite frame animation is an optional upgrade per enemy. |
| 5 | **Combat baseline is Slay the Spire.** 3 energy, draw 5, discard at end of turn, block expires, telegraphed intents, 1–3 enemies, one hero. Class resources sit on top (`design.md` §4). |
| 6 | **Audience** ~Grade 9 on school MacBooks, mouse and trackpad first. A run is 25–35 minutes with mid-run save. Stylised fantasy violence, no gore. |
| 7 | **Hard on purpose.** Runs are lost often and retried. Progress is visible (best chapter and floor per class, new Tome pages) so a loss still moves something forward. Unlocks widen options; they do not remove the difficulty. Seals raise it from there. |
| 8 | **Run-start choices beyond class:** an Origin (starter deck and relic variant), a Boon (1 of 3), a Seal (difficulty), and for the Tracker a Companion. |
| 9 | **Persistence is localStorage plus an exportable save code.** No accounts. Cloud saves are backlog. |
| 10 | **Paul writes the story.** The dialogue engine, portrait layout and event system are built in Phase 5 so events work; story scenes are layered on in Phase 8 once combat and the run are solid. |
| 11 | **Students contribute art, later data.** A contributor kit with drop-in preview tools; every enemy and card credits its artist in-game, under the name the student chooses (first name and initial by default). |
| 12 | **Sound and music: yes,** as their own phase after the game is fun silent. Student compositions welcome. |
| 13 | **The hook: every enemy has a Secret,** its signature move as a colourless card. Beat an enemy once and its page is written into the Tome; from then on its Secret can appear in rewards. The Tome is the bestiary, the collection and the unlock tree. |
| 14 | **Names.** Acts are **Chapters**. Relics are **Relics**. Potions are **Vials**. Stolen enemy cards are **Secrets**. The meta currency is **Lore**. Difficulty tiers are **Seals**. The player is a **Seeker**. |
| 15 | **Chapters are 10 floors plus a boss** (not StS's 15), to hit the run length. Tunable in one constant. |

---

## Architecture (fixed)

### The stage

One Pixi `Application`, `resizeTo: window`, `resolution: devicePixelRatio`,
`autoDensity: true`. A root container `stage` is the design space, **1920×1080**.
On every resize:

```
s = min(innerWidth / 1920, innerHeight / 1080)
stage.scale.set(s)
stage.position.set((innerWidth - 1920 * s) / 2, (innerHeight - 1080 * s) / 2)
```

The bars outside the stage are painted in the scene's letterbox colour. Every scene
positions everything in design pixels and never reads the window size. Pixi's pointer
events already map through the transform, so input needs nothing extra. `Text`
objects re-rasterise at `resolution = devicePixelRatio × s` on resize (throttled) so
text is crisp at any size. **Measure this in Phase 0 before anything else uses text.**

### Layers and the boundary rule

```
src/engine/**   pure TypeScript. No pixi, no gsap, no DOM, no window. Runs in vitest and in the sim.
src/content/**  data (JSON) + zod schemas. Imports nothing from engine or ui.
src/ui/**       Pixi scenes, components, GSAP. May import engine and content.
src/app/**      boot, stage, router, assets, save, audio, settings.
```

`npm run check:boundary` fails the build if `engine/` or `content/` import anything
from `pixi.js`, `gsap`, `src/ui` or `src/app`. Same idea as the `games` repo; it is
what keeps the balance sim and the tests honest.

### Repo layout

```
tomeofsecrets/
├── index.html                 one canvas, one script tag, font preloads
├── src/
│   ├── main.ts                boot: fonts → assets → profile → router
│   ├── app/                   Stage (16:9 lock), SceneRouter (#/route), Assets, Save, Audio, Settings, Input
│   ├── engine/
│   │   ├── rng.ts             seeded PRNG with named streams
│   │   ├── events.ts          presentation event types and queue
│   │   ├── rules/             combat: state, turn flow, cards, effects, statuses, targeting,
│   │   │                      enemy intents, companion, traps, scripts/ (escape hatch registry)
│   │   ├── run/               run state, map generation, encounters, rewards, shop, camp, vials, relics
│   │   ├── meta/              profile, Tome, Lore, unlocks, seals, stats
│   │   └── dialogue/          .dlg parser and runner
│   ├── content/
│   │   ├── schema/            zod schemas: card, effect, enemy, relic, event, boon, origin, vial, credits
│   │   ├── cards/             paladin.json tracker.json mage.json neutral.json secrets.json curses.json status.json
│   │   ├── enemies/<chapter>/<id>.json
│   │   ├── encounters/<chapter>.json
│   │   ├── relics.json vials.json boons.json origins.json seals.json companions.json
│   │   ├── events/*.dlg  story/*.dlg
│   │   └── credits.json
│   ├── ui/
│   │   ├── scenes/            Title, CharacterSelect, Map, Combat, Reward, Shop, Camp, Event, Treasure,
│   │   │                      RunEnd, Tome, Settings, Credits, Dev*
│   │   ├── cards/             CardView, HandLayout, DragController, PileView, CardInspector
│   │   ├── combat/            EnemyPuppet, PlayerPanel, IntentBadge, StatusRow, DamageNumber,
│   │   │                      ResourceWidget (per class), TrapRow, CompanionView
│   │   ├── dialogue/          DialogueBox, Portrait, ChoiceList
│   │   ├── fx/                particles, flashes, shake, dissolve, timelines
│   │   └── kit/               Button, Panel, Tooltip, Scroll, Toast, fonts, palette
│   └── dev/                   dev-only scenes at #/dev/*
├── public/
│   ├── art/enemies/<id>/      idle.png [attack.png hurt.png] [idle.json spritesheet] meta.json
│   ├── art/cards/<id>.webp  art/portraits/<id>.webp  art/ui/  art/backgrounds/<chapter>/
│   ├── fonts/                 self-hosted woff2
│   └── audio/                 sfx/ music/
├── tools/                     sim.ts, lint-content.ts, pack-atlas.ts, import-aseprite.ts
├── docs/                      plans.md design.md mood.html CONTRIBUTING-ART.md balance.md
├── .claude/launch.json        dev server on :5174
└── package.json vite.config.ts tsconfig.json vitest.config.ts eslint.config.js wrangler.toml
```

### Engine conventions

- **Mutate and emit.** Engine functions mutate state in place and push presentation
  events (`draw`, `play`, `damage`, `block`, `status`, `die`, `intent`, `turn`,
  `shuffle`, `exhaust`, `trap`, `companion`, `resource`, …) onto `state.events`. The
  combat scene drains the queue on a GSAP timeline; input is locked while draining.
  **Anything that mutates without emitting will not animate.** A test asserts every
  mutation site emits. (Flashstone pattern; it worked.)
- **Named RNG streams.** One run seed derives independent streams: `map`,
  `encounters`, `shuffle`, `enemyMoves`, `rewards`, `events`, `shop`, `misc`. Picking a
  different card reward never changes the next fight's moves. A run is reproducible
  from `seed + decisions`.
- **Cards are data; effects are a small language.** A card is JSON; its behaviour is a
  list of `Effect`s resolved by one `resolveEffect`. Enemy moves, relics, vials, boons
  and events use the same effects. **Card text is generated from the effects** with
  live numbers (Strength, Marks, Charges), so text can never disagree with the rules.
  A `script` effect is the escape hatch for the few things the language cannot say
  (Polymorph, boss phases); scripts live in `engine/rules/scripts/` and one registry
  lists them. If more than ~10% of cards need scripts, extend the language instead.
- **Content is validated twice:** `npm run lint:content` (zod, cross-references, every
  enemy has art + credit + Secret, every card has an upgrade) and a vitest that loads
  every file.
- **State is a plain object.** No classes with methods in engine state; everything
  round-trips through `JSON.stringify`. That is what makes save/resume and the sim free.

### Save

| Key | Holds |
|---|---|
| `tome.profile.v1` | Tome pages, unlocks, Lore, stats, best runs, flags, credits seen |
| `tome.run.v1` | The whole current run: seed, decisions, RNG stream positions, deck, relics, vials, map, floor, HP, and mid-fight combat state |
| `tome.settings.v1` | volume, motion, fast mode, shake, keyboard hints |

Autosave after every engine step. `v1` is a migration version; `app/save.ts` holds
`migrate(from, data)` steps, append-only. **Save code** = base64url(deflate(JSON)) with
a checksum, shown in Settings as "Copy save" / "Load save". That is how a student
moves between machines.

### Dev routes (kept in production, unlisted)

| Route | What |
|---|---|
| `#/dev/fight?class=mage&enemies=ink-slime,page-wisp&seed=abc` | Drop straight into a fight |
| `#/dev/cards?class=paladin` | Card browser: hover, upgrade toggle, filter, text dump |
| `#/dev/enemy?id=bookwyrm` | Puppet preview, every animation on a loop; **drag a PNG onto the page to preview it as this enemy** |
| `#/dev/map?seed=abc` | Map generator preview; space regenerates |
| `#/dev/dialogue?file=events/torn-page` | Run a script with live reload |
| `#/dev/stats` | FPS, frame time, draw calls, texture memory |
| `?seed=` on New Run | Play a specific seed |

### Deploy

An **assets-only Worker**, not a Pages project: `wrangler.jsonc` names `dist/` as
the assets directory and declares `tome.contrapaul.com` as a custom-domain route,
which creates the DNS record itself. No code runs at the edge, no bindings.
`public/_headers` sets long cache on `/assets/*` (hashed) and no-cache on
`index.html`. `npm run deploy` = `npm run build && wrangler deploy`.

---

## Phases

Order: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10**. Phases 4 and 5 may overlap
(art tooling vs the run loop). Story (8) and sound (9) are independent of each other.
Checkpoints are student playtests; the plan does not proceed past one without notes.

### Phase 0: Foundation. The locked stage, deployed

Goal: an empty game that is the right shape, fast, and live at the URL.

- [x] Repo `contrapaul/tomeofsecrets`: Vite + TS + Pixi v8 + GSAP + vitest + ESLint.
      `npm run check` = typecheck + lint + boundary + test. Copy `CLAUDE.md` from `make`.
- [x] `docs/`: move `plans.md` and `design.md` here; leave a pointer in `make/tomeofsecrets/`.
- [x] Stage: 1920×1080 root, uniform scale, centred, letterbox bars, DPR-aware, text
      re-rasterisation on resize. **Prove text crispness first.** Proven 2026-09-17:
      `#/dev/text`, text resolution tracks `dpr × scale` both growing and shrinking.
- [x] Scene router on `location.hash` with an `enter/exit` contract and a fade.
- [x] Asset loader with per-chapter manifests and a loading screen; fonts via
      `FontFace` before the first scene. (Bundles are empty until Phase 4.)
- [x] Mood sheet `docs/mood.html`: palette (ink, parchment, gold leaf; Paladin
      gold/ivory, Tracker moss/leather, Mage indigo/violet), card frame per type,
      fonts (Cinzel + Alegreya + JetBrains Mono, self-hosted OFL), button, panel,
      tooltip. Approved by Paul 2026-09-17.
- [x] Title scene with a placeholder background and a hidden link to `#/dev/stats`.
- [x] Settings store with motion (full / fast / reduced) and screen-shake toggles.
- [x] Deployed with the custom domain; `npm run deploy`. `.claude/launch.json` on :5174
      here and as `tome` in `make`. **Not Pages:** see the handoff note.

Acceptance:
- Resize to 4:3, 21:9, phone-narrow, tiny: content scales uniformly, stays centred,
  letterboxes, nothing moves relative to anything else, no scrollbar ever.
- Text is crisp at 1280×720 and at 2560×1440 on a Retina display.
- 60 fps idle; `#/dev/stats` shows it.
- `npm run check` passes; `tome.contrapaul.com` serves the title.

### Phase 1: Rules engine (headless) — Done 2026-09-17

Goal: a complete StS-shaped combat with no renderer, proven by tests and a CLI sim.
Temporary content only: Strike, Defend, six generic cards, three dummy enemies.

- [x] `engine/rng.ts`: named streams, serialisable positions, determinism tests.
- [x] Schemas: `Card`, `Effect`, `Amount`, `Condition`, `Enemy`, `Move`, `Pattern`.
      Zod first, TS types inferred (one source, no drift).
- [x] Combat state: hero, energy, piles (draw/hand/discard/exhaust), powers, enemies,
      statuses, turn, events, RNG.
- [x] Turn flow: start of turn (block expires, energy refills, draw 5, triggers), play
      card (cost, target, legality, resolve, discard/exhaust), end turn (triggers,
      discard unless Retain, companion acts), enemy turn (each enemy resolves its
      intent, statuses tick, next intent chosen), win/loss.
- [x] Effects: damage (Strength, Vulnerable, Weak, block, multi-hit, all/random),
      block (Dexterity, Frail), status apply/remove, draw, energy, heal, exhaust,
      discard, add card, resource gain/spend with scaled amounts, conditionals,
      `script` and its registry. Also traps, powers, companion, summon, flags.
- [x] Every status in `design.md` §3, table-driven tests.
- [x] Enemy intents: `cycle`, `weighted` (no-repeat), `phases` by HP, `script`.
      The intent preview uses the same computation as resolution (tested).
- [x] Generated card text with live numbers; a test renders every card (both sides
      of the upgrade) and checks every printed number appears.
- [x] Event queue: every mutation emits; a scripted fight asserts the event log, and
      an invariant test replays 15 whole fights checking every visible change has an
      event.
- [x] `npm run sim -- fight --deck … --enemies … --games 1000`: heuristic player;
      prints win rate, hp lost, turns. 1000 fights in ~35 ms.

### Phase 2: The table. Combat scene and card feel — Built 2026-09-17

Goal: the fight is on screen and it feels great. The whole game rests on this phase;
do not leave it until the numbers below are true on a MacBook Air.

- [x] `CardView`: frame by type and class colour, cost orb, name, art slot, generated
      text with number colouring (green buffed / red debuffed), rarity gem, keyword
      line. **One component, scaled everywhere**; never re-laid-out.
- [x] `HandLayout`: fan on an arc; each card has a target transform; GSAP tweens with
      overshoot; reflows live as cards enter and leave.
- [x] Hover: lift and scale; the enlarged card keeps the hover, so neighbours never
      flicker; neighbours part.
- [x] `DragController`: pointer-follow with lag, velocity tilt, growing shadow. Targeted
      cards draw a bezier arrow and highlight the enemy under the pointer; untargeted
      cards show a "release to play" line; release outside springs back. **Rearrange**
      by dragging within the hand band; order written back to engine state.
- [x] Piles: draw/discard/exhaust counts (tracked from events during playback); draw
      animation (arc + stagger); discard cascade; exhaust dissolve; shuffle banner.
      Click-to-inspect a pile is still to do (Phase 5 with the deck view).
- [x] Play: lift to centre, pulse, events fire in order, arc to discard. Unplayable:
      shake, energy orb flash, reason tooltip.
- [x] `EnemyView`: idle breathe and sway, attack anticipation → lunge → recoil, hit
      flash + shake, buff pulse, death desaturate → sink → fade. Spritesheet path is
      Phase 4; today a placeholder body with eyes stands in.
- [x] Intent badges with numbers and tooltips; HP bars with block shield; status rows
      with counts and glossary tooltips.
- [x] `PlayerPanel`: portrait, HP/block, energy orb, resource widget slot, statuses.
      Relic row and vial slots arrive in Phase 5.
- [x] Damage/block/heal numbers; screen shake on ≥15 damage; slow-mo on a killing
      blow; turn banners. Low-HP vignette still to do.
- [x] Prompts: choose-to-discard/exhaust with a bar and Confirm; cards toggle by click.
- [x] Card inspector: click (not drag) → 2.2× view with keyword glossary. Right-click an
      enemy → its moves seen so far. Long-press for touch is Phase 10.
- [x] Motion settings through `d()`; keyboard: 1–9 select, ←/→ target, Enter play,
      E end turn, Esc clear, F dev fps.
- [x] `#/dev/fight?class=&enemies=&seed=&deck=` route.

Acceptance:
- [ ] 60 fps with 10 cards in hand, 3 enemies and particles on a 2019 MacBook Air.
      **Measured here only:** 115 fps at 8.7 ms with 3 enemies and a hovered hand
      (press F in a fight for the readout). Needs a school laptop.
- [x] Sweeping the pointer across the fan never flickers (the lifted card owns the
      hover until the pointer leaves it).
- [x] Drag: the enemy under the pointer is the one hit; verified with real pointer
      drags onto each enemy and onto the play line.
- [x] Rearranged hand order survives (verified: state order matches the fan).
- [x] Every engine event has a handler (the switch is exhaustive in TypeScript).
- [x] Reduced motion: all durations ×0.05 through `d()`; lunges and shakes skipped.
- [ ] A first-time player plays a fight with no explanation beyond intents and
      tooltips. **Needs a person.** Paul first, then a student at Checkpoint 1.

### Phase 3: Three classes, first pass — Done 2026-09-17

Goal: Paladin, Tracker and Mage play differently in `#/dev/fight`, with their first-pass
cards and their resource on screen.

- [x] Class resources in engine: **Holy Power**, **Companion** (act, Stun, Enrage,
      Feed), **Traps** (max 2, replace oldest), **Marks** (+3 per hit, Trueshot +2/+4),
      **Burn**, **Chill → Frozen / Shatter**, **Arcane Charges**, **Images**, plus
      **Bomb** (Living Bomb) and **Viper's Kiss**. Tests through the real cards in
      `classes.test.ts`.
- [x] Resource widgets: Holy Power pips, Charge gems, Companion with its action line
      and Stunned/Enraged state, Trap row under the hero. All driven by events.
- [x] Cards: `content/cards/{paladin,tracker,mage}.json` — 30 / 30 / 32 cards, every
      **1st**-marked card from `design.md` §4, all with upgrades. Text generated for
      most; overrides where the sentence read badly. `#/dev/cards?class=mage` browses.
- [x] `content/classes.json`: HP, starter deck, companion, resource. Loaded and
      cross-checked by `loadContent`.
- [x] Six test dummies exercise multi-hit, buff, debuff, block, swarm and split.
- [x] Sim baseline (starters only, 500 games each, seed `sim`): every class beats every
      normal dummy at 100% with 2–17 HP lost; the 120-HP boss dummy beats the Paladin
      (20% win) and the Mage (0%) while the Tracker wins 92% — the Wolf's free 5 a
      turn is a lot in a 10-card deck. Revisit at Phase 7.

Acceptance:
- [x] Each class's identity is legible in one fight (verified in the browser: pips
      fill, traps arm and fire on an attack, Charges light and scale Arcane Blast).
- [x] Every card's generated text is right in hand with live modifiers ("Spend all
      Holy Power: gain 13 block" at 3 pips).
- [x] `lint:content` (the content test) clean; every card has an upgrade; 97 tests.

### Phase 4: Art pipeline and contributor kit — Done 2026-09-17

Goal: a student with a drawing and no code sees it fighting within five minutes, and
the game credits them.

- [x] `docs/CONTRIBUTING-ART.md`: sizes by size class, transparent background, feet
      on the baseline, facing left, optional `attack.png`/`hurt.png`/`dead.png`,
      `meta.json`, Aseprite. Templates in `public/art/templates/` (generated by
      `npm run art:templates`, with the baseline drawn on).
- [x] `#/dev/enemy?id=`: drop a PNG → it idles, attacks, flinches, buffs, dies on a
      loop; size auto-detected from the image height; "Export meta" downloads the
      `meta.json` from two text fields.
- [x] `tools/import-aseprite.ts` (`npm run art:aseprite -- <export.json>`): frame tags →
      Pixi `animations`; `EnemyView` plays `idle` on a loop and `attack`/`hurt`/`die`
      once when present, else swaps pose PNGs, else puppets a placeholder.
- [ ] ~~`tools/pack-atlas.ts`~~ **Deferred to Phase 10.** The scanner (`npm run art`)
      measures every file; sample enemies are 45 KB each and a chapter of painted
      art projects to ~6 MB, inside the 8 MB budget without WebP or atlases.
      Revisit with real art in hand.
- [x] Credits: `content/credits.json`; `meta.json.artist` and `card.artist` must
      match an id or the scanner and the content test fail; `#/credits` is generated
      from it with what each person drew; the right-click enemy panel says "drawn by".
      The Tome page itself is Phase 6.
- [x] Card art: `public/art/cards/<id>.png` (500×380) picked up automatically and
      cropped to the art slot; the placeholder initial stays for the rest.
- [x] Chapter backgrounds: `public/art/backgrounds/<key>/{far,near}.png` with a
      pointer parallax (`ParallaxBackdrop`).

Acceptance:
- [x] Drag a PNG onto `#/dev/enemy` → it idles, lunges, flinches, dies. No reload.
      (Verified with a real `drop` event carrying the medium template.)
- [x] New enemy folder + PNG + credit → appears in a fight with its art and in the
      credits with the artist's name; the scanner refuses a wrong size, a missing
      meta or an unknown artist.
- [x] Chapter 1's art today: 544 KB. The budget line will be re-measured when real
      art lands.

### Phase 5: The run. Chapter 1 end to end — Built 2026-09-17

Goal: a full Chapter 1 run, saved and resumed, live at the URL. **Checkpoint 1 follows.**

- [x] Map generation per `design.md` §7.2: 7 columns × 10 floors + boss, 6 paths with
      no crossings, the node rules, unknown nodes. 300 seeds validated in tests.
- [x] `MapScene`: paths, node icons, reachable-path highlight, the hero marker,
      tooltips, chapter title, Abandon (with a confirm click).
- [x] Encounters: `content/encounters/chapter1.json`; the first three fights draw from
      the easy pool; no group repeats within a chapter (tested).
- [x] Chapter 1 roster: 9 normals, 2 minions, 3 elites, 3 bosses in
      `content/enemies/chapter1/`, each with a Secret in `cards/secrets.json` and a
      flavour line. Placeholder art until student art lands.
- [x] Rewards: gold, 1-of-3 cards (rarity weights, Rare pity, class/neutral split),
      relic from elites, vial chance, boss = 1 of 3 boss relics + full heal.
- [x] Shop (5 cards with a sale, 3 relics, 3 vials, removal at 75 +25 each), Camp
      (Rest / Smith with a preview picker), Treasure (Brass Key gives two), Vials
      usable in fights from the top bar.
- [x] Relics: 36 in `content/relics.json` — combat hooks (flags, fight-start effects,
      resources) and run effects (gold, prices, rest, HP, slots, Smith, treasure).
- [x] Dialogue engine: `.dlg` parser with line-numbered errors, a runner that applies
      effects to the run, card picks that pause the script, fights launched from a
      script that return to it with a doubled reward. Twelve events.
- [x] Run state, autosave after every step (including every card played), resume
      mid-fight, Continue on the title, Abandon.
- [x] Run end: floor, fights, deck/relics/gold, the seed, kills, cause of death.
- [x] Character select (class only; Origin/Boon/Seal are Phase 6).
- [x] First-fight tips: three toasts, once per browser. Replaced after Checkpoint 1 by
      the gated walkthrough (`ui/kit/coach.ts`); see the handoff below.
- [x] `npm run sim -- run`: whole-chapter runs with the heuristic. Baseline over 300
      runs per class (seed `sim`): Paladin 17% wins, Tracker 19%, Mage 7%; median
      run reaches the boss; deaths are the bosses and the Ogre Bookkeeper.

Acceptance:
- [x] Start → map → floors → boss → summary, no console errors. (Every screen was
      exercised in the browser; the auto-player covers the fights.)
- [x] Close the tab mid-fight, reopen: the same hand, the same intents.
- [x] Same seed and same choices twice → identical run (tested).
- [ ] Target after three runs by a first-timer: floor 6+ reliably; Chapter 1 boss
      beaten 30–40% of the time. **Checkpoint 1 measures this.**

**Checkpoint 1:** 6–10 students, two runs each, school laptops. Record floor reached,
cause of death, confusion points, and whether they asked to go again. Notes go into
Handoff notes before Phase 6 starts.

### Phase 6: Secrets, the Tome, and the meta — Built 2026-09-17

Goal: a lost run still moves the Tome forward, and the second run has more choices
than the first.

- [x] Secrets per `design.md` §5: one colourless card per enemy; first kill writes the
      page; afterwards Secrets appear in rewards (35% after a normal fight containing
      that enemy, always after an elite or boss). Distinct "stolen" frame.
- [x] Tome scene: **Bestiary** (silhouette until seen; full page after a kill: art,
      artist, moves, Secret), **Cards** (by class, seen/unseen), **Relics**, **Pages**
      (the unlock tree), **Stats**, **Credits**.
- [x] Lore earned at run end by `design.md` §9; spent on Pages.
- [x] Boons (13), Origins (3 per class, 1 unlocked), Seals 1–10, Companions (5).
      Seal 5 (chapter rests) waits for Phase 7's chapter transitions; Seal 10 (boss
      Seal moves) waits for authored moves. Both are listed and selectable; they
      simply do nothing yet.
- [x] Character select becomes class → origin → companion (Tracker) → seal → boon.
- [x] Save codes: copy/load in the Tome's Stats tab with a checksum error message.
- [x] Run history: last 20 runs with seed, class, result, floor.
- [ ] Card-back page (cosmetic): not built; nothing cosmetic to unlock yet.

Acceptance:
- [x] Kill an Ink Slime → its page appears, its Secret is offered later, its artist is credited.
- [x] Lore accrues on a loss; buying a Page changes the next run's pool; a Boon visibly
      alters the start (Trinket hands over a relic on the map's bar).
- [x] A save code round-trips a profile (unit test; two-browser check is Paul's).

### Phases 6.1–6.3: what the students asked for (added 2026-09-18)

Checkpoint 1 was a hit. Three things came out of it, in the order Paul raised them:
accounts, a guide to everything, and explanations on hover/tap. They are written up
here as three phases that sit between 6 and 7. **Recommended order: 6.1 → 6.3 → 6.2**:
the explainer is a one-session win and produces the glossary the guide is built from;
accounts protect the thing students now care about losing; the guide is mostly
writing, which Paul can do while accounts are being built. Accounts decisions were
made on 2026-09-18 and are in 6.3.

---

### Phase 6.1: Explain everything (hover and tap) — Built 2026-09-19

**Goal:** nothing in the game is a mystery until it happens. Every keyword, status,
resource, intent, relic, vial and map node explains itself where the player is
looking, on hover with a mouse and on tap with a finger, in the same words everywhere.

**Why:** students could not find out what Weak or Vulnerable did until it was on them.
Today the words live in `ui/kit/glossary.ts` and reach the player in exactly two places:
the status-row tooltip (after it is applied) and the click-to-inspect card (which most
students never found).

**Design**

- **One glossary, in content.** `src/content/glossary.json`, validated by
  `schema/glossary.ts`: `{ id, kind: 'status' | 'keyword' | 'resource' | 'intent' |
  'node' | 'term', name, text, short?, related?: string[] }`. Numbers in the text are
  tokens (`{FREEZE_AT}`, `{SHATTER_DAMAGE}`, `{MARK_BONUS}`, `{HAND_LIMIT}`) filled from
  the engine's exported constants at load, so the words cannot drift from the rules. A
  content test asserts an entry exists for every `StatusId`, every card keyword, every
  resource, every intent kind, every map node type, and that every token resolves.
  `STATUS_NAMES` in `engine/rules/text.ts` comes from the same file.
- **`explain()` is a rules function.** `engine/rules/explain.ts` (pure):
  `termsOfEffects(effects)` walks a card's effects, including nested `then` and `if`
  branches, and returns the glossary ids it touches: statuses it applies, resources it
  spends or gains, `Armed` plus the trap's trigger, companion actions, X costs, "ALL
  enemies". `explainCard(resolved, live?)`, `explainRelic`, `explainVial`,
  `explainIntent(enemy, move)` ("Yank: 8 damage; Stuns your Companion"), and
  `explainStatus(id, amount)` all return the same shape:
  `{ title, body: Segment[], notes: GlossaryEntry[] }`. Tests: Judgment →
  [Holy Power, Vulnerable]; Snake Trap → [Armed, on enemy attack, Poison]; Ink Trap
  intent → [Stun]; every card, relic, vial and enemy move in content resolves to
  entries that exist.
- **Terms glow in the text.** `Segment` gains `term?: string`; `describeResolved`
  sets it on status names and keyword lines, and `richText` draws those runs in gold.
  Students see what is hoverable.
- **The Explainer** (`ui/kit/explainer.ts`) is one component for every surface: a
  column of small note cards (name in gold, text beneath, 300 px wide) that anchors
  beside the thing being looked at — right of a hand card (left when the card is near
  the right edge), below an intent badge, beside a relic or vial token, under a map
  node. 350 ms delay on hover (the StS timing, so a sweep across the hand does not
  flicker), no delay on tap, fades in 120 ms. It lives in `stage.overlay`, never
  captures pointer events, and one instance per scene replaces the current `Tooltip`
  for anything that has notes (plain one-liners keep the tooltip).
- **Touch.** Pointer events carry `pointerType`. On touch, a tap on a hand card lifts
  it (the hover state) and shows the Explainer; dragging from a lifted card plays or
  aims as now; tapping elsewhere lowers it. Intent badges, statuses and tokens explain
  on tap and dismiss on the next tap anywhere. Keyboard: the card lifted with 1–9 shows
  the Explainer too.
- **Where it plugs in:** hand (via `HandLayout.setHover`), the inspector (its keyword
  lines become the Explainer, and it gains a "more in the Tome of Knowledge" line once
  6.2 exists), reward, shop, treasure and deck-overlay cards (`offerCard`), intent
  badges (move effects, not just the number), status rows on both sides, relic and
  vial tokens in fights and on the run bar, the energy orb and resource widgets, map
  nodes, Bestiary pages, character select.
- **A tutorial step:** after "What the enemy will do", one more: "Hover any word in
  gold to learn what it means" (tap on touch), gated on the first Explainer shown.

**Steps**

1. `content/glossary.json`, its schema, the loader, `STATUS_NAMES` from it, the
   coverage test. Delete `ui/kit/glossary.ts` when nothing imports it.
2. `engine/rules/explain.ts` with tests.
3. `term` on segments; gold runs in `richText`.
4. `ui/kit/explainer.ts`: layout, anchoring, delay, pointerType, fade.
5. Wire every surface listed above; the tutorial step.
6. Touch pass in the pane's mobile emulation, then on an iPad.

**Acceptance**

- [x] A first-time player hovers Judgment and reads what Vulnerable and Holy Power are
  before playing it.
- [x] An intent badge for Ink Trap says it will Stun the Companion; hovering Stunned
  says what that means.
- [~] On a touch screen: tap a card, read it (the inspector); tap a badge, status,
  relic or reward card and it explains and sticks; a second tap on a pickable thing
  picks it. Verified with synthetic touch events; a real iPad pass is still owed.
- [x] The coverage test proves every term used by any card, relic, vial or enemy move
  has an entry, and every number in the glossary matches the engine.

---

### Phase 6.2: The Tome of Knowledge

**Goal:** one place that explains the whole game, written for a Grade 9 reader,
readable from the title screen, from the Tome, and from inside a fight without leaving it.

**Design**

- **Route and entry points.** `#/knowledge` from a title button, a Tome tab, a "?"
  on the run bar, and a "?" button (and key) in combat that opens it as an overlay over
  the paused-nothing fight (the engine is turn-based; nothing runs while it is open).
  Deep links: `#/knowledge?chapter=statuses&term=weak`; the Explainer's notes carry a
  "more" link to the matching chapter.
- **Chapters are Markdown in content.** `src/content/guide/*.md` with front matter
  `{ id, title, section, order }`, loaded like events (`import.meta.glob` with
  `?raw`). Sections and chapters:
  - *The Basics*: a run, a fight, a turn, energy, draw and discard, block, death and
    what survives (Lore).
  - *Cards*: types, cost, upgrades, rarity, keywords, targeting, curses and statuses
    as cards, Secrets.
  - *Statuses*: the table, generated, plus three worked examples ("Weak on you", "Poison
    on them", "Chill to Frozen").
  - *Classes*: one chapter each; resource, three archetypes, starter deck, origins,
    the Companion (Tracker).
  - *The Map*: node types, paths, elites, the boss, the "?" node.
  - *After a Fight*: gold, cards, relics, vials, Secrets and the 35% rule.
  - *Merchant, Camp, Events, Vials, Relics*: one chapter each.
  - *Enemies*: how intents work, hidden intents, phases, minions, the Bestiary.
  - *The Tome*: Lore (the formula), Pages, Seals (the table), Boons, Origins,
    Companions, save codes.
  - *Tips*: a page of strategy in plain words ("block before the big hit", "a smaller
    deck draws its best cards more", "take the elite when you are healthy").
  - *Every term*: generated A–Z index of the glossary.
- **Generated parts never get written twice.** Directives in the Markdown render from
  content: `{{statuses}}`, `{{keywords}}`, `{{seals}}`, `{{boons}}`, `{{starter:paladin}}`,
  `{{card:judgment}}` (an inline card), `{{relic:iron-bookmark}}`, `{{lore-formula}}`.
  `[[Weak]]` renders a gold term with the Explainer on hover. A content test asserts
  every chapter parses, every directive is known, and every `[[term]]` exists.
- **Rendering.** `ui/kit/markdown.ts`: a deliberately small parser (headings,
  paragraphs, bold and italic, bullet lists, two- and three-column tables, terms,
  directives) into Pixi containers via `richText`. `ui/kit/scroll.ts`: the game's
  first scrolling surface (mask, wheel, drag with inertia, touch, a slim scrollbar,
  keyboard PageUp/PageDown), built to be reused by the Bestiary and Cards tabs when
  Chapters 2 and 3 arrive.
- **Layout.** Left column: sections and chapters (the current one lit). Right: the
  chapter, 1100 px wide, scrolling. Top: "THE TOME OF KNOWLEDGE" and a Back/Close.
  Overlay mode in a fight dims the table, keeps the fight underneath, Esc closes.
- **Voice.** Short paragraphs, second person, no jargon before it is defined, one idea
  per paragraph, tables for numbers. Paul writes and edits; Claude drafts every chapter
  first so there is something to react to. Chapters under 300 words plus tables.

**Steps**

1. `ui/kit/scroll.ts`, tested in the pane with a long dummy chapter.
2. Guide loader, front matter, directives, `[[term]]`, the content test.
3. `ui/kit/markdown.ts`.
4. `ui/scenes/knowledge.ts` and the overlay variant; the four entry points.
5. Draft all chapters. Paul edits.
6. Link the Explainer's "more" into it.

**Acceptance**

- A student who has never played reads *The Basics* and *Statuses* and can explain
  Weak and block to a classmate.
- The status table is generated: change a number in the engine and the page changes.
- Open it mid-fight, scroll, close: the fight is untouched.
- Scrolling holds 60 fps on a school laptop.

---

### Phase 6.3: Accounts — Built 2026-09-20 (email sending awaits the Resend key)

**Goal:** a student can sign up, and from then on the Tome follows them between school
and home and cannot be lost to a cleared browser. Progress made before signing up
carries over. Nothing about the account is for the teacher: no roster, no play data,
no class view. (Decided 2026-09-18: email verification yes; password reset yes; teacher
tools none; play-data collection maybe later, and only as its own phase.)

**Pattern:** the Flashstone / `time` / `bloodbowl` accounts stack. D1; username, email
and password with a salted hash; sessions as hashed tokens in an HttpOnly cookie;
verify and reset tokens; rate limits. Port `flashstone/src/lib/server/{crypto,session,
ratelimit,email}.ts` near-verbatim. What is different here: this app is a static Vite
site on an assets-only Worker, so accounts add a `main` Worker script
(`worker/index.ts`) to the same deployment — `run_worker_first: ["/api/*"]` in
`wrangler.jsonc`, everything else falls through to the assets. No SvelteKit, no Pages,
no Durable Objects.

**Kids and privacy.** The least data that works: username, email, password hash, and
the Tome document. No name, no class, no age. Sign-up copy asks for a username that is
not a full name. Email is used for the verification link and password reset, nothing
else; it is never shown to anyone. Sessions last 30 days. A student can delete their
account from the Tome (one button, one confirm), which removes every row.

**Data (D1, `db/migrations/0001_init.sql`, append-only from then on)**

- `users(id, username UNIQUE NOCASE, email UNIQUE NOCASE, password_hash,
  email_verified, created_at)`
- `sessions`, `auth_tokens` (kinds `verify` and `reset`), `rate_limits` exactly as
  Flashstone.
- `profiles(user_id PK, data TEXT, updated_at)` — the Tome as one JSON document,
  validated on write with the same zod `Profile` from `content/schema/meta.ts` (the
  boundary rule already keeps it DOM-free, so it runs in the Worker unchanged).
- `run_saves(user_id PK, data TEXT, updated_at)` — the in-progress run, for resume on
  another device. The same document the browser saves today.

That is the whole schema. Run history already lives inside the profile (last 20).

**Sync model.** Playing signed out stays exactly as it is today. Signed in, the browser
still plays the game; the server is the durable copy. Pull on sign-in; push the profile
two seconds after any change and the run save after every step (coalesced); merge on
pull. `mergeProfiles(a, b)` in `engine/meta/profile.ts` (pure, tested): union for sets
(pages, cards and relics seen, bestiary moves; bestiary seen and kills as max; history
by seed and date, capped at 20), max for counters and best floors, `lore =
max(a, b)`, `seals` as max per class. Merging is idempotent and never loses anything,
which is what makes the carry-over below safe. Weakness: a student who edits
localStorage can gift themselves Lore; the server takes their word. Acceptable for a
classroom game with nothing to buy. If quests ever pay out, Lore moves server-side
then (the Flashstone gold rule: idempotent awards keyed by run seed).

**Carrying progress into a new account.** Yes. The local Tome (`tome.profile.v1`) is
the anonymous Tome. Signed-in play uses a separate local cache per account
(`tome.profile.<userId>`) mirrored to the server, so the anonymous Tome is never
overwritten by someone else's account and signing out puts you back exactly where the
anonymous Tome was.

- **Sign-up** on a browser with an anonymous Tome: the form says "Your Tome so far
  (23 Lore, 1 page, 4 Bestiary pages) will become this account's." and the whole
  document is uploaded as the account's profile, the in-progress run with it. The
  anonymous Tome is left in place, marked `carriedTo: <userId>` so it is not offered
  again.
- **Sign-in** on a browser with an anonymous Tome that has progress and no `carriedTo`:
  a one-time prompt, because on a shared school laptop that progress may be a
  classmate's — "This browser has a Tome that is not tied to an account yet (23 Lore,
  1 page). Merge it into yours?" Merge → `mergeProfiles`, mark `carriedTo`. Leave it →
  untouched, and the prompt does not return for this account (remembered per
  `<userId>` locally). A different student signing in later on the same laptop gets
  the same offer for their own account.
- **Sign-in** elsewhere: pull the account Tome; if that device also holds a cache for
  this account (played offline), merge.
- **The run in progress** carries the same way: sign up mid-run and the run is now the
  account's; sign in mid-run and the prompt covers it ("…and a run in progress on
  floor 4").

**API (`worker/routes/`)**

`POST /api/auth/signup {username, email, password, profile?, run?}` (creates the user,
stores the carried documents, sends the verification email, starts a session);
`POST /api/auth/login`; `POST /api/auth/logout`; `GET /api/auth/verify?token`;
`POST /api/auth/resend-verify`; `POST /api/auth/request-reset {email}`;
`POST /api/auth/reset-password {token, password}`; `GET /api/me`;
`GET|PUT /api/profile`; `GET|PUT|DELETE /api/run`; `DELETE /api/account`.
JSON in and out, sessions by cookie, 401 when signed out, rate limits on every auth
route. Unverified accounts can play and sync (verification only gates password reset
and is nagged, not enforced — a student who mistypes their email must not lose access).

**Client.** `app/account.ts` (session cache, fetch wrapper with credentials, the
debounced sync queue, offline retry). Sign-in, sign-up, reset and "check your email"
are the game's only **DOM UI**: an HTML form floated over the canvas in the palette's
colours, because password managers, autofill and mobile keyboards need real inputs and
Pixi has none. Reached from a title button ("Sign in") and from the Tome. The title
shows "signed in as …"; the Tome shows "saved to the cloud · just now" or "offline,
will sync". Save codes stay for the signed-out.

**Email.** Resend, as in Flashstone (`email.ts`). Needs `RESEND_API_KEY` as a Worker
secret and a verified sender on contrapaul.com (DNS records in Cloudflare). Until the
secret is set, email is a logged no-op and sign-up still works; verification is
simply pending.

**Deployment.** `wrangler.jsonc`: `main`, `d1_databases: [{ binding: "DB",
database_name: "tomeofsecrets-db" }]`, `run_worker_first`, the secret. Migrations with
`wrangler d1 migrations apply tomeofsecrets-db --local | --remote`. Landmine from
Flashstone: `d1 execute --remote --file` fails with an OAuth token; use `migrations
apply` or `--command`. The boundary rule extends: `worker/` may import
`src/content/schema` and `src/engine/meta/profile`, never `src/ui` or `src/app`.
Worker routes get vitest coverage the way Flashstone's do.

**Steps**

1. [x] `mergeProfiles` with tests; the anonymous/account split of local storage in
   `app/profile.ts` (`carriedTo`, per-user caches); no server yet.
2. [x] Worker skeleton, D1, migration 0001, the auth port, tests; deploy with `/api/me`
   answering 401.
3. [x] The DOM forms and `app/account.ts`; sign-up carries the Tome; title integration;
   signed-out play unchanged.
4. [x] Profile and run-save sync with merge; the sign-in prompt; resume on a second device.
5. [~] Verification and reset flows built and tested; account deletion built. **Sending
   waits on Paul**: a Resend account, the sender domain verified (DNS records in
   Cloudflare for `send.contrapaul.com`, or another), then
   `npx wrangler secret put RESEND_API_KEY`. Until then sign-up works and the email is
   a logged no-op; verification simply stays pending and never blocks play.

**Acceptance**

- [x] A student plays signed out for a week, then signs up: the account starts with their
  Lore, pages and Bestiary, and their run in progress. (Verified against local D1.)
- [x] They sign in at home: everything is there and Continue resumes the run. (Verified
  by wiping the local caches and signing back in: Tome and run came back.)
- [x] Two students share a laptop: the second to sign in is asked before any merge, and
  declining leaves both Tomes intact. (Verified: alex declined, sam merged.)
- [x] Clearing browser storage loses nothing for a signed-in student.
- [~] A student can reset a forgotten password by email (flow tested; mail needs the key),
  and can delete their account (verified on production).
- [x] Signed-out play is unchanged; save codes still work.

### Phase 7: Chapters 2 and 3, the full pool, balance

Goal: the whole game exists and is tuned to be hard but winnable. **Checkpoint 2 follows.**

- [ ] Chapter 2 and 3 rosters (§6): 9 normals, 3 elites, 3 bosses each; backgrounds;
      encounter pools; chapter transition screen.
- [ ] Cards to ~60 per class, ~30 neutral, a Secret for every enemy, 6 curses,
      4 status cards.
- [ ] Relics to ~40 plus 8 boss relics. Vials to 12. Events to ~40 including
      chapter-specific ones and the meta-aware "Grave of a Seeker".
- [ ] Boss relic choice; Chapter 3 boss = victory; ending card per class (placeholder
      text until Phase 8).
- [ ] Balance: sim over 2000 runs per class; tune the tables in `design.md` §13 to
      their targets. Pick-rate and win-rate-when-picked per card in `docs/balance.md`.
- [ ] Seals tuned: Seal 3 noticeably harder, Seal 10 brutal.

Acceptance:
- All three chapters clear on all three classes at Seal 0 by the heuristic player at
  the target rates, and by Paul at a higher rate.
- No card picked under 2% or winning over 70% when picked; outliers noted or fixed.
- Every enemy has art (student or placeholder), a credit and a Secret. `lint:content` clean.

**Checkpoint 2:** the same group plus new players, full runs over a week; a form for
best floor, favourite card, most annoying enemy.

### Phase 8: Story

Goal: Paul's story on top of the run. Everything here is `.dlg` data; engine work only
if a script needs a new effect.

- [ ] Story hooks fire at: new profile (prologue), run start per class, chapter start,
      before and after each boss, victory per class, defeat (short, varied), first
      Secret stolen, first Seal broken.
- [ ] Named NPCs with portraits (left/right, mood variants), speaker nameplate,
      typewriter text with skip, choice memory across runs in `profile.flags`.
- [ ] `#/dev/dialogue` live reload for writing.
- [ ] Paul's scripts for the hooks above; enemy flavour lines in the Bestiary.

Acceptance: a new profile sees the prologue once; a run has a beginning, three chapter
beats and an ending; nothing blocks a player who mashes skip.

### Phase 9: Sound and music

Pulled forward on 2026-09-17: the module, the hooks, the scanner and the guide exist;
the files do not. Paul records the sounds and drops them in.

- [x] Audio module: Web Audio, unlock on first pointer, per-category volume
      (`app/audio.ts`). One file per sound rather than a sprite sheet: the manifest is
      generated, files are small, and students can add one without touching a sheet.
- [x] SFX hooks: card draw/hover/pick/play/discard/exhaust; hit light/heavy/blocked;
      hero hurt; block; heal; buff/debuff; enemy attack and death; turn start/end; UI;
      map move; gold; shop; rest; victory/defeat; `secret` reserved for Phase 6.
- [x] Music hooks: title, map (all non-fight run screens), fight / fight-2 / fight-3,
      elite, boss; `tome` reserved. Crossfade on scene change, loop points from meta.
      `docs/CONTRIBUTING-AUDIO.md`; credits through `credits.json`.
- [x] Settings: music / sound levels; mute on hidden tab. Master stays at its default.
- [ ] The sounds and the music themselves (Paul, then students).

Acceptance: sound off loses nothing; sound on, a hit lands. No clipping, no
double-triggers when animations overlap.

### Phase 10: Polish and ship

- [ ] Tutorial: a scripted first fight ("The Tome teaches") with pointer callouts,
      skippable, replayable from Settings.
- [ ] Performance: atlases verified, texture memory under 250 MB, no per-frame
      allocation in hot paths, Chapter 1 loads under 3 s on school wifi.
- [ ] Accessibility: colourblind-safe intent shapes, tooltip contrast, full keyboard
      play, reduced-motion audit, minimum text size audit at 1280×720.
- [ ] Title art, class select art, chapter cards, run-end art.
- [ ] Daily seed (date-derived; local best only).
- [ ] Save migration tests; profile export reminder on first close.
- [ ] `docs/HOW-TO-PLAY.md` and the in-game "?" glossary.
- [ ] QA on Chrome and Safari on a school MacBook and on an iPad (touch tolerated, not tuned).

**Checkpoint 3:** open to the whole class; collect the "I got to…" board.

---

## Playtest checkpoints: what to record

| | Who | Measure | Feeds |
|---|---|---|---|
| CP1 (after 5) | 6–10 students, 2 runs each | floor reached, death cause, confusion, "again?" | Phase 6 priorities, Chapter 1 numbers |
| CP2 (after 7) | class, one week | best floor per class, pick rates vs sim, favourite / least favourite | balance tables, Seals |
| CP3 (after 10) | everyone | crashes, load time, tutorial completion, sound | ship list |

---

## Working agreements (any model, any session)

1. Read `docs/plans.md` (this) then `docs/design.md`. Don't re-litigate **Decisions**.
2. `npm install && npm run check` before touching anything; fix the baseline first.
3. Engine is pure. Content is data. UI never computes rules. `check:boundary` enforces it.
4. Every state mutation emits an event. Every event has a visible response.
5. Tests define done for engine and content. The browser at the real stage size and
   60 fps defines done for UI. Verify in the in-app browser; don't ask Paul to check.
6. Surgical diffs per `CLAUDE.md`. Every changed line traces to a ticked box.
7. Nothing is responsive. A `window.innerWidth` outside `app/stage.ts` is a bug.
8. Numbers live in `design.md` tables and `content/*.json`, never in code.
9. Commit per ticked box; push and deploy per phase.

---

## Phase 0 kickoff (the first session's commands)

```bash
mkdir -p ~/Documents/GitHub/tomeofsecrets && cd ~/Documents/GitHub/tomeofsecrets
git init && npm init -y
npm i pixi.js gsap zod
npm i -D typescript vite vitest eslint @eslint/js typescript-eslint @types/node wrangler
mkdir -p src/{app,engine/{rules,run,meta,dialogue},content/schema,ui/{scenes,cards,combat,dialogue,fx,kit},dev} public/{art,fonts,audio} tools docs .claude
cp ../make/CLAUDE.md . && mv ../make/tomeofsecrets/{plans,design}.md docs/
```

Then `package.json` scripts: `dev`, `build`, `preview`, `test`, `lint`,
`check:boundary`, `check`, `lint:content`, `sim`, `deploy`. Leave a
`make/tomeofsecrets/README.md` pointing at the new repo.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Pixi text blurs when the stage scales | Re-rasterise `Text` at `dpr × s` on resize; prove it in Phase 0. Fallback: MSDF bitmap fonts for numbers. |
| Card feel is subjective and slips | Phase 2 acceptance has numbers and a watch-someone test. Don't leave Phase 2 early. |
| HD art and texture memory on old MacBooks | Per-chapter lazy loading, WebP, atlases, texture counter in `#/dev/stats`, 250 MB ceiling. |
| The effect language can't say a card | `script` escape hatch with a registry; past ~10% of cards, extend the language. |
| Difficulty tuned for Paul, not for kids | Sim targets plus checkpoints; Seals give Paul his challenge without touching Seal 0. |
| Student art arrives late or uneven | Placeholder frames are ship-quality; art is never on the critical path. Size classes and the baseline keep mixed styles readable. |
| Story blocks gameplay | Story is Phase 8 and pure data; skip is always available. |
| localStorage wiped on school machines | Save code, a nag on first close, "export profile" in the Tome. |

---

## Backlog (parked)

- Chapter 4 "The Last Page": a true final boss unlocked by three keys found across a run.
- A fourth class (Warlock / Druid / Rogue).
- Custom mode: modifiers and mutators; a weekly seeded challenge with a shareable link.
- Student-written events via a `.dlg` drop folder with a review step.
- Achievements page in the Tome.
- Run replay from seed + decision log.
- Touch tuning for iPad.

---

## Handoff notes

### After Phase 0 (2026-09-17)

- `npm run check` passes: typecheck, lint, boundary (proven to fire), 14 tests.
- Toolchain landed at TypeScript 6, Vite 8, Vitest 5, ESLint 10, Pixi 8.20, GSAP 3.15.
  Zod 4 is installed for Phase 1's schemas.
- The stage: `src/app/stage.ts`. `Stage.root` is the design space; scenes go through
  `stage.addScene()` so they sit under `stage.overlay` (curtain, toasts). `fit()` in
  `src/app/fit.ts` is the pure maths, tested.
- Text crispness works by registering every `Text` with the stage (`makeText` in
  `src/ui/kit/text.ts` does it). **Create text through `makeText`, not `new Text`,**
  or it will blur when the window is resized. Resolution updates are debounced 120 ms.
- A per-frame `app.screen` vs `innerWidth` check in Stage covers embeds that change
  the viewport without a `resize` event (the desktop app's browser pane does this).
- Router: `src/app/router.ts`. Scenes are `{ view, enter, exit, update? }` factories
  registered by path. Unknown paths bounce to `#/`. The fade curtain swallows input.
- In dev, `window.__tome = { stage, settings, router }` for poking from the console.
- `docs/mood.html` is served in dev at `/docs/mood.html`. The palette is duplicated
  as numbers in `src/ui/kit/palette.ts`; change both.
- Measured on this Mac: 120 fps, 8.3 ms frames, with 1000 spinning sprites. Not yet
  measured on a school MacBook Air.
- **Deploy is a Worker with static assets, not Pages.** wrangler 4.132 routes
  `pages project create` through a Pages-to-Workers path that wants a Workers config,
  so the plan's Pages wording was replaced. The upside: the custom domain is declared
  in `wrangler.jsonc` and needs no dashboard step. Right after a deploy the domain can
  return a 500 for a few seconds while it propagates; `/index.html` 307s to `/`.
- Repo is public under CC0, matching flashstone: https://github.com/contrapaul/tomeofsecrets

### After Phase 1 (2026-09-17)

- 81 tests. `src/engine/rules/index.ts` is the barrel; import from it.
- **Effects resolve from a work queue** (`state.queue`), front-loaded so nested
  effects (`if`, `spend`, powers, traps) resolve before their siblings. A `choose`
  discard/exhaust sets `state.prompt` and the queue waits; `respondPrompt` resumes.
  The card that is resolving sits in `state.inPlay` until an internal `_finishCard`
  step moves it, so a save mid-prompt is exact.
- **Decay timing is StS's:** enemy Vulnerable/Weak/Frail/Chill/Intangible wear off at
  the end of the enemy's own action; the hero's wear off at the end of the round
  (after enemies act), and a debuff an enemy applied that round is skipped once
  (`hero.fresh`). Poison and Burn tick at the start of the holder's turn.
- **Targets by source:** hero-side `target` is the aimed enemy, `all` every enemy,
  `random` one enemy; enemy-side `target`/`hero` is the hero, `self` itself, `all`
  every enemy (a pack buff). Companion, trap and power damage is flat (no Strength);
  hero and enemy attacks use the full maths. Mark applies to any hero-side attack.
- Text generation: `describeCard` / `describeResolved` return `Segment[]` with
  `num: { value, base }` so the UI can colour buffed and debuffed numbers. A card
  with a `script` effect or an `if` that reads badly sets `text` to override; the test
  still checks every printed number appears, which is what caught a fixture whose
  upgrade changed the text but not the effects.
- Content lives in `src/content/**/*.json`, validated on load by `loadContent()`.
  `{ fixtures: true }` includes `content/test/` (engine dummies). Real content so far:
  8 neutrals, 4 status cards, 6 curses.
- The heuristic player is `src/engine/ai/heuristic.ts`, pure, used by the sim and by
  the invariant test. It is meant to be consistent, not clever.
### After Phase 2 (2026-09-17)

- The scene is `src/ui/scenes/combat.ts`; playback is `src/ui/combat/Playback.ts`.
  **Views never read state mid-playback.** Every event carries its totals; pile
  counts and energy are tracked from events and synced from state only when a
  batch finishes. If a new event type needs a total, put it on the event.
- A card can be in three places visually: the hand (`HandLayout`), the floating
  layer (dragging or in play), or gone. `Playback.findView` checks both.
- The desktop app hides the browser pane while a JS tool runs, which throttles
  rAF to 1 fps; **do not time animations through the JS tool.** Use pane-fronting
  actions (screenshots) and the on-screen F readout instead. Real users are fine.
- The hand's order is written back into `state.piles.hand` on rearrange; that is
  the one presentational mutation with no event, on purpose.
- The router now keys on path + query, so `#/dev/fight?seed=x` remounts on a
  seed change (the Again button relies on it).
- Dev knobs: `window.__tome.combat` exposes `state`, `busy`, `hand` in dev builds.

### After Phase 3 (2026-09-17)

- Class cards were generated once from a scratch script and then committed as
  plain JSON; **the JSON is the source**, edit it directly.
- New engine pieces this phase: `costIf` on a card (Hammer of Wrath), the
  `feed` companion action, the `bomb` status (its blast is in `mutate.ts:die`),
  Trueshot/Viper's Kiss as flags read in `effects.ts`, and `costOf` now takes the
  content and a target so conditional costs can look at the enemy.
- Text generation phrases scaled amounts as "Deal 6 damage, +2 per Charge." and
  "Deal damage equal to your block."; check `text.test.ts` before changing wording.
- Widgets live in `src/ui/combat/{ResourceWidget,CompanionView,TrapRow}.ts` and mount
  from `combatScene` based on `content.classes[classId]`.
- `npm run sim -- fight --class mage --enemies dummy-boss` now defaults to the class
  starter and companion; `--deck` still overrides.

### After Phase 4 (2026-09-17)

- **`src/content/generated/art.json` is written by `npm run art`; never hand-edit.**
  `npm run lint:content` runs the scanner in check mode plus the content tests.
  Run `npm run art` after adding any file under `public/art/`.
- Art URLs in the manifest are root-relative without the leading slash; `app/art.ts`
  adds it. Loads fail soft: a bad image logs a warning and the placeholder draws.
- The scanner records `top` (first visible row) per enemy so the intent badge sits
  above the head; `EnemyView.bodyH` is `height − baseline − top` for real art.
- Real art is drawn 1:1 in design pixels: a large enemy really is 700×640 on the
  1920×1080 stage. That is the spec; it looks right for elites and bosses.
- `Enemy.chapter` (1–3) marks shipping enemies; the content test requires art, a
  credit and a Secret for each. Test dummies have no chapter and are exempt.
- The three dummies with art (`dummy-brute`, `dummy-cur`, `dummy-wisp`) are
  SVG-rendered samples from `tools/make-templates.ts`; the wisp's spritesheet is a
  synthetic Aseprite export, kept as the reference for that path.

### After Phase 5 (2026-09-17)

- **The run layer is `src/engine/run/`**: `map.ts`, `rewards.ts`, `run.ts` (the state
  machine), `events.ts` (the dialogue runner). `src/engine/dialogue/parse.ts` is the
  `.dlg` parser. `src/engine/ai/runner.ts` plays whole runs for the sim and tests.
- **`app/runController.ts` owns the one run** (`tome.run.v1`). Scenes call engine
  functions on `controller.run`, then `save()`, then `next()` which routes by phase.
  `src/ui/run/base.ts` guards every run screen: a stale link lands on the right one.
- **Relics reach the fight through `combatHooks(run)`** → `HeroSetup.hooks` (flags,
  fight-start effects, starting resources). The engine keeps those hooks in a module
  variable set by `setHooks`, so `reviveRun` re-supplies them. New relic behaviours
  are either a flag the engine reads or an effect list; add to `relics.json` first.
- **Saves are taken after events are drained**, so a resumed fight has no queued
  events and the scene rebuilds from state; a fight saved before its first action
  still carries the opening events and replays them.
- Events: `content/events/*.dlg` are globbed with `?raw`; `loadContent().events`
  holds the sources and `createRun`/`reviveRun` register them. Portrait ids other
  than `seeker` map to placeholder frames until Phase 8 art.
- `import.meta.glob` is Vite-only: tools that load content run under `vite-node`
  (`npm run sim`). `tsx` remains for the art tools, which do not touch content.
- Dev handles: `window.__tome.runController`, `.runApi`, `.eventApi`, and
  `.combat.{state,hand,enemies,resource}`. Jumping the run state from the console and
  then setting `location.hash` is how the screens were verified.
- Deferred inside this phase: click-to-inspect the piles, a low-HP vignette, Reading
  Glasses (flag exists, no UI), Fresh Pages is data-only (its transform runs on pickup).

- `hero.flags` carries relic-style switches the engine already honours (`aegis`,
  `hourglass`, `quillOfHaste`, `aspectOfTheHawk`, `bestialWrath`, `trueshot`,
  `trappersKit`, `blessedBeads`, `beacon`, `reviveOnce`, `negateNextAttack`,
  `negateBuff`, `retainHand`, `scholarsCap`). Phase 3 and 5 content sets them.

### Feel pass after Phase 5 (2026-09-17, from Paul's first look)

- **Aiming is StS-style now.** A targeted card lifted out of the hand parks in
  `LAYOUT.aimSpot` and the arrow runs from its top to the pointer; over an enemy it
  locks into `EnemyView.center` with a pulsing bullseye. Dragging back into the hand
  band unparks it. The old card-follows-pointer arrow read as a glitch because the
  card was always under the pointer.
- **One intensity scale for impacts**: `ui/fx/impact.ts` `hitIntensity(hp, blocked)`
  (0..1, ~0.44 for 6 damage, 1 at 20+). Enemy hits: knockback + squash + white flash
  + `impactBurst`, and a screen shake at 0.8×. Hero hits: screen shake, portrait shake,
  and a vignette flash coloured by the new `kind` on the `damage` event (`attack` red,
  `poison` green, `effect` orange). The vignette is a canvas sprite (`ui/fx/vignette.ts`)
  because Pixi's `FillGradient` pre-fills radial gradients opaque, so alpha stops
  cannot fade to transparent.
- **End Turn glows** (`Button.setGlow`) when energy is 0 or nothing is playable.
- Map title sits above the boss node now (`top = 200`); the run bar says
  `DECK · 10 CARDS`.
- `window.__tome.gsap` is exposed in dev so animations can be paused and seeked from
  the console (`gsap.globalTimeline.pause(); ...time(t + 0.06)`) to inspect a frame.
- Paul will supply a player-frame border graphic later; the red flash stands in.

### Tutorial and sound scaffolding (2026-09-17, after Checkpoint 1 feedback)

- Students asked for a stronger tutorial. `ui/kit/coach.ts` is a step panel that
  advances only when the scene reports the action it asked for (`coach.notify(...)`),
  or on Got it for the read-only steps; chevrons bob over whatever the step is about.
  The first fight has five steps (attack → energy/skill → intent → end turn → turn two),
  the map has one. Progress is in `tome.tutorial.v1` (`app/tutorial.ts`); Settings →
  Tutorial → Replay resets it. `#/dev/fight?...&coach=1` runs the fight steps anywhere.
- Add a walkthrough to another screen the same way: build a `Coach` with steps, add
  it to the view, call `notify` where the action happens, `markTutorial` on done.
- Sound: `app/audio.ts` is the service; `audio().play(id)` / `audio().music(key)` are
  the whole API and are silent until files exist. `npm run audio` scans
  `public/audio/{sfx,music}` into `content/generated/audio.json` (part of `npm run
  check`). Formats and the id list are in `docs/CONTRIBUTING-AUDIO.md`; the id list
  itself is `SFX_IDS` in `content/schema/audio.ts`, and the scanner rejects anything
  else so a typo cannot silently do nothing.
- `docs/CONTRIBUTING-ART.md` now has the background spec (1920×1080 `far.png`,
  optional transparent `near.png`, per chapter key).

### First real art (2026-09-17)

- Paul's marker drawings of the Bookwyrm, Ink Slime and Inkling are in. They came as
  opaque scans on white paper, so `tools/key-scan.ts` (`npm run art:key`) now exists:
  border-sampled paper colour, flood-fill key (interior whites survive), edge alpha
  with the paper divided out (no pale fringe), trim, fit to the template, feet on the
  baseline, `meta.json` written if missing. Originals are kept in `art-src/enemies/`.
- Ink Slime is `medium` now (drawn at 600×600; it divides into small Inklings, which
  reads right). The Bookwyrm is wide and low for a `large`; if it should loom, the
  next drawing wants to use the template's height.
- `layoutEnemies` still spaces by size class (220/300/380), not by art width, so wide
  blobs overlap a little in threes. Fine for slimes; revisit if it bothers anyone.

### After Phase 6 (2026-09-17)

- **The profile is `engine/meta/profile.ts`** (pure) stored by `app/profile.ts` under
  `tome.profile.v1`. `unlocks(profile, content)` is the one place "what is in the pool"
  is decided: anything no page claims is open from the start, a bought page opens what
  it lists. New content is therefore unlocked by default until a page in
  `content/pages.json` claims it.
- **The run reads the Tome once, at creation.** `RunController.newRun` passes
  `pool` (card and relic ids) and `known` (enemies with written pages) into
  `createRun`; the run never touches the profile again. Rewards, shops, treasure and
  boons all filter by `run.pool`; `stealSecret` in `run.ts` uses `run.known`, which
  the run extends as it kills, so a first kill's Secret can appear the same run.
- **Writing back**: `RunController.finishFight()` → `recordFight` (bestiary seen /
  kills / moves, cards and relics seen) after every fight, saved immediately, so a
  closed tab keeps the page. The end screen calls `settle()` → `recordRun`, which is
  idempotent through `run.ledger`.
- Seals live on the run (`run.seal`) and reach the engine through
  `EncounterSetup.mods` → `state.mods` (enemy HP at spawn, enemy damage in resolution
  and in the badge preview). Elite frequency is a `generateMap` option; prices and the
  Doubt are run-layer.
- Boons are a small DSL (`content/schema/meta.ts` `BoonEffect`) applied once in
  `applyBoon`. `runFlag` writes `run.flags`, `fightFlag` rides `combatHooks` into
  `hero.flags`, `resource` adds to `combatHooks().resources`.
- Origins swap starters one-for-one and name their starter relic; the five origin
  relics are `tier: starter` so they never roll as rewards. Ember/Rime Focus are the
  `emberFocus`/`rimeFocus` hero flags in the status effect.
- Save codes are `TOME1-<fnv1a>-<base64url json>`; `decodeProfile` names the failure.
- The Tome's tabs are plain builders in `ui/scenes/tome.ts`; `#/tome?tab=pages` deep
  links. Grids are sized for Chapter 1; Phase 7 will need paging or a chapter switch
  in the Bestiary and a scroll for Cards.
- Old saves (pre-6) revive with `seal 0`, no pool (everything), and no known pages.

### Second art drop (2026-09-18)

- Paul's cleaned exports (transparent) for the Bookwyrm, Ink Slime and Inkling, plus a
  new Thornwood Sapling. `art:key` now detects a transparent input and uses its alpha
  as the mask, so one command handles scans and clean exports alike; `--flip` mirrors a
  right-facing drawing. Thornwood Sapling is `small` now (drawn on the small template).
  The Sapling was flipped so its dagger leads toward the hero.

### Contribute page and the large template (2026-09-19)

- `public/contribute/index.html` is the student-facing "Help build this" page, linked
  from the title (opens in a new tab). Sizes, formats, Procreate tips, the three
  classes and their Origins, sound, design and writing, how to hand in, and "talk to
  Mr. K first". It is plain HTML in the palette; the technical references stay in
  `docs/CONTRIBUTING-*.md`. Keep the two in step when a size changes.
- **The large enemy template is 700×640 now, not 700×900.** Enemies stand 640 px
  down a 1080 screen, so nothing can be taller than ~540 px above its feet without
  pushing the intent badge off the top; the Librarian's Shade found that out. `art:key`
  caps the fit at `VISIBLE_MAX = 540` minus the float. The Bookwyrm and the Shade were
  refitted. Portraits stay 700×900.
- Mid parallax layer (`mid.png`) is supported; `--flip` mirrors a right-facing drawing.

### After Phase 6.1 (2026-09-19)

- **The glossary is `content/glossary.json`**; `engine/rules/explain.ts` fills its
  `{TOKENS}` from engine constants (`GLOSSARY_TOKENS`) and turns cards, relics, vials,
  statuses, resources, intents and map nodes into `Explanation { title, body, notes }`.
  `explain.test.ts` fails if any status, keyword, resource, intent kind or node type
  lacks an entry, if any term any content touches is missing, or if a token is
  unfilled. Add a status to the engine and the test tells you to write its entry.
- **Terms ride the text.** `Segment.term` marks the glossary word in generated card
  text; `CardView` and the Explainer draw those runs in gold. Scripted enemy moves
  (`split`, `bind`, `ink-trap`) have hand-written sentences in `SCRIPT_TEXT`; a new
  script needs a line there or it explains as its id.
- **`ui/kit/explainer.ts` is one component per scene**, in `stage.overlay`. Components
  call `explainer.attach(target, () => explainer.forX(...), opts)`; attach handles the
  350 ms hover delay, the touch path (Pixi sends no `pointerover` for touch, so it
  listens to `pointerdown` and keeps the note until the next tap elsewhere), and the
  fade. `attach` returns `explainedByTouch()` so pickable things (reward cards,
  relics, vials in the bar) can make the first touch explain and the second pick.
  The hand explains through `HandLayout.onHover`; the inspector calls `showAt` with
  the big card's rectangle. `Tooltip` remains for one-liners (errors, companion, traps).
- The intent event now carries `move`, so a badge can explain the move's effects, not
  only its number. Hidden intents explain as "Hidden".
- **Two leaks fixed on the way**: `DragController` never removed its stage listeners
  (each fight left one behind; harmless until the hover code touched a destroyed hand
  and the exception halted event dispatch), and floating enemies' idle tweens outlived
  their views. `DragController.dispose()` and a `destroyed` hook on `EnemyView` now.
- The tutorial has a sixth step, "The words in gold", gated on the first explanation.

### After Phase 6.3 (2026-09-20)

- **The server is `worker/`**: `index.ts` (fetch: `/api/*` → `routes.ts`, else the
  assets), `lib/{crypto,session,ratelimit,email}.ts` ported from flashstone, `lib/http.ts`
  (HttpError, json, cookies), `lib/store.ts` (the `Store` interface every route talks to,
  and `d1Store`). Routes are tested in `worker/routes.test.ts` against an in-memory
  `Store`, so the auth logic is covered without SQL; the D1 layer was smoke-tested with
  curl locally and on production. `worker/tsconfig.json` types it with
  `@cloudflare/workers-types`; `npm run typecheck` runs both projects.
- **wrangler.jsonc** has `main`, the `ASSETS` binding, `run_worker_first: ["/api/*"]`
  and the D1 binding `DB` (`tomeofsecrets-db`, `3a1f5792-…`). Migrations live in
  `db/migrations/` (append-only): `npm run db:migrate` (local) and
  `npm run db:migrate:remote`. `0001_init.sql` is applied on both.
- **Dev loop**: `npm run dev` (Vite, 5174) proxies `/api` to `npm run dev:api`
  (`wrangler dev --local`, 8788, local D1 in `.wrangler/state`). Run both.
- **Client**: `app/account.ts` owns the session and the sync queue (profile pushed 1.5 s
  after a save, run after every step, flushed on sign-out and when the tab hides; a 401
  mid-sync drops back to the anonymous Tome). `app/profile.ts` and `runController`
  keep separate local documents per account (`tome.profile.u.<id>`, `tome.run.u.<id>`)
  and the anonymous ones; `switchUser` swaps. `tome.profile.carried` records which
  account took the anonymous Tome; `tome.profile.declined.<id>` remembers a "leave it".
  `main.ts` awaits `account().init()` before the router starts and handles
  `?verify=` / `?reset=` links. `app/accountUi.ts` is the DOM overlay (sign in, sign
  up with the carry note, forgot, new password, delete, the carry prompt, a message).
- Cookie: `tome_session`, HttpOnly, Secure, SameSite=Lax, 30 days. Login accepts
  username or email. Sign-up accepts `profile` and `run` and validates the profile with
  the same zod schema the client uses.
- `Router.reload()` rebuilds the current scene; scenes call it after the signed-in
  player changes.
