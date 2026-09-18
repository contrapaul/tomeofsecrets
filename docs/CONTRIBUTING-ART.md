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

## Drew it on paper?

Scan or photograph it on white paper, any size, and hand in the file as is. We run

```
npm run art:key -- scan.png medium your-enemy-id --artist your-credits-id
```

which removes the paper, trims the drawing, scales it to fit the template and stands
it on the baseline. A PNG that is already transparent goes through the same command
and skips the paper step, so a drawing that runs off the bottom of its canvas or sits
on the wrong template size is fixed the same way. Add `--float 90` for something that
hovers: it is placed that many pixels above the ground, bobs instead of breathing, and
casts a small shadow. Add `--flip` if you drew it facing right. White highlights inside the drawing survive; only paper that
touches the edge of the page is removed, so keep the drawing away from the edges
of the scan (a blob that runs off the bottom of the page just gets a flat bottom).
Originals live in `art-src/enemies/` so they can be re-keyed later.

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

Add `"float": 90` for a creature that hovers that far above the ground (draw it with
the air underneath it on the template, or let `art:key` place it).

`artist` is your **credits id** from `src/content/credits.json` — first name and initial,
lowercase with a dash (`sam-t`). Your **display name** in that file is whatever you want
shown in the game. Ask if you want a different one.

## Backgrounds

A fight background is **two pieces of art, with an optional third**, each
**1920 × 1080 PNG**, in `public/art/backgrounds/<key>/`
([template with the guide lines](../public/art/templates/background.png)):

- `far.png` — required. The whole scene, edge to edge, opaque: walls, sky, the far
  shelves. This is the picture; on its own it already works.
- `near.png` — optional but what makes the parallax. Foreground things on a
  **transparent** background: pillars, hanging vines, a table edge, a doorway frame.
  It drifts against the pointer more than the far layer, which is what gives the depth.
- `mid.png` — optional. A middle distance on a transparent background, drifting
  between the two. Only worth it when the scene has three real depths.

The key is the chapter (`chapter1`, `chapter2`, `chapter3`). Layers are drawn
slightly larger than the screen so the drift never shows an edge, so keep anything
important out of the outer 40 px. On the template: enemies stand on the gold line 640
px from the top (the floor should read as floor there), the hero stands at the left,
the hand covers the bottom 270 px (keep that band quiet), and relics sit along the top
64 px. Dark and low-contrast is right — the cards and enemies have to read on top.

## Spell and card art

Every card can have a picture: **500 × 380 PNG, no text, no border**
([template](../public/art/templates/card.png)). Two things to know:

- **Only the middle band shows.** The card's art slot is wide and short, so the game
  keeps all 500 px of width but only the middle **282 px** of height (rows 49–331,
  the gold box on the template). Put the subject there; the top and bottom strips
  are safe margins, not canvas.
- **It is small on the card.** The slot is drawn at 216 × 122, about 43% of your
  drawing. Big shapes and strong contrast read; fine detail and thin lines vanish.
  Think "icon", not "illustration".

Name the file after the card id: `public/art/cards/judgment.png`. The ids and names
are in `src/content/cards/*.json`, or run `npm run art -- --wanted` for the list of
what has no art yet. Attack cards read best with the action (the swing, the bolt);
skills with the effect (the shield, the trap); powers with a symbol.

## Portraits

Portraits for dialogue: 700 × 900 bust, transparent, facing inward
([template](../public/art/templates/portrait.png)). These arrive with the story in
Phase 8; ask before drawing one.

## What is wanted

```
npm run art -- --wanted
```

prints every enemy and card without art, with the template size for each. Enemies
are the biggest win per drawing (a fight is mostly enemy); bosses and elites most of
all. Backgrounds are one per chapter. Cards are many and small.

## What happens next

The game's scanner (`npm run art`) checks sizes and credits and lists your files in
the art manifest. If something is off it says exactly what: wrong size, missing
meta, unknown artist. Once it passes, your enemy appears in fights and in the Tome
with "Drawn by <your name>".
