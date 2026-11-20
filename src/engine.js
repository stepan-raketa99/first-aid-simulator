// Shared by the DOM player and the pure engine, including effect removal and order.
export function applyFrame(effects, frame) {
  for (const effect of frame.clear || []) effects.delete(effect);
  for (const effect of [...(frame.also || []),frame.effect]) { effects.delete(effect); effects.add(effect); }
}

export class Game {
  constructor(levels) {
    this.levels = levels;
    this.home();
  }
  home() { this.screen = 'home'; this.level = null; this.steps=[]; this.index = 0; this.effects = new Set(); this.done = new Set(); this.facts={}; }
  start(id) {
    const level = this.levels.find(l => l.id === id);
    if (!level) return false;
    this.level = level; this.steps=level.steps; this.index = 0; this.effects = new Set(); this.done = new Set(); this.facts={}; this.screen = 'game'; return true;
  }
  get activeSteps() { return this.steps; }
  get remaining() { return this.activeSteps.filter(s=>!this.done.has(s.id)); }
  get available() {
    if(this.screen!=='game')return [];
    const step=this.steps[this.index];
    return step && step.requires.every(id=>this.done.has(id)) && (step.needsEffects || []).every(e=>this.effects.has(e)) ? [step] : [];
  }
  get visibleActions() { const ready=this.available; return [...ready,...this.remaining.filter(s=>!ready.includes(s)).slice(0,2)]; }
  get sceneLevel() { return this.level; }
  get current() { return this.available[0] || null; }
  act(id) {
    const done = this.available.find(s => s.id === id);
    if (!done) return null;
    for (const frame of done.frames) applyFrame(this.effects,frame);
    Object.assign(this.facts,done.record || {});
    this.done.add(id);
    this.index++;
    if (done.terminal || !this.remaining.length) {
      this.screen = 'complete';
    }
    return done;
  }
  next() { if (!this.level) return false; const index = this.levels.indexOf(this.level); return this.start(this.levels[(index + 1) % this.levels.length].id); }
}
