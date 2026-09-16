import { spawnEnemy } from '../effects';
import { registerScript } from './index';

/**
 * split: the acting enemy divides into two copies of its minion form, each
 * with its current HP, and is removed. The Ink Slime's Divide.
 */
registerScript('split', (state, content, ctx) => {
  if (ctx.source.kind !== 'enemy') return;
  const self = state.enemies.find((e) => e.id === (ctx.source as { id: string }).id);
  if (!self || !self.alive) return;
  const def = content.enemies[self.enemyId]!;
  const minionId = def.id.replace(/-slime$/, '-inkling');
  if (!content.enemies[minionId]) return;
  const at = state.enemies.indexOf(self);
  for (let i = 0; i < 2; i++) {
    const child = spawnEnemy(state, content, minionId);
    child.hp = child.maxHp = Math.max(1, self.hp);
    state.enemies.splice(at + 1 + i, 0, child);
    state.events.push({ t: 'summon', enemy: child.id, enemyId: minionId });
  }
  self.alive = false;
  self.hp = 0;
  self.intent = null;
  state.events.push({ t: 'die', target: self.id });
});
