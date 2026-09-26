# Editing Tome of Secrets

How to change the game without touching the engine. Almost everything you will
want to tweak — a card's damage, an enemy's name, a line of dialogue, which
drawing appears — is a JSON or text file under `src/content/`, and the game
reads it on the next page load.

Start the game locally with `npm run dev` and open <http://localhost:5174>.
Save a content file and the page reloads with your change.

---

## Where everything lives

| I want to change | Open this |
|---|---|
| A card's cost, damage, name, upgrade | `src/content/cards/<class>.json` |
| An enemy's HP, moves, name, flavour | `src/content/enemies/chapter1/<enemy>.json` |
| Which enemies appear, and together | `src/content/encounters/chapter1.json` |
| Event dialogue and choices | `src/content/events/<name>.dlg` |
| Relics | `src/content/relics.json` |
| Vials (the potions) | `src/content/vials.json` |
| Boons (the run-start gift) | `src/content/boons.json` |
| Origins (the sub-classes) | `src/content/origins.json` |
| A class's HP and starting deck | `src/content/classes.json` |
| Tome unlock pages and their Lore costs | `src/content/pages.json` |
| The hover/tap explanations | `src/content/glossary.json` |
| Artist names in the credits | `src/content/credits.json` |
| Enemy drawings | `art-src/enemies/` → `npm run art:key` |
| Card drawings | `public/art/cards/<card-id>.png` |
| Sound effects and music | `public/audio/sfx/`, `public/audio/music/` |
| Menu labels, tutorial wording, screen copy | `src/ui/` (see [Wording that is not content](#wording-that-is-not-content)) |

Two folders you should **not** edit by hand:

- `src/content/generated/` — written by `npm run art` and `npm run audio`.
- `src/engine/` — the rules. Content files tell the engine what to do; you
  should rarely need to change how it does it.

---

## Five rules that will save you an hour

**1. `id` is the wiring, `name` is the words.** Every card, enemy, relic and
vial has an `id` (lowercase, hyphens) and a `name` (what players read). The
`id` is how everything else points at it — decks, encounters, unlock pages,
artwork folders. Change the `name` freely. Changing an `id` means finding
every other place that mentions it.

**2. Renaming is safe, re-iding is a job.** To call the Bramble Sprite
something else, change one `"name"` and you are done. If you must change an
`id`, search the whole project for the old one first:

```bash
cd ~/Documents/GitHub/tomeofsecrets && grep -rn "bramble-sprite" src public art-src
```

**3. Unknown fields are errors, not silence.** The content files are strictly
checked. If you type `"dammage": 6`, the game refuses to start and tells you
the file and the field. That is deliberate — a typo can never quietly do
nothing.

**4. Every file is validated on load.** A bad edit fails loudly and names
itself, on the page and in the terminal running `npm run dev`:
`./cards/mage.json: 7.effects.0.amount: Invalid input`. The number is the
card's position in the list, counting from 0.

**5. Check before you ship.** `npm run check` runs the types, the linter and
145 tests in about ten seconds.

---

## Recipes

### Tweak a card

`src/content/cards/` has one file per class: `paladin.json`, `tracker.json`,
`mage.json`, plus `neutral.json`, `secrets.json`, `curses.json`,
`status.json`. Each file is a **list** of cards. Hammer Blow, in full:

```json
{
  "id": "hammer-blow",
  "name": "Hammer Blow",
  "class": "paladin",
  "type": "attack",
  "rarity": "starter",
  "cost": 1,
  "target": "enemy",
  "effects": [{ "do": "damage", "amount": 6, "target": "target" }],
  "upgrade": {
    "effects": [{ "do": "damage", "amount": 9, "target": "target" }]
  }
}
```

To make it hit for 7, change the `6`. To make the upgrade cheaper instead of
stronger, put `"cost": 0` in the `upgrade` block.

**The upgrade block replaces, it does not merge.** Whatever you list under
`upgrade` wins; everything you leave out stays as the base card. So an upgrade
that changes damage must repeat the *whole* `effects` list, as above. An
upgrade that only changes cost is just `{ "cost": 0 }`. The upgraded name is
the base name with a `+` unless you set `"name"` yourself.

Fields a card can have:

| Field | Meaning |
|---|---|
| `id` | lowercase-with-hyphens, unique across every card file |
| `name` | what the player reads |
| `class` | `paladin`, `tracker`, `mage`, `neutral`, `secret`, `curse`, `status` |
| `type` | `attack`, `skill`, `power`, `status`, `curse` |
| `rarity` | `starter`, `common`, `uncommon`, `rare`, `secret`, `curse`, `status` |
| `cost` | a number, or `"X"` to spend all energy |
| `target` | `enemy` (must be aimed) or `none` |
| `effects` | what it does — see [The effect language](#the-effect-language) |
| `upgrade` | required; `{}` if the upgrade changes nothing |
| `keywords` | any of `exhaust`, `retain`, `innate`, `ethereal`, `unplayable` |
| `text` | overrides the auto-written card text; only needed when the generated line reads badly |
| `tags` | `arcane`, `fire`, `frost` — some cards and relics look for these |
| `from` | for Secrets: the enemy `id` it was learned from |
| `playableIf` | `targetBelowHalf` or `firstCardThisTurn` |
| `costIf` | `{ "when": <condition>, "cost": 0 }` — a cheaper cost when a condition holds |
| `onDraw`, `onEndOfTurnInHand`, `onFightStart` | effect lists for curses and statuses |

The card's printed text is **written for you** from its effects. You only need
`text` when the auto-generated sentence is clumsy (or when the card uses a
`script` effect, where it is required).

### Add a new card

Copy an existing card in the same file, change the `id` and `name`, edit the
effects. It is in the game immediately — the loader picks up every card in
every file in `src/content/cards/`.

A new card will not appear in runs until something offers it. Cards are
offered by rarity within their class, unless an unlock page claims them: see
`src/content/pages.json`. Anything no page mentions is available from the
start.

### Change an enemy

`src/content/enemies/chapter1/` has **one file per enemy**, and each file is a
single object (not a list, unlike cards).

```json
{
  "id": "bramble-sprite",
  "name": "Bramble Sprite",
  "size": "small",
  "tags": ["spirit", "plant"],
  "hp": [30, 34],
  "chapter": 1,
  "secret": "thorncoat",
  "moves": {
    "thorn-whip": {
      "intent": "attack",
      "effects": [{ "do": "damage", "amount": 4, "target": "hero", "times": 2 }]
    },
    "root": {
      "intent": "debuff",
      "effects": [{ "do": "status", "status": "frail", "amount": 2, "target": "hero" }]
    }
  },
  "pattern": { "type": "cycle", "moves": ["thorn-whip", "root", "grow"] },
  "flavour": "The longer you leave it, the worse it gets. Like most weeds."
}
```

- `hp` is a range — `[30, 34]` means it rolls between the two.
- `size` picks the art template: `small` 400×400, `medium` 600×600, `large` 700×640.
- `rank` can be `normal`, `elite`, `boss` or `minion`.
- `intent` is the badge the player sees before the move lands: `attack`,
  `defend`, `buff`, `debuff`, `special`, `summon`.
- `pattern` decides the order. `cycle` runs the list in a loop; `weighted`
  rolls from `{"move": 3, "other": 1}` and takes `noRepeat` to stop it
  repeating; `script` hands over to named code in the engine.
- `phases` lets a boss change pattern below a fraction of its HP.
- `secret` is the card `id` the player learns from it. `flavour` is the one
  line in the Bestiary.

Inside a move's effects, `"target": "hero"` means the player.

### Change which enemies appear

`src/content/encounters/chapter1.json` holds four pools — `easy`, `normal`,
`elite`, `boss`. Each pool is a list of **groups**, and a group is the set of
enemies that turn up in one fight together:

```json
"easy": [
  ["ink-slime"],
  ["page-wisp", "page-wisp", "page-wisp"],
  ["feral-cur", "feral-cur"]
]
```

Add a group to put a new fight in rotation. Every id must exist, or the game
says so on startup.

### Put artwork in the game

**Enemies.** Drop the drawing in `art-src/enemies/`, then:

```bash
cd ~/Documents/GitHub/tomeofsecrets && npm run art:key -- art-src/enemies/my-monster.png small my-monster --artist paul-k
```

The three arguments are the file, the size class, and the enemy `id`. Add
`--float 40` for something that hovers, `--flip` for a creature drawn facing
right. That writes `public/art/enemies/<id>/idle.png` and a `meta.json`.
Then rebuild the manifest:

```bash
cd ~/Documents/GitHub/tomeofsecrets && npm run art
```

**The folder name must equal the enemy's `id`.** That is the whole link —
there is no `art:` field to set on the enemy.

**Cards.** Save a 500×380 image as `public/art/cards/<card-id>.png` and run
`npm run art`. Same rule: the filename is the card's `id`.

**Portraits** are 700×900 in `public/art/portraits/`; **backgrounds** are
1920×1080 in `public/art/backgrounds/<key>/far.png`, with optional `mid.png`
and `near.png` for parallax.

To see what still has no art:

```bash
cd ~/Documents/GitHub/tomeofsecrets && npm run art -- --wanted
```

Full details, templates and drawing advice: [docs/CONTRIBUTING-ART.md](docs/CONTRIBUTING-ART.md).

### Add a sound

Save a WAV (48 kHz, 16-bit, mono) as `public/audio/sfx/<id>.wav`, where `<id>`
is one of the 26 names the game asks for — `card-play`, `hit-heavy`, `block`,
`victory` and so on. Music goes in `public/audio/music/` as `title.mp3`,
`map.mp3`, `fight.mp3`, `boss.mp3`. Then:

```bash
cd ~/Documents/GitHub/tomeofsecrets && npm run audio
```

A sound with no file is silence; nothing breaks. Full list and recording
advice: [docs/CONTRIBUTING-AUDIO.md](docs/CONTRIBUTING-AUDIO.md).

### Write an event

`src/content/events/` holds one `.dlg` file per event. **Every file in that
folder is automatically in the pool** — add one and it can appear. The game
prefers events the player has not seen yet.

```
title: A Torn Page
portrait left: seeker
portrait right: archivist mood=sly

archivist: A page, torn from something older than this place. It hums when you get close.
seeker: What's the catch?
archivist: There is always a catch, {name}.

choice:
  - Take the page (a relic, and a Doubt in your deck) -> take
  - Leave it -> leave
  - [if gold >= 50] Pay 50 gold for it, no strings -> buy

@take
  > relic random common
  > curse doubt
  archivist: Wise. Foolish. Both. Off you go.
  > end

@leave
  archivist: Another time, then. It will still be here.
  > end
```

**How it reads:**

- `title:` is the header the player sees; `portrait left/right:` sets the two
  speakers, with an optional `mood=`.
- `speaker: words` is a line of dialogue. A line with no `speaker:` continues
  the previous one.
- `choice:` starts a menu; each option is `- label -> section`. Put
  `[if condition]` before the label to hide it unless the condition holds.
- `@name` starts a section. Choices jump to them.
- `> command` does something to the run.
- `#` starts a comment. Blank lines and indenting are free.

**Conditions** for `[if ...]`: `gold`, `hp`, `maxhp`, `chapter`, `vials`
(compared with `>=`, `<=`, `>`, `<`, `==`, `!=`), plus `class == mage`,
`relic <id>` and `flag <name>`.

**Commands:**

| Command | Does |
|---|---|
| `> gold 100` / `> gold -75` | give or take gold |
| `> hp -6` / `> maxhp 5` | damage or heal; change max HP |
| `> heal pct 30` / `> heal full` | heal a percentage, or fully |
| `> card add <id>` | add a card; `random rare` picks one; add `upgraded` |
| `> card remove choose 1` | the player picks 1 card to remove; also `upgrade` and `transform` |
| `> card remove random 2` | `random` in place of `choose` picks for them |
| `> curse <id>` | add a curse card |
| `> relic <id>` / `> relic random common` | grant a relic |
| `> vial <id>` / `> vial random` | grant a vial |
| `> fight ink-slime,page-wisp` | start a fight; add `reward:double` |
| `> flag set <name>` / `> flag clear <name>` | remember something for later |
| `> goto @section` | jump |
| `> end` | finish the event |

Every `goto` and every choice target must name a section that exists, or the
file is rejected with the line number.

### Change the hover explanations

`src/content/glossary.json` holds the 56 entries behind the gold words and the
explainer panel. Each is `{ id, kind, name, text, related }` where `kind` is
`status`, `keyword`, `resource`, `term`, `intent` or `node`. The `id` for a
status must match the status name the engine uses (`vulnerable`, `frail`…).

Some entries use `{TOKENS}` like `{FREEZE_AT}`, which the engine fills in with
the real number so the text can never drift from the rules.

### Change the Tome's unlocks and prices

`src/content/pages.json` — each page has a Lore `cost`, a `name`, a `blurb`,
and a list of what it `unlocks`. `requires` chains one page behind another.
Anything not named by a page is unlocked from the start.

### Wording that is not content

Menu labels, tutorial steps and screen copy live in the interface code. They
are ordinary strings — find the text and edit it in place.

| Wording | File |
|---|---|
| Title screen menu | `src/ui/scenes/title.ts` |
| The fight walkthrough (6 steps) | `startCoach()` in `src/ui/scenes/combat.ts` |
| The map walkthrough | `src/ui/run/map.ts` |
| Reward, shop, camp, treasure, run-end screens | `src/ui/run/*.ts` |
| The Tome | `src/ui/scenes/tome.ts` |
| Settings, credits | `src/ui/scenes/settings.ts`, `credits.ts` |
| "Help build this" page | `public/contribute/index.html` |

---

## The effect language

Cards, enemy moves, relics, vials and events all describe what they do with
the same list of effects. Each one is an object with a `do:`.

| `do` | Fields | Meaning |
|---|---|---|
| `damage` | `amount`, `target`, `times?`, `tags?` | deal damage; `times: 2` hits twice |
| `block` | `amount`, `target?` | gain block |
| `status` | `status`, `amount`, `target` | apply a status |
| `removeStatus` | `status` (or `debuffs`/`buffs`), `target` | clear statuses |
| `draw` | `amount` | draw cards |
| `energy` | `amount` | gain energy this turn |
| `heal` | `amount`, `target?` | heal |
| `gold` | `amount` | gain gold |
| `resource` | `name`, `amount` | gain Holy Power or Charge |
| `spend` | `name`, `then` | spend all of a resource, then do `then` |
| `exhaust` / `discard` | `from` (`hand`, `random`, `choose`), `count?` | remove cards from hand |
| `retrieve` | `from` (`discard`, `exhaust`), `count?` | take cards back into hand |
| `addCard` | `card`, `to` (`hand`/`discard`/`draw`), `upgraded?`, `count?` | make a card |
| `trap` | `trigger`, `effects` | arm a trap (`enemyAttack`, `enemyBuff`, `enemyTurnStart`) |
| `companion` | `action` (`act`, `enrage`, `unstun`, `feed`), `bonus?` | the Tracker's pet |
| `power` | `trigger`, `effects`, `name?` | a lasting effect for the rest of the fight |
| `if` | `when`, `then`, `else?` | conditional |
| `summon` | `enemy`, `count?`, `max?` | bring in more enemies |
| `flag` | `name` | remember something within the fight |
| `script` | `id` | hand over to named engine code (needs a `text` override) |

**Targets:** `target` (what was aimed at), `all`, `random`, `self`, `hero`,
`companion`.

**Amounts** are usually a number, but can scale:

```json
{ "do": "damage", "amount": { "base": 4, "per": "holyPower", "mult": 2 }, "target": "target" }
```

`per` can be `holyPower`, `charge`, `block`, `targetBurn`, `targetChill`,
`targetMark`, `cardsInHand`, `energy`, `spent`, `strength`.

**Conditions** for `if`, `costIf` and `playableIf`:
`{"resourceAtLeast": "holyPower", "amount": 3}`, `{"targetHas": "vulnerable"}`,
`{"targetBelowHp": 0.5}`, `{"heroBelowHp": 0.5}`, `{"playedNoAttack": true}`,
`{"firstCardThisTurn": true}`, `{"targetTag": "undead"}`, `{"flag": "name"}`,
`{"goldAtLeast": 50}`.

**Statuses:** `strength`, `dexterity`, `vulnerable`, `weak`, `frail`, `poison`,
`burn`, `chill`, `frozen`, `mark`, `thorns`, `regen`, `artifact`,
`platedArmor`, `metallicize`, `intangible`, `images`, `stun`, `wait`, `ritual`,
`enrage`, `bomb`.

**Power triggers:** `startTurn`, `endTurn`, `onAttackPlayed`, `onSkillPlayed`,
`onCardPlayed`, `onExhaust`, `onEnemyDeath`, `onResourceGain`, `onEnemyAttack`,
`onDamageTaken`, `onFireAttack`.

---

## Seeing your change

With `npm run dev` running, these screens skip straight to what you are
editing. Add them to the end of the address, e.g.
`http://localhost:5174/#/dev/cards?class=mage`.

| Address | Shows |
|---|---|
| `#/dev/cards?class=paladin` | every card of a class, laid out; add `&up=1` for upgrades |
| `#/dev/enemy?id=bramble-sprite` | one enemy, its poses and its animations |
| `#/dev/fight?class=mage&enemies=ink-slime,page-wisp` | a fight, right now |
| `#/dev/fight?...&deck=reshelve*3,strike*7` | a fight with a deck you choose; `+` upgrades, `*n` repeats |
| `#/dev/fight?...&coach=1` | with the tutorial running |
| `#/dev/stats` | frame time and performance |

---

## Checking and shipping

```bash
cd ~/Documents/GitHub/tomeofsecrets && npm run check
```

Types, linter, and 145 tests. Run it before you deploy. For a content-only
edit, the faster check is:

```bash
cd ~/Documents/GitHub/tomeofsecrets && npm run lint:content
```

Then put it on the web:

```bash
cd ~/Documents/GitHub/tomeofsecrets && npm run deploy
```

That builds and pushes to <https://tome.contrapaul.com>. Save your work to
GitHub separately with `git add -A`, `git commit -m "..."`, `git push`.

---

## When it breaks

**The game will not start and names a file.** A content file failed its
check. The message appears on the page and in the terminal, and reads
`./cards/mage.json: 7.effects.0.amount: Invalid input` — the file, the card's
position in the list counting from 0, then the field. Look there.

**"Unrecognized key".** A field name is misspelled, or that field does not
belong on that kind of thing. Check the table above.

**"names unknown enemy / unknown card / unknown relic".** Something points at
an `id` that does not exist — usually a typo, or an `id` you renamed in one
place but not the other.

**A drawing does not appear.** The folder or filename must be exactly the
`id`, and you must run `npm run art` afterwards. `npm run art -- --wanted`
tells you what the game thinks is still missing.

**A `.dlg` file is rejected.** The error gives the line number. Most often a
choice points at a section that does not exist, or a `-> target` is missing.

**Everything is broken and you want out.** `git status` shows what you
changed; `git checkout <file>` throws away your edits to that file and puts
the last saved version back.
