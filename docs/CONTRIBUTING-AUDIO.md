# Sound for Tome of Secrets

Record a sound, name the file, drop it in. The game picks it up on the next build.
Nothing waits on audio: a sound with no file is silence, and the game plays the same.

## Formats

| What | Format | Why |
|---|---|---|
| Sound effects | **WAV**, 48 kHz, 16-bit, **mono** | Decodes everywhere with zero start delay. A one-second file is 94 KB; forty of them are under 4 MB. |
| Music | **MP3** (192 kbps) or **M4A/AAC**, 48 kHz, stereo | Plays in every browser. WAV would be 10 MB a minute. |

`.wav`, `.mp3`, `.m4a` and `.ogg` are accepted in both folders; the table is what
works best. Please do not send compressed sound effects: MP3 adds ~50 ms of silence
at the start of every file, which makes a hit land late.

Recording tips: trim the front tight (the sound should start within the first
millisecond), leave a short natural tail, peak around −3 dB, no clipping. Effects
under two seconds. Every sound gets a small random pitch wobble in the game, so
one good take is enough; three takes are better for hits and draws (see below).

## Sound effects: the names

Put files in `public/audio/sfx/`, named exactly:

| File | Plays when |
|---|---|
| `card-draw` | each card leaves the draw pile (five in a row at the start of a turn, so keep it short and soft) |
| `card-hover` | the pointer lifts a card in the hand (quiet) |
| `card-play` | a card lands on the table |
| `card-discard` | a card flies to the discard pile |
| `card-exhaust` | a card burns away |
| `card-pick` | a reward card is chosen |
| `hit-light` | an enemy takes up to 11 damage |
| `hit-heavy` | an enemy takes 12 or more |
| `hit-blocked` | a hit that block absorbed completely |
| `hero-hurt` | the hero loses health |
| `block` | anyone gains block |
| `heal` | health comes back |
| `buff` | a helpful status is applied (Strength, Regen…) |
| `debuff` | a harmful one (Vulnerable, Poison, Weak…) |
| `enemy-attack` | an enemy lunges |
| `enemy-die` | an enemy dies |
| `turn-start` | your turn begins |
| `turn-end` | you press End Turn |
| `ui-click` | any button |
| `map-move` | you pick a node on the map |
| `gold` | gold changes hands |
| `shop-buy` | a purchase |
| `rest` | resting at a camp |
| `victory` | the fight is won |
| `defeat` | the fight is lost |
| `secret` | a Secret is stolen from an enemy (Phase 6) |

**Extra takes**: `hit-light.wav`, `hit-light-2.wav`, `hit-light-3.wav` are all the same
sound; the game picks one at random each time. Worth doing for `card-draw`,
`hit-light`, `hit-heavy` and `ui-click`, which play constantly.

## Music

Put files in `public/audio/music/`, named by where they play:

| File | Plays on |
|---|---|
| `title` | the title screen |
| `map` | the map, shops, camps, rewards, events |
| `fight` | normal fights in Chapter 1 (`fight-2`, `fight-3` for later chapters) |
| `elite` | elite fights |
| `boss` | the chapter boss |
| `tome` | the Tome (Phase 6) |

Every track loops. If the file has a lead-in or a tail that should not repeat, add
`<key>.json` beside it with loop points in seconds:

```json
{ "artist": "sam-t", "title": "The Moss Halls", "loopStart": 4.0, "loopEnd": 92.5 }
```

`artist` is a credits id from `src/content/credits.json` (role `music`); the name
shows in the credits. Tracks crossfade over about a second when the scene changes.

## Checking your files

```
npm run audio
```

lists what it found and complains about anything it cannot use: a name that is not
on the list, a music key it does not know, a composer who is not in the credits.
The result is written to `src/content/generated/audio.json`, which is what the game
reads; never edit that file by hand. `npm run check` runs the same scan.

In the game, Settings has Music and Sound levels. In a dev build,
`__tome.audio.play('hit-heavy')` in the console auditions a sound.
