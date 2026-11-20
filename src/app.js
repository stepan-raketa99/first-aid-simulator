import { scenarios } from './scenarios.js';
import { Game, applyFrame } from './engine.js';
import { scene, icon, position } from './scene.js';
import { animateScene, pause, playCprCycle, CPR_CYCLE } from './animation.js';
import { showDialogue, positionDialogue } from './dialogue.js';
import { medicalSources } from './medical.js';

const game = new Game(scenarios);
const app = document.querySelector('#app');
let pending = null;
let lastResult = '';
function cancelPending() { pending?.abort(); pending = null; lastResult = ''; }
const symbols = ['heart', 'kit', 'hand', 'clock', 'snow'];
const gameScene = (effects=game.effects,options={}) => scene(game.sceneLevel,effects,{facts:game.facts,...options});
function technique(steps) {
  return steps.map(s=>`<details class="technique"><summary>Техника и источники: ${s.action}</summary><ul>${s.details.map(d=>`<li>${d}</li>`).join('')}</ul><div class="source-links">${s.sources.map(key=>`<a href="${medicalSources[key].url}" target="_blank" rel="noopener noreferrer">${medicalSources[key].title} ↗</a>`).join('')}</div></details>`).join('');
}
function home() {
  app.innerHTML = `<section class="hero"><div class="hero-copy"><span class="eyebrow"><i></i> ИНТЕРАКТИВНЫЙ СИМУЛЯТОР</span><h1>Когда помощь<br>начинается <em>с вас.</em></h1><p>Научитесь действовать в ситуациях, где важно<br class="desktop-break"> не пройти мимо. Пять историй. Ваш первый шаг.</p><button class="primary" data-ui="begin">Начать обучение ${icon('arrow')}</button><div class="hero-meta"><span>${icon('hand')} Учитесь через действия</span><span>Без оценок и таймеров</span></div></div><div class="hero-art">${scene(scenarios[2], new Set(['support']), { hero: true })}<span class="art-label"><span class="small-cross">✚</span> Быть рядом — уже начало</span><span class="scene-sticker">Вы можете помочь.</span></div></section>
  <section class="levels" id="situations"><div class="section-heading"><div><span class="eyebrow">ОТ ЗНАНИЙ К ДЕЙСТВИЮ</span><h2>Пять ситуаций. Пять способов помочь.</h2></div></div><div class="level-grid">${scenarios.map((l, i) => `<button class="level-card" data-level="${l.id}" style="--card-color:${l.color}"><div class="card-art">${scene(l)}<span class="card-number">0${i + 1}</span><span class="card-status">${icon(symbols[i])}</span></div><div class="card-copy"><span class="card-location">${l.location}</span><h3>${l.short}</h3><p>${l.description}</p><span class="card-link">Открыть ситуацию ${icon('arrow')}</span></div></button>`).join('')}</div></section>
  <aside class="learning-note">${icon('shield')}<div><strong>Спокойная практика для важных моментов</strong><p>Подсказки помогут на каждом шаге. Симулятор знакомит с основами, но не заменяет практические занятия и медицинскую помощь.</p></div><span class="emergency">Экстренная помощь <b>112 / 103</b></span></aside>`;
}
function renderGame() {
  const l = game.level, step = game.current, n = scenarios.indexOf(l) + 1;
  const ready = game.available;
  const title = step.title;
  const hint = step.hint;
  const targets=ready.filter((s,i)=>ready.findIndex(t=>t.target===s.target)===i);
  app.innerHTML = `<section class="play"><div class="play-heading"><button class="back" data-ui="home">← <span>Все ситуации</span></button><span class="eyebrow">СИТУАЦИЯ 0${n} / 05</span><span class="location-label">${l.location}</span></div><div class="level-heading"><h1>${l.title}</h1><span class="step-count">Выполнено ${game.index}</span></div><div class="variant-context">${l.context}</div><div class="progress" aria-label="Прогресс уровня">${game.activeSteps.map(s => `<span class="${game.done.has(s.id) ? 'done' : ready.includes(s) ? 'active' : ''}"></span>`).join('')}</div>
  <div class="stage"><div class="scene-location"><i></i> ${l.location}<span>Учебная сцена</span></div>${gameScene()}<div class="dialogue-layer" role="log" aria-live="polite"></div>${targets.map(s => {const [x,y] = position(l,s.target,game.effects);return `<button class="hotspot" style="--x:${x};left:${x}%;top:${y}%" data-action="${s.id}" aria-label="${s.action}"><span>${icon(s.target === 'phone' ? 'phone' : s.target === 'area' ? 'eye' : 'hand')}</span></button>`;}).join('')}<div class="scene-bottom">${game.effects.has('call') ? `${icon('check')} Помощь вызвана · учебная имитация` : 'Действуйте через сцену или панель внизу'}</div></div>
  <section class="instruction control-panel" aria-labelledby="step-title"><div class="instruction-copy"><span class="eyebrow">ВАШИ ДЕЙСТВИЯ</span><h2 id="step-title" tabindex="-1">${title}</h2><p id="task-hint">${hint}</p></div><div class="action-choices">${game.visibleActions.map(s => `<button class="action-button ${ready.includes(s) ? 'is-ready' : 'is-locked'}" data-action="${s.id}" ${ready.includes(s) ? '' : 'disabled'} title="${ready.includes(s) ? s.action : 'Доступно после необходимых предшествующих действий'}">${icon(s.target === 'phone' ? 'phone' : s.target === 'area' ? 'shield' : 'hand')}<span>${s.action}</span>${ready.includes(s) ? icon('arrow') : '<small>Позже</small>'}</button>`).join('')}</div><p id="action-status" class="action-result" role="status" aria-live="polite">${lastResult}</p>${technique(ready)}</section><details class="scenario-context"><summary>Условия и границы учебной сцены</summary><p>${l.context}</p><p>Помощник статичен; схемы не подтверждают практический навык. Вызов из игры не совершается.</p><a href="MEDICAL_REVIEW.md">Проверка содержания и ограничения источников</a></details></section>`;
}
function complete() {
  const l = game.level;
  app.innerHTML = `<section class="result"><div class="result-heading"><span class="success-symbol">${icon('check')}</span><span class="eyebrow">СИТУАЦИЯ ПРОЙДЕНА</span><h1>Вы оказались рядом.<br><em>И помогли.</em></h1><p>${l.title} · ${l.location}</p></div><div class="result-layout"><div class="result-scene">${gameScene()}<span>В учебной истории помощь передана бригаде.</span></div><article class="memo"><span class="eyebrow">ВОЗЬМИТЕ С СОБОЙ</span><h2>Короткая памятка</h2><ol>${l.memo.map(m => `<li>${m}</li>`).join('')}</ol></article></div><div class="result-actions"><button class="primary" data-ui="next">${scenarios.indexOf(l) === 4 ? 'К первой ситуации' : 'Следующая ситуация'} ${icon('arrow')}</button><button class="secondary" data-ui="replay">${icon('replay')} Повторить</button><button class="text-button" data-ui="home">Все ситуации</button></div><p class="result-note">СЛР и другие приёмы требуют очной практики; прохождение игры не удостоверяет навык. В реальной ситуации — 112 или 103.</p></section>`;
}
function render(focus = false) {
  if (game.screen === 'home') home(); else if (game.screen === 'complete') complete(); else renderGame();
  if (focus) { const heading = app.querySelector('h1'); heading.tabIndex = -1; heading.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
}
async function act(id) {
  if (pending) return;
  const previous = game.available.find(s => s.id === id);
  if (!previous) return;
  const effects = new Set(game.effects);
  const result = game.act(id);
  if (!result) return;
  app.querySelectorAll('[data-action]').forEach(b => b.disabled = true);
  const controller = new AbortController();
  pending = controller;
  const stage = app.querySelector('.stage');
  stage.dataset.playing = 'true';
  stage.querySelectorAll('.hotspot').forEach(h=>h.classList.add('confirmed'));
  const svg = stage.querySelector('.scene-art');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const frame of previous.frames) {
    applyFrame(effects,frame);
    app.querySelector('#task-hint').textContent = frame.caption;
    app.querySelector('#action-status').textContent = '';
    showDialogue(stage,frame.dialogue);
    await animateScene(svg, gameScene(effects,{phase:frame.effect}), {duration:reduced ? 0 : 500,signal:controller.signal});
    if (controller.signal.aborted) return;
    positionDialogue(stage);
    if(frame.effect==='cpr-cycle30')await playCprCycle(svg,controller.signal);
    else await pause(frame.dialogue ? 1100 : frame.effect==='cpr-breaths'?CPR_CYCLE.breaths*CPR_CYCLE.breathMs:frame.effect==='cpr-compressions'?1100:reduced ? 500 : 240,controller.signal);
    if (controller.signal.aborted) return;
  }
  lastResult = previous.result;
  pending = null;
  render();
  // Keep the very same SVG nodes between actions: no pose reset or fade-to-copy.
  if (game.screen === 'game') app.querySelector('.stage>.scene-art').replaceWith(svg);
  app.querySelector('#step-title, h1')?.focus({preventScroll:true});
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('button, a.brand');
  if (!button) return;
  if (button.matches('a.brand')) { event.preventDefault(); cancelPending(); game.home(); render(true); return; }
  if (button.dataset.level) { cancelPending(); game.start(button.dataset.level); render(true); return; }
  if (button.dataset.action) { act(button.dataset.action); return; }
  const ui = button.dataset.ui;
  if (ui === 'about') { document.querySelector('#about').showModal(); return; }
  if (button.matches('#about .close')) { document.querySelector('#about').close(); return; }
  if (ui === 'home') { cancelPending(); game.home(); render(true); }
  if (ui === 'begin') { cancelPending(); game.start(scenarios[0].id); render(true); }
  if (ui === 'next') { cancelPending(); game.next(); render(true); }
  if (ui === 'replay') { const id=game.level.id;cancelPending(); game.start(id); render(true); }
});
window.addEventListener('resize',()=>positionDialogue(app.querySelector('.stage')));
render();
