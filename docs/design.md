# Tome of Secrets: design

The content bible. Rules first, then classes and cards, enemies, the run, relics,
meta, dialogue, schemas, art, numbers. **Every number is a starting value for the sim
and the playtests to tune. Every rule is a decision.** Cards marked **1st** are the
Phase 3 first pass; the rest arrive in Phase 7. Roadmap and phases: `plans.md`.

---

## 1. Pillars

1. **Readable.** Every intent shown, every number visible, every keyword hoverable.
2. **Physical cards.** Draw, hover, drag, play, rearrange, discard: paper with weight.
3. **Hard, short, retry.** 25–35 minutes. Deaths are the player's fault, in hindsight.
   Something is always unlocked.
4. **Steal Secrets.** Enemies and players share one ability system, and every enemy
   has one thing worth taking.
5. **Made by the class.** Student art with names on it.
6. **Locked frame.** 1920×1080, uniformly scaled. Nothing reflows.

## 2. Glossary

| Term | Meaning |
|---|---|
| Seeker | The player character (Paladin, Tracker, Mage) |
| Chapter | An act: a map of 10 floors and a boss. Three per run |
| Floor | One row of the map. Nodes: Fight, Elite, Event, Merchant, Camp, Treasure, Unknown, Boss |
| Tome | The persistent meta: Bestiary, Cards, Relics, Pages, Stats, Credits |
| Page | A permanent unlock, bought with Lore or written by a first kill |
| Lore | Meta currency earned at the end of every run, won or lost |
| Secret | An enemy's signature move as a colourless card |
| Relic | Passive item held for the run |
| Vial | Consumable, 3 slots |
| Seal | Difficulty tier 0–10, per class |
| Origin | Starter deck and starter relic variant, 3 per class |
| Boon | One of three run-start offers |
| Companion | The Tracker's animal, chosen at run start |
| Camp | Rest (heal 30%) or Smith (upgrade one card) |
| Merchant | Shop |

## 3. Combat rules

Slay the Spire, restated so nothing is assumed.

- **Hero:** HP by class (§4). **Energy** 3 at the start of every turn, not carried over.
  **Draw** 5. Hand limit 10; overflow goes to discard.
- **Turn order:** Start of turn (block → 0 unless a Barricade effect; energy = 3 +
  bonuses; draw; start-of-turn triggers) → player plays cards in any order → End Turn
  (end-of-turn triggers; discard hand except Retain; Companion acts; armed Traps stay)
  → enemy turn (each enemy left to right resolves its intent; statuses tick; it chooses
  its next intent) → repeat.
- **Damage:** `floor((base + Strength) × (Vulnerable ? 1.5 : 1) × (Weak ? 0.75 : 1))`
  per hit, minus flat Chill on the attacker, then block absorbs, then HP. Multi-hit
  computes per hit. Minimum 0.
- **Block:** `base + Dexterity`, ×0.75 if Frail. Expires at the start of your turn.
- **Enemies act in order.** One that dies mid-turn does not act. Killing all enemies
  ends the fight immediately (queued events still play out visually).
- **Targeting:** cards with `target: enemy` need a target; without one they are
  refused, never fizzled. `all`, `random`, `self` need none.
- **Card types:** Attack, Skill, Power, Status, Curse. Powers go to a powers list and
  are gone at fight end. Status and Curse are unplayable unless stated; Curses stay in
  the deck, Statuses are removed at fight end.
- **Keywords:** Exhaust (removed for the fight when played), Retain (not discarded at
  end of turn), Innate (starts in hand), Ethereal (exhausts if not played this turn),
  Unplayable, X-cost (spends all energy), Armed (a Trap; see §4 Tracker), Arcane /
  Fire / Frost (Mage school tags), Beast / Undead / Spirit / Demon / Construct / Ooze
  / Plant / Humanoid (enemy tags, which some cards care about).
- **Rarity:** Starter, Common, Uncommon, Rare, Secret, Curse. Reward weights §7.
- **Upgrades:** every card has exactly one upgrade (numbers or a keyword), once per
  copy. Sources: Smith at Camp, some relics, some events.
- **Vials:** used any time on your turn, instant, gone when used.
- **Fight end:** block, statuses, Holy Power, Charges, Marks, Traps, Companion states,
  Powers all clear. HP, deck, relics, vials, gold persist.

### Statuses

Shared by hero and enemies unless noted. Decay is per turn of the holder.

| Status | Effect | Decay |
|---|---|---|
| Strength X | +X damage per hit | none |
| Dexterity X | +X block per block gain | none |
| Vulnerable X | takes ×1.5 damage | −1/turn |
| Weak X | deals ×0.75 damage | −1/turn |
| Frail X | gains ×0.75 block | −1/turn |
| Poison X | at start of holder's turn, lose X HP (ignores block), then X−1 | built in |
| Burn X | at start of holder's turn, take X damage (block applies), then X−1 | built in |
| Chill X | each hit deals −X damage (min 0). At 5, becomes **Frozen** | −1/turn |
| Frozen | skips its next action, then loses all Chill. Bosses and elites cannot freeze: at 5 Chill they instead take 15 damage and lose all Chill (**Shatter**) | one action |
| Mark X | attacks against this enemy deal +3; each hit consumes 1 Mark | on hit |
| Thorns X | an attacker takes X damage per hit | none |
| Regen X | at end of turn heal X, then X−1 | built in |
| Artifact X | negates the next X debuffs | on use |
| Plated Armor X | gain X block at end of turn; −1 whenever HP damage is taken | on damage |
| Metallicize X | gain X block at end of turn | none |
| Intangible X | take at most 1 damage from any source | −1/turn |
| Images X | the next X attacks against the hero are negated | on use |
| Stun | skips its next action (enemies and Companion only) | one action |
| Wait | the enemy's next intent is postponed one turn | one action |
| Ritual X | gains X Strength at end of turn (enemies) | none |
| Enrage X | gains X Strength whenever the hero plays a Skill (enemies) | none |
| Bound | a card in hand is unplayable until the hero takes HP damage | on damage |

Enemy-applied hero debuffs are limited to Vulnerable, Weak, Frail, Poison, Burn, Chill,
Bound, plus Status cards. Keep it that way so a hero's status row stays readable.

## 4. Classes

### 4.1 Paladin — the Oathbound

**HP 80.** Sturdy, rhythmic, converts defence into offence. Lowest card draw needs.

**Holy Power (HoPo):** 0–5 pips, gained by *generators*, spent by *spenders*
("Spend all: X"). Persists between turns inside a fight; clears at fight end. Overflow
above 5 is lost. Widget: five gold pips under the portrait; glow at 5.

**Archetypes.** *Bulwark*: block that stays and hits back (Aegis, Holy Wrath,
Retribution). *Verdict*: the generate/spend rhythm (Blade of Justice → Final Verdict).
*Radiance*: healing that overflows into block and burns enemies (Beacon, Consecration).

**Starter deck (10):** Hammer Blow ×4, Raise Shield ×4, Crusader Strike, Shield of the
Righteous. **Starter relic:** Sunbrand Libram (start each fight with 1 Holy Power).

**Origins:** *Oath of the Shield* (default): as above. *Oath of Vengeance*: swap two
Hammer Blows for Judgment and Templar's Verdict; relic Sunbrand Libram → Ashen Libram
(start each fight with 2 Holy Power; −5 max HP). *Oath of Light*: swap a Hammer Blow
and a Raise Shield for Holy Shock and Flash of Light; relic → Beacon Libram (heal 3
after each fight).

| Name | Cost | Type | Rarity | Effect | Upgrade | 1st |
|---|---|---|---|---|---|---|
| Hammer Blow | 1 | A | Starter | 6 damage | 9 | ✓ |
| Raise Shield | 1 | S | Starter | 5 block | 8 | ✓ |
| Crusader Strike | 1 | A | Starter | 6 damage. +1 HoPo | 9 | ✓ |
| Shield of the Righteous | 1 | S | Starter | 7 block. +1 HoPo | 10 | ✓ |
| Judgment | 1 | A | C | 7 damage. +1 HoPo. If HoPo ≥ 3, apply 1 Vulnerable | 10 | ✓ |
| Hammer of the Righteous | 1 | A | C | 4 damage to ALL. +1 HoPo | 6 | ✓ |
| Zealous Blow | 1 | A | C | 4 damage ×2 | ×3 | ✓ |
| Holy Shock | 1 | S | C | 5 damage. If HoPo ≥ 3, heal 3 | 8 / 4 | ✓ |
| Flash of Light | 1 | S | C | Heal 4. Exhaust | 6 | ✓ |
| Consecration | 1 | P | C | At end of turn, 3 damage to ALL | 4 | ✓ |
| Devotion | 1 | S | C | 8 block. If HoPo ≥ 3, +4 | 11 / +5 | ✓ |
| Word of Glory | 1 | S | C | Spend all HoPo: 4 block +3 per | 6 / +4 | ✓ |
| Templar's Verdict | 1 | A | C | Spend all HoPo: 5 damage +4 per | 7 / +5 | ✓ |
| Retribution | 1 | P | C | 2 Thorns | 3 | ✓ |
| Divine Steed | 0 | S | C | Draw 2. Exhaust | no Exhaust | ✓ |
| Rebuke | 1 | S | C | Apply 2 Weak | 3 | ✓ |
| Cleanse | 0 | S | C | Remove your debuffs. Exhaust | + heal 3 | |
| Bulwark | 2 | S | C | 14 block | 18 | ✓ |
| Blade of Justice | 1 | A | U | 9 damage. +2 HoPo | 12 | ✓ |
| Divine Storm | 1 | A | U | Spend all HoPo: 3 damage to ALL +3 per | 4 / +4 | ✓ |
| Avenger's Shield | 1 | A | U | 7 damage, apply 1 Weak. If HoPo ≥ 3, hits ALL | 9 | ✓ |
| Holy Wrath | 1 | A | U | Damage equal to your block | +3 | ✓ |
| Righteous Fury | 1 | P | U | Whenever you gain HoPo, gain 2 block | 3 | ✓ |
| Zeal | 1 | P | U | The first Attack each turn gives +1 HoPo | first two | |
| Blessing of Might | 1 | P | U | Gain 2 Strength | 3 | ✓ |
| Blessing of Kings | 2 | P | U | Gain 1 Strength and 1 Dexterity | 2 / 1 | |
| Seal of Light | 1 | P | U | Whenever you play an Attack, heal 1 | 2 | |
| Hammer of Wrath | 2 | A | U | 14 damage. Costs 0 if the target is below half HP | 18 | ✓ |
| Exorcism | 1 | A | U | 8 damage; 16 against Undead, Spirit or Demon | 11 / 22 | |
| Hand of Protection | 1 | S | U | 12 block. Exhaust | 16 | ✓ |
| Shield Bash | 1 | A | U | 5 damage. 5 block. +1 HoPo | 7 / 7 | ✓ |
| Beacon | 1 | P | U | Healing above max HP becomes block | cost 0 | |
| Divine Plea | 1 | S | U | +2 HoPo. Exhaust | +3 | ✓ |
| Sacred Duty | 2 | S | U | 10 block. Block is not removed at the start of your next turn | 14 | |
| Aura of Light | 1 | P | U | At the start of your turn, gain 3 block | 5 | ✓ |
| Wake of Ashes | 2 | A | R | 12 damage to ALL. +3 HoPo. Exhaust | 16 | ✓ |
| Execution Sentence | 1 | S | R | At the start of your next turn, the target takes 12 +5 per HoPo you have | 15 / +6 | |
| Lay on Hands | 2 | S | R | Heal 20. Exhaust | 30 | |
| Divine Shield | 2 | S | R | Intangible 2. Exhaust | cost 1 | ✓ |
| Aegis | 2 | P | R | Block is never removed at the start of your turn | cost 1 | |
| Final Verdict | 2 | A | R | Spend all HoPo: 10 damage +8 per | 12 / +10 | |
| Ashen Hallow | 2 | P | R | Whenever you spend HoPo, deal 3 damage to ALL per point | 4 | |
| Crusade | 2 | P | R | Whenever an enemy dies, gain 2 Strength and 2 Dexterity | cost 1 | |
| Divine Intervention | 1 | S | R | Innate. If you would die this fight, heal to 30% instead. Exhaust | Retain | |
| Sanctified Ground | 1 | P | R | At the start of your turn, +1 HoPo | +2 | |

### 4.2 Tracker — the Warden of the Wild

**HP 70.** A second body on the field, damage that stacks up over a turn, and traps
that punish enemies for acting. Medium draw, good sustain through Poison and block.

**Companion:** chosen at run start; no HP; stands beside the Seeker with its own
intent badge. **Acts at the end of your turn.** States: *Stunned* (skips its next
action; some enemy moves cause it), *Enraged* (+3 damage on its next action).
Card effects: "Companion acts now", "Enrage".

| Companion | Action at end of turn | Unlock |
|---|---|---|
| Wolf | Bite: 5 damage to a random enemy | default |
| Bear | Guard: hero gains 5 block | 80 Lore |
| Hawk | Peck: 2 damage and Mark 1 to a random enemy | 80 Lore |
| Serpent | Venom: 3 Poison to a random enemy | 80 Lore |
| Boar | Gore: 8 damage to a random enemy every other turn | 120 Lore |

**Mark X:** attacks against the marked enemy deal +3; each hit consumes 1 Mark.
Multi-hit cards eat Marks fast; that is the Marksman rhythm.

**Trap:** a Skill with **Armed**. Playing it arms it (max 2 armed; playing a third
replaces the oldest). A trap fires once on its trigger: `enemyAttack` (an enemy
attacks the hero), `enemyBuff`, or `enemyTurnStart`. Armed traps show as icons under
the hero and clear at fight end.

**Archetypes.** *Beastmaster*: Companion acts more and harder. *Marksman*: Marks and
multi-hit. *Survivalist*: traps, Poison, block while you wait.

**Starter deck (10):** Arrow ×4, Brace ×4, Hunter's Mark, Sic 'Em. **Starter relic:**
Bone Whistle (your Companion is with you; it acts at the end of your turn).

**Origins:** *Beastmaster* (default): Wolf, deck as above. *Marksman*: Hawk; swap two
Arrows for Aimed Shot and Tracking. *Survivalist*: Serpent; swap an Arrow and a Brace
for Snake Trap and Camouflage; relic → Bone Whistle (Worn): Companion also acts on
turn 1 before you draw.

| Name | Cost | Type | Rarity | Effect | Upgrade | 1st |
|---|---|---|---|---|---|---|
| Arrow | 1 | A | Starter | 6 damage | 9 | ✓ |
| Brace | 1 | S | Starter | 5 block | 8 | ✓ |
| Hunter's Mark | 1 | S | Starter | Mark 3 | cost 0 | ✓ |
| Sic 'Em | 1 | S | Starter | Companion acts now | cost 0 | ✓ |
| Steady Shot | 1 | A | C | 6 damage. Draw 1 | 8 | ✓ |
| Multi-Shot | 1 | A | C | 4 damage to ALL | 6 | ✓ |
| Rapid Fire | 1 | A | C | 3 damage ×3 | 4 ×3 | ✓ |
| Serpent Sting | 1 | A | C | 4 damage. Apply 3 Poison | 4 / 5 | ✓ |
| Raptor Strike | 1 | A | C | 9 damage | 12 | ✓ |
| Wing Clip | 1 | A | C | 5 damage. Apply 1 Weak | 7 / 2 | ✓ |
| Concussive Shot | 1 | A | C | 6 damage. Apply 1 Frail | 8 / 2 | |
| Disengage | 0 | S | C | 4 block. Draw 1 | 6 | ✓ |
| Camouflage | 1 | S | C | 7 block. +4 if you played no Attack this turn | 10 / +5 | ✓ |
| Tracking | 0 | S | C | Mark 1. Draw 1 | Mark 2 | ✓ |
| Snake Trap | 1 | S | C | Armed: when an enemy attacks you, apply 4 Poison to it | 6 | ✓ |
| Tar Trap | 1 | S | C | Armed: when an enemy attacks you, apply 2 Weak to it | 3 | ✓ |
| Feed | 1 | S | C | Companion +2 damage this fight | +3 | ✓ |
| Fetch | 1 | S | C | Draw 2. Exhaust | no Exhaust | |
| Flare | 1 | S | C | Apply 1 Vulnerable to ALL | 2 | ✓ |
| Aimed Shot | 2 | A | U | 14 damage | 18 | ✓ |
| Arcane Shot | 1 | A | U | 8 damage. If the target is Marked, draw 1 | 11 | ✓ |
| Chimera Shot | 1 | A | U | 7 damage. If the target is Marked, apply 2 Weak and 2 Vulnerable | 10 | |
| Kill Command | 1 | S | U | Companion acts now with +4 damage | +7 | ✓ |
| Bestial Wrath | 1 | P | U | Companion also acts at the start of your turn | + Enraged each turn | ✓ |
| Intimidation | 1 | S | U | Companion acts now; its target gains 2 Weak | 3 | |
| Explosive Trap | 1 | S | U | Armed: when an enemy attacks you, 8 damage to ALL | 12 | ✓ |
| Freezing Trap | 2 | S | U | Armed: when an enemy attacks you, that attack deals 0 | cost 1 | ✓ |
| Trueshot | 1 | P | U | Attacks against Marked enemies deal +2 more | +4 | ✓ |
| Marked for Death | 1 | P | U | At the start of your turn, Mark 1 on ALL | 2 | |
| Viper's Kiss | 1 | P | U | Poison you apply is increased by 1 | 2 | ✓ |
| Aspect of the Hawk | 2 | P | U | Draw 1 extra card each turn | cost 1 | ✓ |
| Aspect of the Turtle | 1 | P | U | Gain 1 Dexterity | 2 | |
| Volley | 2 | A | U | 2 damage ×6 to random enemies | ×8 | ✓ |
| Trap Mastery | 1 | S | U | Your armed traps fire now. Exhaust | no Exhaust | |
| Mend | 1 | S | U | Heal 5. Companion loses Stun. Exhaust | 8 | |
| Growl | 1 | S | U | 6 block. Enrage your Companion | 9 | ✓ |
| Scatter Shot | 2 | A | U | 3 damage to ALL ×2 | ×3 | |
| Kill Shot | 1 | A | R | 20 damage. Only playable on a target below half HP | 28 | ✓ |
| Barrage | X | A | R | 5 damage ×X to random enemies | 6 | |
| Call of the Wild | 2 | S | R | Gain a second, random Companion this fight. Exhaust | cost 1 | |
| Steel Trap | 1 | S | R | Armed: when an enemy attacks you, 15 damage to it | 22 | ✓ |
| Feign Death | 1 | S | R | Intangible 1. Exhaust | cost 0 | |
| Alpha | 2 | P | R | Companion acts twice each time it acts | cost 1 | |
| Explosive Shot | 2 | A | R | 10 damage to ALL. Exhaust | 14 | |
| Predator | 1 | P | R | Whenever an enemy dies, Enrage your Companion and draw 2 | 3 | |
| Ambush | 1 | S | R | Next turn, your first Attack deals triple damage. Exhaust | Retain | |

### 4.3 Mage — the Arcanist

**HP 65.** Glass cannon with the most card draw and three schools that each want a
different deck. Everything is tagged **Arcane**, **Fire** or **Frost** and cards care
about the tags.

**Arcane Charges:** 0–4 gems. Arcane cards that say "+1 Charge" add one; cards scale
"+N per Charge"; Barrage-type cards consume all. Clear at fight end.
**Burn** and **Chill/Frozen** as in §3. Widget: four gems in a row; the portrait
frame tints by the school of the last card played.

**Archetypes.** *Pyromancer*: stack Burn, then Combustion. *Cryomancer*: Chill until
Frozen, then Shatter. *Arcanist*: draw and energy, Charges scaling.

**Starter deck (10):** Arcane Bolt ×3, Ice Barrier ×4, Scorch, Frostbolt, Arcane
Intellect. **Starter relic:** Runed Focus (start each fight with 1 Charge).

**Origins:** *Arcanist* (default). *Pyromancer*: swap two Arcane Bolts for Scorch
and Fire Blast; relic → Ember Focus (Burn you apply +1). *Cryomancer*: swap two
Arcane Bolts for Frostbolt and Frost Nova; relic → Rime Focus (Chill you apply +1).

| Name | Cost | Type | Rarity | School | Effect | Upgrade | 1st |
|---|---|---|---|---|---|---|---|
| Arcane Bolt | 1 | A | Starter | Arcane | 5 damage | 8 | ✓ |
| Ice Barrier | 1 | S | Starter | Frost | 5 block | 8 | ✓ |
| Scorch | 1 | A | Starter | Fire | 5 damage. Apply 2 Burn | 7 / 3 | ✓ |
| Frostbolt | 1 | A | Starter | Frost | 4 damage. Apply 2 Chill | 6 / 3 | ✓ |
| Arcane Intellect | 1 | S | Starter | Arcane | Draw 2 | 3 | ✓ |
| Fire Blast | 0 | A | C | Fire | 4 damage. Exhaust | no Exhaust | ✓ |
| Fireball | 2 | A | C | Fire | 10 damage. Apply 3 Burn | 14 / 4 | ✓ |
| Frost Nova | 1 | S | C | Frost | Apply 2 Chill to ALL | 3 | ✓ |
| Ice Lance | 1 | A | C | Frost | 4 damage; ×3 if the target is Chilled | 5 | ✓ |
| Arcane Missiles | 1 | A | C | Arcane | 3 damage ×3 to random enemies. +1 Charge | 4 ×3 | ✓ |
| Arcane Blast | 1 | A | C | Arcane | 6 damage +2 per Charge. +1 Charge | 8 / +3 | ✓ |
| Arcane Explosion | 1 | A | C | Arcane | 5 damage to ALL. +1 Charge | 7 | ✓ |
| Mana Shield | 1 | S | C | Arcane | 6 block +2 per Charge | 8 / +3 | ✓ |
| Blink | 1 | S | C | Arcane | 5 block. Draw 1 | 8 | ✓ |
| Flamestrike | 2 | A | C | Fire | 7 damage to ALL. Apply 1 Burn to ALL | 10 / 2 | ✓ |
| Cone of Cold | 2 | A | C | Frost | 7 damage to ALL. Apply 2 Chill to ALL | 10 / 3 | |
| Slow | 1 | S | C | Arcane | Apply 2 Weak | 3 | ✓ |
| Frost Armor | 1 | P | C | Frost | Whenever an enemy attacks you, it gains 1 Chill | 2 | ✓ |
| Conjure | 0 | S | C | Arcane | Gain 1 energy. Exhaust | + draw 1 | |
| Ignite | 1 | P | C | Fire | Whenever you play a Fire Attack, apply 1 Burn | 2 | ✓ |
| Living Bomb | 1 | S | U | Fire | Apply 4 Burn. When the target dies, 10 damage to ALL others | 6 / 14 | ✓ |
| Combustion | 1 | S | U | Fire | Remove the target's Burn: deal 3× that much damage | 4× | ✓ |
| Pyroblast | 3 | A | U | Fire | 28 damage | 36 | ✓ |
| Dragon's Breath | 2 | A | U | Fire | 8 damage to ALL. Apply 1 Weak to ALL | 11 | |
| Hot Streak | 1 | P | U | Fire | Every third Fire Attack each turn deals double | every second | |
| Blizzard | 2 | P | U | Frost | At the start of your turn, 4 damage and 1 Chill to ALL | 6 | ✓ |
| Shatter | 1 | A | U | Frost | Damage equal to 3× the target's Chill; ×5 if Frozen | 4× / 6× | ✓ |
| Cold Snap | 1 | S | U | Frost | Double the target's Chill | cost 0 | |
| Glacial Spike | 2 | A | U | Frost | 18 damage; 30 if the target is Frozen | 24 / 40 | ✓ |
| Ice Block | 2 | S | U | Frost | Next turn, take no damage. Exhaust | cost 1 | |
| Frozen Orb | 1 | P | U | Frost | At the start of your turn, 1 Chill to ALL | 2 | ✓ |
| Arcane Barrage | 1 | A | U | Arcane | 4 damage to ALL +4 per Charge. Consume all Charges | 5 / +5 | ✓ |
| Evocation | 1 | S | U | Arcane | Gain 2 energy. Draw 2. Exhaust | +1 Charge | ✓ |
| Presence of Mind | 0 | S | U | Arcane | Your next card this turn costs 0. Exhaust | + draw 1 | |
| Mirror Image | 2 | S | U | Arcane | Images 2 | 3 | ✓ |
| Counterspell | 1 | S | U | Arcane | Armed: the next time an enemy would buff itself, it doesn't. Exhaust | + it takes 8 | |
| Spellsteal | 1 | S | U | Arcane | Remove the target's Strength; gain that much. Exhaust | + Dexterity | |
| Rune of Power | 1 | P | U | Arcane | At the start of your turn, +1 Charge | +2 | ✓ |
| Arcane Familiar | 1 | P | U | Arcane | At end of turn, 3 damage to a random enemy | 5 | |
| Clearcasting | 1 | P | U | Arcane | The first Arcane card each turn costs 0 | first two | |
| Frostfire Bolt | 1 | A | U | Fire/Frost | 7 damage. Apply 1 Burn and 1 Chill | 10 / 2 / 2 | ✓ |
| Mana Gem | 0 | S | U | Arcane | Retain. Gain 1 energy. Exhaust | + draw 1 | |
| Meteor | 3 | A | R | Fire | 26 damage to ALL. Apply 3 Burn to ALL. Exhaust | 34 | ✓ |
| Polymorph | 2 | S | R | Arcane | A non-boss enemy's next action becomes nothing. Exhaust | cost 1 | |
| Time Warp | 2 | S | R | Arcane | This turn, your hand is not discarded. Exhaust | cost 1 | |
| Alter Time | 1 | S | R | Arcane | At the start of your next turn, heal the damage you took this turn. Exhaust | Retain | |
| Archmage's Insight | 2 | P | R | Arcane | Whenever you gain a Charge, draw 1 | cost 1 | |
| Deep Freeze | 2 | S | R | Frost | Apply 5 Chill. Exhaust | cost 1 | ✓ |
| Phoenix Flames | 1 | A | R | Fire | 3 damage and 1 Burn to a random enemy, ×3 | ×5 | |
| Cauterize | 0 | S | R | Fire | Heal 8. You gain 3 Burn. Exhaust | 12 | |

### 4.4 Neutral cards

Colourless, any class. Rewards weight them lower than class cards (§7).

| Name | Cost | Type | Rarity | Effect | Upgrade | 1st |
|---|---|---|---|---|---|---|
| Quick Jab | 0 | A | C | 3 damage | 5 | ✓ |
| Sidestep | 0 | S | C | 3 block | 5 | ✓ |
| Bandages | 1 | S | C | Heal 4. Exhaust | 6 | ✓ |
| Trip | 1 | S | C | Apply 2 Vulnerable | 3 | ✓ |
| Deep Breath | 0 | S | C | Shuffle your discard into your draw pile. Draw 1 | Draw 2 | |
| Second Look | 1 | S | C | Draw 2, then discard 1 | Draw 3 | ✓ |
| Grit | 1 | S | C | 6 block; 10 if below half HP | 8 / 13 | ✓ |
| Finishing Blow | 1 | A | C | 8 damage; 16 if the target is below 30% HP | 10 / 20 | ✓ |
| Flurry | 1 | A | C | 4 damage ×2 | 5 ×2 | |
| Torch | 1 | A | C | 6 damage. Apply 1 Burn | 8 / 2 | |
| Snowball | 1 | A | C | 5 damage. Apply 1 Chill | 7 / 2 | |
| Whetstone | 1 | S | C | Gain 2 Strength this turn | 3 | ✓ |
| Smelling Salts | 1 | S | C | Remove Weak, Frail and Vulnerable from you | cost 0 | |
| Bookmark | 0 | S | U | Retain. Draw 1. Exhaust | Draw 2 | |
| Reshuffle | 1 | S | U | Discard your hand; draw that many | cost 0 | |
| Focus | 1 | S | U | Gain 2 energy. Exhaust | cost 0 | |
| Study | 1 | S | U | Choose 1 of 3 random Secrets from your Tome; add it to your hand, it costs 0 this turn. Exhaust | cost 0 | |
| Iron Will | 2 | P | U | Gain 1 Dexterity | cost 1 | |
| Battle Cry | 1 | P | U | Gain 1 Strength | cost 0 | |
| Guarded Stance | 1 | P | U | Gain 2 block whenever you play an Attack | 3 | |
| Inscribe | 2 | S | R | Upgrade every card in your hand for this fight. Exhaust | cost 1 | |
| Second Chance | 1 | S | R | Return a card from your exhaust pile to your hand. Exhaust | cost 0 | |
| Seeker's Resolve | 1 | P | R | At the start of your turn, if you have no block, gain 5 | 7 | |
| Ink Bomb | 2 | A | R | 12 damage to ALL. Add a Smudge to your discard | 16 | |

**Curses** (Unplayable unless stated; stay in the deck): Doubt (at end of turn, gain 1
Weak), Clumsy (Ethereal; at end of turn take 2), Injury (nothing; it clogs), Debt
(lose 5 gold at the start of each fight), Pride (Retain; at end of turn take 2 if it
is still in hand), Redlined (when drawn, exhaust a random card from your hand).

**Status cards** (added by enemies; removed at fight end): Torn Page (Unplayable,
Ethereal), Smudge (Unplayable; when drawn, take 1), Dazed (Unplayable, Ethereal, costs
nothing but fills the hand), Ink Stain (costs 1: Exhaust it).

## 5. Secrets

- Every enemy has exactly one Secret, a colourless card with a distinct "stolen" frame
  and the enemy's art in the art slot. Rarity **Secret**.
- **First kill** of an enemy type writes its Bestiary page (art, artist, moves, its
  Secret). This is the persistent part.
- **Rewards:** after a fight that contained an enemy whose page is written, its Secret
  has a 35% chance to be one of the three reward cards; after an elite or boss, that
  enemy's Secret is always one of the three.
- Secrets never appear in the Merchant. `Study` and `Encyclopaedia` reach into the Tome.
- Elite Secrets are Uncommon-strength; boss Secrets are Rare-strength. All are listed
  with their enemy in §6.

## 6. Enemies

Rules for every enemy: 2–4 moves, a pattern a player can learn in one fight, one
gimmick, a tag set, a size class (S 400², M 600², L 700×640), a Secret, and an artist
credit. HP is a range rolled from `rng.encounters`. Elites have a phase. Bosses have
two or three phases and a signature move that is their Secret.

**Chapter themes are placeholders for Paul's story:** Chapter 1 *The Moss Halls* (a
library swallowed by forest), Chapter 2 *The Drowned Stacks* (a flooded archive),
Chapter 3 *The Binding* (inside the Tome itself: ink, glyphs, clockwork).

Move notation: `Name (damage)`, `×n` hits, statuses by name. Patterns: **cycle**
A→B→C→A; **weighted** with no move twice in a row unless noted; **phase** at an HP
threshold.

### 6.1 Chapter 1: The Moss Halls

| Enemy | Size | Tags | HP | Moves and pattern | Gimmick | Secret |
|---|---|---|---|---|---|---|
| Ink Slime | S | Ooze | 28–32 | Splat (5) · Smear (3 + 1 Weak) · weighted | Below half HP: **Divide** into two Inklings with its current HP | **Ink Splash** 1 S: 3 damage to ALL, apply 1 Weak to ALL |
| Page Wisp | S | Spirit | 12–15 | Flicker (3) · Fade (4 block) · Swarm (3 ×2, only if 2+ Wisps alive) · weighted | Always in threes | **Wisp Light** 0 S: 3 block. Draw 1. Exhaust |
| Mossback Beetle | M | Beast | 40–46 | Shell (8 block) · Bite (7) · Molt (remove its debuffs, 3 Plated Armor) · cycle | Slow and armoured | **Shell Up** 1 S: 8 block. 1 Plated Armor |
| Feral Cur | S | Beast | 22–26 | Bite (6) · Howl (+2 Strength to all Curs) · Lunge (9, only after a Howl) · weighted | Comes in twos; Howl escalates | **Howl** 1 S: Gain 2 Strength this turn |
| Bramble Sprite | S | Spirit, Plant | 30–34 | Thorn Whip (4 ×2) · Root (2 Frail) · Grow (+2 Strength) · cycle | Punishes slow kills | **Thorncoat** 1 P: 2 Thorns |
| Bandit Scribe | M | Humanoid | 44–48 | Quill Stab (8) · Pickpocket (steal 15 gold, returned on kill) · Scribble (add a Smudge to your discard) · weighted | Gold pressure | **Pickpocket** 0 A: 4 damage. Gain 8 gold. Exhaust |
| Hollow Knight | L | Undead, Construct | 60–66 | Guard (10 block) · Slam (11) · Slam · Rally (+3 Strength, once) · cycle | Telegraphed and heavy | **Iron Guard** 2 S: 14 block |
| Gremlin Binder | S | Humanoid | 30–34 | Staple (5 + 1 Vulnerable) · Bind (you draw 1 less next turn) · Shriek (1 Weak) · weighted | Arrives with Wisps or Curs | **Staple** 1 A: 6 damage. Apply 1 Vulnerable |
| Thornwood Sapling | M | Plant | 50–56 | Lash (5) · Sap (heal 6) · Creeping Roots (2 Frail) · weighted | Ritual 1: grows every turn | **Sap** 1 S: Heal 5. Exhaust |

| Elite | Size | Tags | HP | Moves | Secret |
|---|---|---|---|---|---|
| The Librarian's Shade | L | Spirit, Undead | 100–110 | Shush (12) · Reshelve (shuffle 2 Torn Pages into your draw pile) · cycle. **Phase <50%:** Overdue (18) every other turn | **Reshelve** 1 S: Put a card from your discard pile into your hand |
| Ogre Bookkeeper | L | Humanoid | 120–130 | Ledger Slam (14) · Count (+3 Strength, 10 block) · Tally (8 ×2) · cycle | **Ledger Slam** 2 A: 14 damage. Costs 1 less per 100 gold you hold |
| Wasp Queen + 2 Drones | M + S | Beast | 80 / 14 | Queen: Sting (4 + 2 Poison) · Lay (summon a Drone, max 3) · Command (Drones act twice). Drones: Sting (3 + 1 Poison) | **Venom Sting** 1 A: 4 damage. Apply 3 Poison |

| Boss | HP | Moves | Secret |
|---|---|---|---|
| The Bookwyrm | 250 | Devour (16; add a Torn Page to your discard) · Paper Storm (5 ×3) · Inhale (12 block; next move is Breath) · Breath (24 + 2 Burn). **Phase <50%:** Molt (remove its debuffs, +3 Strength) then resumes | **Paper Storm** 1 A: 4 damage ×3 to random enemies |
| The Ink Colossus | 260 | Ritual 2. Crush (12) · Spill (summon an Ink Slime, max 2) · Drown (2 Weak, 2 Frail). **Phase <50%:** Deluge (8 to you; every Slime explodes for 6) | **Inkflood** 2 S: Apply 2 Weak and 2 Frail to ALL |
| The Mad Cartographer | 240 | Compass Stab (13) · Fold (18 block) · Lost (add 2 Dazed to your hand) · every other turn his intent is hidden. **Phase <50%:** Ink Trap (Stun your Companion / you lose 1 energy next turn) | **Fold Space** 1 S: This turn your hand is not discarded. Exhaust |

**Encounter pools.** Easy (floors 1–3): Ink Slime; Page Wisp ×3; Feral Cur ×2; Bramble
Sprite. Normal: Mossback Beetle; Bandit Scribe; Hollow Knight; Gremlin Binder + Wisp
×2; Gremlin Binder + Feral Cur; Thornwood Sapling; Ink Slime ×2; Feral Cur ×3;
Bramble Sprite + Page Wisp ×2. Elite: the three above. Boss: one of the three.

### 6.2 Chapter 2: The Drowned Stacks

| Enemy | Size | Tags | HP | Moves and pattern | Gimmick | Secret |
|---|---|---|---|---|---|---|
| Drowned Scribe | M | Undead, Humanoid | 48–54 | Waterlogged Swing (9) · Gurgle (4 + 1 Weak) · Regurgitate (heal 8) · cycle | Regen 2 | **Second Wind** 1 S: Heal 6. Exhaust |
| Lantern Eel | S | Beast | 34–38 | Shock (7) · Glow (3 + 1 Vulnerable) · Coil (8 block) · weighted | Fast, in pairs | **Static** 1 A: 7 damage. Apply 1 Vulnerable |
| Barnacle Golem | L | Construct | 80–88 | Slam (14) · Encrust (4 Plated Armor) · cycle. **<50%:** Crumble (loses armour, +3 Strength) | Armour that breaks | **Encrust** 1 S: Gain 3 Plated Armor |
| Siren | M | Spirit, Humanoid | 44–50 | Lure (11) · Song (you have 1 less energy next turn) · Wail (5 ×2) · weighted | Songs stack | **Siren's Song** 1 S: Apply 2 Weak. Draw 1 |
| Fog Lurker | M | Beast | 52–58 | Ambush (13) · Slink (10 block) · Grab (6 + 1 Frail) · weighted | **Intent hidden** until it acts | **Ambush** 1 A: 13 damage. Playable only as the first card of your turn |
| Crab Hulk | L | Beast | 70–76 | Pinch (6 ×2) · Shell (12 block) · cycle | Whenever it takes 10+ damage in a turn, +2 Strength | **Pinch** 1 A: 5 damage ×2 |
| Ghost Scholar | S | Spirit | 30–34 | Haunt (4; add a Torn Page) · Lecture (2 Weak) · Whisper (2 Frail) · weighted | In pairs | **Haunting Whisper** 0 S: Apply 1 Weak. Draw 1 |
| Chained Reader | M | Humanoid | 56–62 | Yank (8; Stuns your Companion / 1 Vulnerable) · Rend (10) · cycle. **<50%:** Break Chains (+4 Strength, moves become Rend, Rend, Yank) | Two tempos | **Break Chains** 1 S: Remove your debuffs. Gain 2 Strength. Exhaust |
| Rotwood Wight | M | Undead, Plant | 58–64 | Spores (3 Poison to you) · Claw (9) · Rot (2 + 2 Frail) · weighted | Poison pressure | **Spore Cloud** 1 S: Apply 3 Poison to ALL |

| Elite | Size | Tags | HP | Moves | Secret |
|---|---|---|---|---|---|
| Tide Warden | L | Construct | 150–160 | Wave (8 ×2) · Bulwark (15 block) · Undertow (you draw 1 less next turn) · cycle. **<50%:** Riptide (24) every other turn | **Riptide** 2 A: 20 damage. Apply 2 Chill to yourself |
| The Drowned Choir | M ×3 | Spirit | 45 each | Three Sirens; each Song stacks; killing one silences the next Song | **Chorus** 1 S: Apply 1 Weak to ALL. Draw 2 |
| Leviathan Spawn | L | Beast | 170 | Bite (16) · Thrash (5 ×3) · Submerge (20 block, 1 Artifact) · cycle. **<40%:** Frenzy (7 ×3) | **Thrash** 1 A: 4 damage ×3 |

| Boss | HP | Moves | Secret |
|---|---|---|---|
| The Drowned Archivist | 300 | Flood (10 + 2 Chill to you) · Catalogue (add 2 Smudges) · Slam (18) · cycle. **<50%:** Undertow: at the start of your turn discard 2 random cards, every other turn | **Catalogue** 1 S: Draw 3. Add a Smudge to your discard |
| The Deep Reader | 320 | Foretell (takes the top card of your draw pile until fight end) · Gaze (14) · Crush (22) · cycle. **<50%:** Recite (plays a copy of a stolen card against you) | **Foretell** 1 S: Look at the top 3 cards of your draw pile; put one in your hand |
| Kraken's Eye + 2 Tentacles | 280 / 40 | Eye: Stare (2 Vulnerable) · Constrict (20). Tentacles: Slap (9); regrow after 2 turns. **<50%:** Ink Cloud (add 2 Dazed) | **Constrict** 2 A: 18 damage. Apply 2 Weak |

**Pools.** Easy: Lantern Eel ×2; Ghost Scholar ×2; Drowned Scribe. Normal: Barnacle
Golem; Siren + Lantern Eel; Fog Lurker; Crab Hulk; Chained Reader; Rotwood Wight;
Drowned Scribe ×2; Siren ×2; Ghost Scholar ×3. Elites and bosses as above.

### 6.3 Chapter 3: The Binding

| Enemy | Size | Tags | HP | Moves and pattern | Gimmick | Secret |
|---|---|---|---|---|---|---|
| Glyph Golem | L | Construct | 90–100 | Slam (16) · Inscribe (+3 Strength) · Ward (15 block) · cycle | Artifact 2 | **Ward Glyph** 1 S: Gain 1 Artifact. Exhaust |
| Mirror Page | M | Spirit | 60–66 | Reflect (next turn, deals the damage of your last Attack back at you; shown as a number) · Cut (8) · cycle | Punishes big hits | **Reflect** 1 S: 6 block. If an enemy attacks you this turn, it takes 8. Exhaust |
| Void Moth | S | Spirit | 36–40 | Dust (exhausts a random card from your hand) · Bite (6) · Flutter (6 block) · weighted | In pairs; deck erosion | **Consume** 0 S: Exhaust a card in your hand; gain energy equal to its cost |
| Candle Wraith | M | Undead | 64–70 | Flare (10 + 2 Burn to you) · Gutter (heal 10) · Blaze (4 ×3) · cycle | Burns you | **Wick** 1 P: At end of turn, 2 Burn to a random enemy |
| Inkblot Horror | L | Ooze | 100–110 | Consume (12; add a Torn Page) · Spread (summon an Inkling, max 2) · Blot (2 Weak, 2 Frail) · weighted | Summons | **Blot Out** 2 S: Apply 2 Weak, 2 Frail and 2 Vulnerable |
| Automaton Scribe | M | Construct | 70–76 | Dictate (add 2 Smudges) · Punch (11) · Rewind (repeats its last move) · weighted | Doubles up | **Rewind** 1 S: Return the last card you played this turn to your hand. Exhaust |
| Bound Demon | L | Demon | 110–120 | Claw (9; 18 once Unbound) · Roar (+2 Strength) · Hellfire (12 + 2 Burn) · cycle. **Turn 3:** Unbind | Timer fight | **Unbind** 1 S: Gain 3 Strength. Take 5 damage. Exhaust |
| Time Moth | S | Spirit | 40–44 | Delay (your next card costs 1 more) · Skitter (7) · Rewind (once, heal to 50% if below) · weighted | Tempo tax | **Delay** 0 S: Apply Wait to an enemy. Exhaust |
| Marginalia Imp | S | Demon | 34–38 | Scribble (3; add a Smudge) · Giggle (+1 Strength to all Imps) · Poke (5) · weighted | In threes | **Scribble** 0 A: 3 damage. Draw 1 |

| Elite | Size | Tags | HP | Moves | Secret |
|---|---|---|---|---|---|
| The Proofreader | L | Construct, Humanoid | 200–210 | Redline (removes one of your Powers) · Strike (18) · Correct (2 Weak, 2 Frail) · cycle. **<50%:** Final Draft (30) every other turn | **Redline** 1 S: Remove all buffs from an enemy. Exhaust |
| The Ironbound | L | Construct, Demon | 220 | Bound: Guard (20 block) · Strain (12) · cycle. **<50% Unbound:** Slam (25) · Rampage (8 ×3) · cycle | **Rampage** 2 A: 7 damage ×3 |
| Spellthief | M | Humanoid | 190 | Steal (takes a random card from your hand until fight end) · Zap (12) · Blink (12 block; next intent hidden) · weighted. **<50%:** plays a stolen card against you each turn | **Spellsteal** (elite version) 1 S: Copy a random card from your discard into your hand; it costs 0 this turn. Exhaust |

| Boss | HP | Moves | Secret |
|---|---|---|---|
| The Binder | 400 | Bind (a random card in your hand becomes Bound) · Clasp (22) · Press (12 ×2) · cycle. **<50%:** Seal (you have 1 less energy next turn) · Crush (30) | **Bind** 1 S: An enemy's next attack is negated. Exhaust |
| The Blank Page | 380 | Mirror: each turn plays a copy of a random card from your deck against you, using its numbers · Erase (20). **<50%:** plays two | **Blank Page** 1 S: Copy the last Secret you played this fight into your hand. Exhaust |
| The Author | 450 | Plot Twist (add a Curse to your draw pile) · Edit (remove your Strength and Dexterity) · Chapter Break (26) · cycle. **<60%:** Cliffhanger (10 ×3). **<25%:** The End: 40 damage in two turns, shown as a countdown | **Plot Twist** 2 S: Add a random upgraded Rare card of your class to your hand. Exhaust |

**Pools.** Easy: Marginalia Imp ×3; Void Moth ×2; Time Moth. Normal: Glyph Golem;
Mirror Page; Candle Wraith; Inkblot Horror; Automaton Scribe; Bound Demon; Time Moth
+ Void Moth; Candle Wraith + Marginalia Imp ×2; Mirror Page + Time Moth.

### 6.4 Intent scripting

```json
{
  "id": "hollow-knight",
  "name": "Hollow Knight",
  "size": "large",
  "tags": ["undead", "construct"],
  "hp": [60, 66],
  "artist": "placeholder",
  "secret": "iron-guard",
  "moves": {
    "guard": { "intent": "defend", "effects": [{ "do": "block", "amount": 10, "target": "self" }] },
    "slam":  { "intent": "attack", "effects": [{ "do": "damage", "amount": 11, "target": "hero" }] },
    "rally": { "intent": "buff",   "effects": [{ "do": "status", "status": "strength", "amount": 3, "target": "self" }], "once": true }
  },
  "pattern": { "type": "cycle", "moves": ["guard", "slam", "slam", "rally"] }
}
```

Patterns: `cycle`, `weighted` (`{ "moves": { "bite": 50, "howl": 30, "lunge": 20 },
"noRepeat": 1, "requires": { "lunge": "howled" } }`), `phases` (`[{ "below": 0.5,
"pattern": … }]` checked at intent selection), `script` (a registered function
receiving state and rng; bosses). `once`, `every: 2`, `firstTurn`, `hidden` are per
move flags. The intent badge shows type and the exact numbers the resolution will use,
computed by the same code.

## 7. The run

### 7.1 Start

Character select in order: **class → Origin → Companion (Tracker) → Seal → Boon**.
Then a short story beat (Phase 8) and the Chapter 1 map.

### 7.2 The map

7 columns × 10 floors, boss above floor 10. Generation (from `rng.map`):

1. Draw 6 paths bottom to top; each step moves to the same, left or right column;
   paths may merge; no crossings.
2. Floor 1 is always Fight. Floor 6 is always Treasure. Floor 10 is always Camp. The
   boss is floor 11 and connects from every floor-10 node.
3. Assign the rest by weight: Fight 45, Event 22, Unknown 12, Elite 10, Merchant 6,
   Camp 5. Rules: no Elite before floor 4; no Camp on floors 1–3; never two Camps or
   two Merchants adjacent on a path; at least one Merchant on floors 4–9; at least 2
   Elites reachable; no node type three in a row on a path.
4. Unknown resolves on arrival: Event 55, Fight 25, Merchant 10, Treasure 10 (never a
   fight at Seal 0 on floors 1–3).
5. The boss node shows its portrait once the map is entered.

Chapter transitions: heal 100% after the Chapter 1 boss; 75% after Chapter 2 (Seal 5
changes this). Boss relic choice (1 of 3) after Chapters 1 and 2.

### 7.3 Rewards

| Source | Gold | Cards | Other |
|---|---|---|---|
| Fight | 10–20 | 1 of 3 | Vial 25% |
| Elite | 25–35 | 1 of 3 | Relic (Common 50 / Uncommon 35 / Rare 15); Vial 40% |
| Boss | 95–105 | 1 of 3 Rare | 1 of 3 boss relics; full heal at Chapter 1 |
| Treasure | 0 | 0 | Relic (Common 50 / Uncommon 33 / Rare 17) |

Card reward rarity: Common 60 / Uncommon 37 / Rare 3, with a +1% Rare pity per reward
without one, reset on a Rare. Elites: 50 / 40 / 10. Class cards 80% of slots, neutral
20%. Secrets per §5. **Skip** is always offered; skipping gives nothing.

### 7.4 Merchant

5 cards (4 class, 1 neutral): Common 45–55, Uncommon 68–82, Rare 135–165. 3 relics
(Common 143–157, Uncommon 238–262, Rare 285–315). 3 vials 48–100 by rarity. **Card
removal** 75, +25 each use. One sale item at 50% off. Prices ×0.8 with Mercenary's
Chit; ×1.2 at Seal 8.

### 7.5 Camp

Rest: heal 30% of max HP. Smith: upgrade one card. Relics add options (Pocket
Anvil: upgrade two; Candle Stub: +15% rest; Reading Lamp: **Study**, remove a card).

### 7.6 Vials

3 slots. Common 65 / Uncommon 25 / Rare 10 when rolled.

| Vial | Rarity | Effect |
|---|---|---|
| Ember Vial | C | 10 damage to ALL |
| Frost Vial | C | 3 Chill to ALL |
| Healing Draught | C | Heal 25% max HP |
| Ink Draught | C | Draw 3 |
| Tonic of Iron | C | 12 block |
| Venom Vial | C | 6 Poison |
| Sleeping Draught | C | 3 Weak to ALL |
| Elixir of Might | U | +2 Strength |
| Elixir of Grace | U | +2 Dexterity |
| Smoke Bomb | U | Leave a non-boss fight; no rewards |
| Ghost Ink | U | Intangible 1 |
| Vial of Secrets | R | Add a random Secret from your Tome to your hand; it costs 0 this turn |
| Distilled Lore | R | Gain 2 energy; your hand is not discarded this turn |
| Phoenix Feather | R | Held: if you would die, revive at 25% and the feather is spent |

### 7.7 Events

Dialogue scripts (§10) with choices. ~40 by Phase 7; the first 12 (★) in Phase 5.
Each is one `.dlg` file under `content/events/`.

| Event | Chapter | Choices |
|---|---|---|
| ★ A Torn Page | any | Take: random Common relic + Doubt · Leave · Pay 50 gold: relic only |
| ★ The Bookseller | any | Buy a random Rare for 75 · Take a Curse for 100 gold · Leave |
| ★ Wandering Scholar | any | Upgrade a card · Heal 15 · +40 gold |
| ★ Well of Ink | any | Transform a card · Drink: +6 max HP and Debt · Leave |
| ★ Mimic Shelf | any | Open: 50% relic, 50% fight a Mimic (elite-strength, double reward) · Leave |
| ★ Binding Ritual | any | Remove a card for 8 HP · Remove two for 16 · Leave |
| ★ Trapped Aisle | any | Push through: 12 damage, Uncommon relic · Sneak: 50% relic, 50% nothing · Leave |
| ★ Wishing Font | any | Throw 50 gold: 40% relic, 40% card, 20% nothing · Leave |
| ★ Bandit Toll | any | Pay 40 · Fight two Bandit Scribes · Hand over a card |
| ★ Campfire Tale | any | Heal 10 and gain Bookmark · Leave |
| ★ Moss Spring | 1 | Heal 30% · +3 max HP |
| ★ Beetle Nest | 1 | Fight three Beetles for two relics · Leave |
| Grave of a Seeker | any | Meta: offers a relic your last dead run held, for 20% max HP · Leave |
| Lost Student | any | Give 30 gold: meet them again at the next Merchant with 30% off · Leave |
| The Quiet Room | any | Heal to full, lose a random vial · Leave |
| Rival Seeker | any | Fight a humanoid elite for a Rare relic and 60 gold · Trade a card for one of theirs |
| The Cartographer | any | Reveal all Unknown nodes · Reroll the next floor · Leave |
| A Whispering Shelf | any | Read: write a random unwritten Bestiary page and take a Curse · Leave |
| Golden Bookmark | any | Pay 100 gold for the Golden Bookmark relic · Leave |
| Locked Drawer | any | Brass Key: two relics · Pick the lock for 30 gold, 50% · Leave |
| Sleeping Beast | any | Steal: 50% relic, 50% an elite wakes · Leave |
| Feast | any | +8 max HP and Clumsy · Leave |
| The Librarian's Debt | any | Pay all gold: upgrade three random cards · Leave |
| Fork in the Stacks | any | Next three nodes become Fights with double gold · become Events · Leave |
| Message in a Bottle | 2 | Story hook. +25 gold and a random card |
| Drowned Merchant | 2 | A three-item shop at half price |
| Chained Reader | 2 | Free the reader: +1 max energy for the next fight only, take 6 · Leave |
| Tide Pool | 2 | Heal 20 · Lose 10 gold, gain a Vial |
| The Margin | 3 | Upgrade all your starter cards · Leave |
| The Blank Shelf | 3 | Add any Secret from your Tome · Leave |
| The Last Sentence | 3 | Heal to full and take Pride · Leave |
| The Editor | 3 | Remove two cards and take Redlined · Leave |
| Candle Alcove | 3 | Remove all Curses for 25% max HP · Leave |
| Glyph Circle | 3 | Gain 1 Artifact for the rest of the run for 60 gold · Leave |

### 7.8 Run end

Victory after the Chapter 3 boss; defeat at 0 HP. The summary shows floor, cause of
death (the enemy and the move), most-played cards, damage dealt and taken, elites and
bosses killed, Secrets stolen, Lore earned (with the line items), and the seed with
"copy seed". New Bestiary pages flip open one by one.

## 8. Relics

"Ch1" marks the twenty that ship in Phase 5. Class-only relics are offered only to that
class.

| Relic | Tier | Effect | Ch1 |
|---|---|---|---|
| Sunbrand Libram | Starter (Paladin) | Start each fight with 1 Holy Power | ✓ |
| Bone Whistle | Starter (Tracker) | Your Companion is with you; it acts at the end of your turn | ✓ |
| Runed Focus | Starter (Mage) | Start each fight with 1 Arcane Charge | ✓ |
| Iron Bookmark | Common | Start each fight with 4 block | ✓ |
| Reading Glasses | Common | Elites and bosses also show their next-but-one intent | ✓ |
| Inkwell | Common | Draw 1 extra card at the start of each fight | ✓ |
| Quill of Haste | Common | Gain 1 energy on the first turn of each fight | ✓ |
| Lucky Coin | Common | +25% gold from fights | ✓ |
| Whetstone | Common | On pickup, upgrade two random Attacks | ✓ |
| Candle Stub | Common | Rest heals 15% more | ✓ |
| Salt Circle | Common | Start each fight with 1 Artifact | ✓ |
| Vial Belt | Common | +1 vial slot | ✓ |
| Preserved Heart | Common | +7 max HP | ✓ |
| Ledger | Common | +5 gold after each fight | ✓ |
| Warding Charm | Common | The first attack against you each fight deals half | ✓ |
| Brass Key | Common | Treasure offers two relics, choose one; opens Locked Drawers | |
| Pocket Anvil | Common | Smith upgrades two cards | ✓ |
| Compass | Common | Unknown nodes are shown | |
| Dried Ink | Common | Status cards are exhausted when drawn | ✓ |
| Woolen Cloak | Common | Weak and Frail on you last one turn less | |
| Traveler's Boots | Common | Unknown nodes are never fights | |
| Snack Tin | Common | Heal 6 after each fight | ✓ |
| Hourglass | Uncommon | Retain one card each turn (your choice) | ✓ |
| Bell of Warning | Uncommon | Elites start each fight with 2 Vulnerable | |
| Thornvine Bracers | Uncommon | 3 Thorns | ✓ |
| Battle Standard | Uncommon | Start each fight with 1 Strength | ✓ |
| Ironwood Ring | Uncommon | Start each fight with 1 Dexterity | |
| Mercenary's Chit | Uncommon | Merchant prices −20% | ✓ |
| Chronicle | Uncommon | From turn 5 of a fight, +1 energy each turn | |
| Ash Bookmark | Uncommon | Whenever you Exhaust a card, gain 3 block | |
| Sealed Letter | Uncommon | Opens on entering Chapter 3: a random Rare card and 100 gold | |
| Reading Lamp | Uncommon | Camp gains Study: remove a card | |
| Scholar's Cap | Uncommon | Powers cost 1 less | |
| Steel Toe | Uncommon | Whenever you gain 10+ block in a turn, 3 damage to ALL | |
| Ember Charm | Uncommon (Mage) | Burn you apply +1 | |
| Frost Charm | Uncommon (Mage) | Chill you apply +1 | |
| Blessed Beads | Uncommon (Paladin) | Holy Power cap is 6; spenders count it | |
| Hammer Emblem | Uncommon (Paladin) | Start each fight with 2 Holy Power | |
| Worn Leash | Uncommon (Tracker) | Companion +2 damage; it cannot be Stunned | |
| Trapper's Kit | Uncommon (Tracker) | Traps can be armed up to 3 | |
| Golden Bookmark | Rare | Draw 2 extra cards on the first turn of each fight | |
| Hero's Bracer | Rare | Whenever an enemy dies, heal 3 | |
| Phylactery | Rare | Once per run, survive a killing blow at 30% HP | ✓ |
| Crown of Pages | Rare | Secrets cost 1 less | |
| Encyclopaedia | Rare | Start each fight with a random Secret from your Tome in hand | |
| Mirror of Ink | Rare | The first Attack you play each turn that costs 2+ is played twice | |
| Runebound Gauntlet | Rare | Whenever you play 4 cards in a turn, gain 1 energy (once per turn) | |
| Cursed Tome | Boss | +1 energy each turn. Camps cannot Rest | |
| Inkheart | Boss | +1 energy each turn. Draw 1 fewer card | |
| Author's Ring | Boss | +1 energy each turn. No card rewards from normal fights | |
| Ravenous Quill | Boss | +1 energy each turn. A Debt is added to your deck | |
| Fresh Pages | Boss | Transform all Starter Attacks and Skills into random cards of your class | |
| Weaver's Loom | Boss | Cards you gain from rewards are upgraded | |
| Black Bookmark | Boss | Whenever you Exhaust a card, 3 damage to ALL | |
| Twin Quill | Boss | The first Skill you play each turn is played twice | |

## 9. Meta

### 9.1 Lore

Earned at run end, won or lost:

```
Lore = floors × 2 + elites × 8 + bosses × 20 + new Bestiary pages × 5 + (won ? 100 : 0) + (won ? Seal × 10 : 0)
```

A typical Chapter 1 death yields 25–40 Lore; a win, ~250.

### 9.2 Pages (the unlock tree)

| Page | Cost | Unlocks |
|---|---|---|
| Class card page (×6 per class) | 60 | Five cards added to that class's reward pool |
| Relic page (×5) | 60 | Four relics added to the pool |
| Boon | 40 | One Boon added to the run-start offers |
| Origin | 100 | A second or third Origin for a class |
| Companion | 80–120 | Bear, Hawk, Serpent, Boar |
| Card back | 30 | Cosmetic |
| Seal N | free | Unlocked by winning at Seal N−1 with that class |

The first run starts with: starter cards + ~20 cards per class in the pool, 12
relics, 3 Boons, the default Origins, the Wolf, Seal 0. The order of card pages is
authored so early pages contain the archetype enablers and later ones the Rares.

### 9.3 Boons

Three offered at run start from the unlocked pool. Class-only ones only for that class.

| Boon | Effect |
|---|---|
| Bright Start | +10 max HP |
| Full Purse | +120 gold |
| Rare Find | A random Rare card of your class |
| Trinket | A random Common relic |
| Lighter Pack | Remove a Starter Attack and a Starter Skill |
| Transmute | Transform two cards |
| Sharpened | Upgrade three random Starter cards |
| Stocked | Two random vials |
| Enemy Lore | Secrets are always offered in Chapter 1 |
| Blood Price | −10 max HP; a random boss relic |
| Zealot's Start | Paladin: start each fight with 2 Holy Power |
| Runic Start | Mage: start each fight with 2 Charges |
| Companion's Heart | Tracker: Companion starts each fight Enraged |

### 9.4 Seals

Cumulative. Seal N includes everything below it.

| Seal | Modifier |
|---|---|
| 1 | Elites appear more often |
| 2 | Normal enemies +10% HP |
| 3 | Elites +15% HP |
| 4 | Bosses +15% HP |
| 5 | Chapter transitions heal 50% instead of 100% / 75% |
| 6 | Start the run at 90% HP |
| 7 | Enemies deal +10% damage |
| 8 | Merchant prices +20% |
| 9 | Start with a Doubt in your deck |
| 10 | Every boss gains its Seal move (one extra move each, authored per boss) |

### 9.5 The Tome (scene)

Tabs: **Bestiary** (per chapter; silhouettes until seen; a page shows art, artist,
tags, HP, every move seen, the Secret, and the story line from Phase 8), **Cards** (by
class and neutral, seen and unseen, with a "stolen" section for Secrets), **Relics**,
**Pages** (the unlock tree with Lore balance), **Stats** (runs, wins per class and
Seal, best floor per class, fastest win, kills, most-played cards, run history),
**Credits** (every contributor, generated from `credits.json`). Profile export and
import live here too.

## 10. Dialogue script format

Plain text, one file per event or story beat, extension `.dlg`. Parsed by
`engine/dialogue`, previewed live at `#/dev/dialogue`. Designed so Paul and, later,
students write these without touching code.

```
title: A Torn Page
portrait left: seeker
portrait right: archivist mood=sly

archivist: A page, torn from something older than this place. Take it?
seeker: What's the catch?
archivist: There is always a catch.

choice:
  - Take the page                            -> take
  - Leave it                                 -> leave
  - [if gold >= 50] Buy it outright, 50 gold -> buy

@take
  > relic random common
  > curse doubt
  archivist: Wise. Foolish. Both.
  > end

@leave
  archivist: Another time, Seeker.
  > end

@buy
  > gold -50
  > relic random common
  > end
```

Grammar:

- `title:`, `portrait left|right: <id> [mood=<x>]`. `seeker` resolves to the class
  portrait; `{name}`, `{class}`, `{gold}`, `{hp}` substitute in text.
- `speaker: text` shows a line with the speaker's nameplate; a bare line continues
  the previous speaker. Blank lines are beats; `> pause 0.5` is an explicit one.
- `choice:` followed by `- label -> @label` lines; an optional `[if …]` prefix hides the
  choice. Conditions: `gold >= N`, `hp < N`, `class == tracker`, `flag <name>`,
  `relic <id>`, `seal >= N`, `chapter == N`, `page <enemy-id>`.
- `@label` starts a section. `> end` finishes the event. `> goto @label` jumps.
- Effects: `gold ±N`, `hp ±N`, `maxhp ±N`, `heal pct N`, `card add <id>|random
  <rarity> [upgraded]`, `card remove choose [N]`, `card transform choose N`, `card
  upgrade choose N|random N`, `relic <id>|random <tier>`, `curse <id>`, `vial
  <id>|random`, `fight <encounter-id> [reward:double]`, `flag set|clear <name>`, `page
  write random`, `reveal map`, `merchant discount N`, `energy next +1`, `artifact run +1`.
- Story beats are the same format with no `choice:`; `> next` advances. The runner
  emits events for the UI (`say`, `choice`, `portrait`, `effect`) exactly like combat.

## 11. Art spec

Full instructions for students go in `docs/CONTRIBUTING-ART.md`; this is the contract.

| Asset | Size (px) | Notes |
|---|---|---|
| Enemy, small | 400 × 400 | transparent PNG, feet on the baseline 40 px from the bottom, faces left |
| Enemy, medium | 600 × 600 | same |
| Enemy, large | 700 × 640 | same; enemies stand 640 px down the screen, so this is as tall as anything can be |
| Enemy extra poses | same as idle | optional `attack.png`, `hurt.png`, `dead.png`; the puppet blends to them |
| Enemy spritesheet | any | optional Aseprite export `idle.json` + png; tags `idle`, `attack`, `hurt`, `die` |
| Card art | 500 × 380 | painted, no text, no border |
| Portrait (dialogue) | 700 × 900 | bust, transparent, faces inward; optional mood variants `-angry`, `-sly`, `-sad` |
| Class portrait | 700 × 900 | as above |
| Background | 1920 × 1080 | two layers if possible: `far.png`, `near.png` for parallax |
| Relic / vial icon | 128 × 128 | transparent |

**The puppet** (what a single PNG does): idle breathe (scaleY ±2%, 2.2 s sine) and
sway (±1.5°, 3.1 s), attack (pull back 0.12 s → lunge 0.1 s toward the hero → recoil
0.25 s), hit (white flash 80 ms, 6 px shake ×3), buff (rising glow), debuff (purple
drip), death (freeze 150 ms → desaturate → dissolve downward with particles 600 ms).
Extra poses replace the base frame during attack/hurt/death when present.

`meta.json` per enemy: `{ "id", "size", "artist": "<credits id>", "notes" }`. Every
artist has an entry in `content/credits.json`: `{ "id", "name", "role", "link?" }`.
`lint:content` fails on any asset without a credit. Names appear as the student
chooses; default is first name and initial.

## 12. Content schemas

Effect language (zod in `content/schema/effect.ts`):

```ts
Amount    = number | { base: number, per: 'holyPower' | 'charge' | 'block' | 'targetBurn'
            | 'targetChill' | 'targetMark' | 'cardsInHand' | 'energy', mult: number }
Target    = 'target' | 'all' | 'random' | 'self' | 'hero' | 'companion'
Condition = { holyPowerAtLeast: n } | { targetHas: status } | { targetBelowHp: 0.5 }
          | { playedNoAttack: true } | { firstCardThisTurn: true } | { tag: 'undead' }
Effect    = { do: 'damage', amount, target, times?, tags? }
          | { do: 'block', amount, target? }
          | { do: 'status', status, amount, target }
          | { do: 'removeStatus', status | 'debuffs' | 'buffs', target }
          | { do: 'draw' | 'energy' | 'heal' | 'gold', amount }
          | { do: 'resource', name: 'holyPower' | 'charge', amount }
          | { do: 'spend', name: 'holyPower' | 'charge', then: Effect[] }   // amounts inside use per:'spent'
          | { do: 'exhaust' | 'discard', from: 'hand' | 'random', count, choose? }
          | { do: 'addCard', card, to: 'hand' | 'discard' | 'draw', upgraded? }
          | { do: 'trap', trigger: 'enemyAttack' | 'enemyBuff' | 'enemyTurnStart', effects: Effect[] }
          | { do: 'companion', action: 'act' | 'enrage' | 'unstun', bonus? }
          | { do: 'power', trigger: 'startTurn' | 'endTurn' | 'onAttackPlayed' | 'onSkillPlayed'
              | 'onExhaust' | 'onEnemyDeath' | 'onResourceGain' | 'onEnemyAttack', effects: Effect[] }
          | { do: 'if', when: Condition, then: Effect[], else?: Effect[] }
          | { do: 'script', id: string }
```

A card:

```json
{
  "id": "templars-verdict", "name": "Templar's Verdict", "class": "paladin",
  "type": "attack", "rarity": "common", "cost": 1, "target": "enemy",
  "effects": [{ "do": "spend", "name": "holyPower", "then": [
    { "do": "damage", "amount": { "base": 5, "per": "spent", "mult": 4 }, "target": "target" } ] }],
  "upgrade": { "effects": [{ "do": "spend", "name": "holyPower", "then": [
    { "do": "damage", "amount": { "base": 7, "per": "spent", "mult": 5 }, "target": "target" } ] }] },
  "keywords": [], "art": "templars-verdict", "artist": "placeholder"
}
```

Text is generated: "Spend all Holy Power: deal 5 damage, +4 per point." Numbers show
live values in hand. `text` may override the template when the generated sentence
reads badly; the test still checks every effect is mentioned. A relic is `{ id, name,
tier, class?, trigger, effects }`; a vial `{ id, name, rarity, effects }`; a boon
`{ id, name, class?, effects }`; an origin `{ id, class, name, swaps: [[out, in]],
relic }`.

## 13. Numbers to tune

Starting targets. The sim (`tools/sim.ts`) and the checkpoints move them; record
changes in `docs/balance.md`.

| Measure | Target |
|---|---|
| Run length, Seal 0 win | 25–35 min |
| Fight length | 3–5 turns normal, 6–9 elite, 8–12 boss |
| Chapter 1 boss clear, first-timer after 3 runs | 30–40% |
| Full clear, competent player, Seal 0 | 15–20% |
| Full clear, heuristic sim, Seal 0 | 5–10% (it plays badly on purpose) |
| Damage taken per normal fight | Ch1 8–14 · Ch2 14–22 · Ch3 20–30 |
| Enemy damage per turn | Ch1 6–10 · Ch2 12–18 · Ch3 18–30 |
| Hero damage per energy | Ch1 ~6 · Ch3 ~12 with Strength and upgrades |
| Card pick rate | no card < 2% or > 40% when offered |
| Win rate when picked | no card > 70% |
| Deck size at Chapter 3 | 22–30 cards |
| Secrets in a winning deck | 1–3 |
| Seal 3 full clear | half of Seal 0's rate · Seal 10: a fifth |

**Chapter HP bands:** normals Ch1 25–66, Ch2 30–88, Ch3 34–120; elites 100–130,
150–170, 190–220; bosses 240–260, 280–320, 380–450.
