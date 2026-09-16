# Drawing for Tome of Secrets

You draw a monster. It fights in the game. Your name goes on its page in the Tome and
in the credits. Here is everything you need.

## The five-minute version

1. Download a template: [small](../public/art/templates/enemy-small.png) (400×400),
   [medium](../public/art/templates/enemy-medium.png) (600×600) or
   [large](../public/art/templates/enemy-large.png) (700×900).
2. Draw your creature on it. **Feet on the gold line. Facing left.** Transparent
   background. Delete the template layer before you export.
3. Export a PNG at exactly the template's size.
4. Open the game's preview page: `tome.contrapaul.com/#/dev/enemy`. Drag your PNG
   onto it. Watch it breathe, lunge, get hit and die. Adjust and repeat.
5. Type your enemy's id (like `moss-beetle`) and your credits id, press **Export
   meta**, and hand in three things: `idle.png`, `meta.json`, and the name you want
   in the credits.

That is a shippable enemy. Everything below is optional.

## Sizes

| Size | Canvas | Use for |
|---|---|---|
| small | 400 × 400 | swarmers, critters, things that come in threes |
| medium | 600 × 600 | most enemies |
| large | 700 × 900 | elites, bosses, anything that should loom |

Your creature does not have to fill the canvas, but the game reads the top of the
visible pixels to place the intent badge, so leave no stray marks above the head.

## Rules that matter

- **Feet on the baseline**: 40 px up from the bottom edge. The game stands enemies on
  that line; if your feet float, the enemy floats.
- **Face left.** The hero stands on the left. The lunge goes that way.
- **Transparent background.** PNG with alpha. No white box.
- **No text, no border, no drop shadow** — the game adds its own shadow.
- **Flat colour is fine, painted is fine, pencil-scanned-and-cleaned is fine.** Mixed
  styles are expected. What makes them sit together is the baseline and the size.
- **Keep it school-appropriate.** Scary is good. Gore is not.

## Extra poses (optional)

Same canvas, same size, same feet. Put them in the same folder:

- `attack.png` — shown during the lunge. Wind-up, claws out, mouth open.
- `hurt.png` — shown for a moment when hit. Flinch, squint.
- `dead.png` — the last frame before it fades.

The game swaps to these automatically. Any you skip fall back to `idle.png`.

## Frame animation (optional, for the keen)

If you animate in Aseprite: every frame is the full canvas with feet on the baseline.
Tag your animations `idle` (loops), and optionally `attack`, `hurt`, `die`. Export a
sprite sheet with JSON data (Hash type, tags on). Hand in the sheet PNG and the JSON;
we run `npm run art:aseprite` and the game plays your frames instead of the puppet.

## The files

```
public/art/enemies/<your-enemy-id>/
├── idle.png        required
├── meta.json       required: { "id", "size", "artist" }
├── attack.png      optional
├── hurt.png        optional
├── dead.png        optional
└── idle.json       optional spritesheet, from Aseprite
```

`meta.json` looks like this:

```json
{ "id": "moss-beetle", "size": "medium", "artist": "sam-t", "notes": "" }
```

`artist` is your **credits id** from `src/content/credits.json` — first name and initial,
lowercase with a dash (`sam-t`). Your **display name** in that file is whatever you want
shown in the game. Ask if you want a different one.

## Card art and portraits

- Card art: 500 × 380, no text, no border ([template](../public/art/templates/card.png)).
  It is cropped to a wide strip on the card, so keep the subject in the middle band.
- Portraits for dialogue: 700 × 900 bust, transparent, facing inward
  ([template](../public/art/templates/portrait.png)).

## What happens next

The game's scanner (`npm run art`) checks sizes and credits and lists your files in
the art manifest. If something is off it says exactly what: wrong size, missing
meta, unknown artist. Once it passes, your enemy appears in fights and in the Tome
with "Drawn by <your name>".
