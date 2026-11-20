import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,applyFrame} from '../src/engine.js';
import {scenarios} from '../src/scenarios.js';
import {medicalSources} from '../src/medical.js';
import {scene,position} from '../src/scene.js';

// The former default stories are retained verbatim in action count and order.
const expected={
  unconscious:['safe','scan','response','airway','breathing','side','call','monitor','handover'],
  bleeding:['safe','gloves','scan','press','check-pressure','bandage','check-bandage','blood-position','monitor','handover'],
  injury:['safe','scan','assess','history','examine','call','support','immobilize','cold','check-fixation','monitor','handover'],
  stroke:['safe','scan','recognize','call','smile','speech','arms','time','rest','monitor','handover'],
  cold:['safe','scan','assess','recognize','call','shelter','insulate','dry','blanket','monitor','handover']
};
const create=level=>{const game=new Game(scenarios);assert.ok(game.start(level.id));return game;};
function finish(game){
  const trace=[];
  while(game.screen==='game'){
    assert.equal(game.available.length,1,`One next action: ${game.level.id}/${game.index}`);
    const action=game.current;trace.push(action.id);assert.equal(game.act(action.id),action);
  }
  assert.equal(game.screen,'complete');return trace;
}
const before=(trace,a,b)=>assert.ok(trace.indexOf(a)>=0&&trace.indexOf(a)<trace.indexOf(b),`${a} before ${b}`);

test('Пять уровней: по одной истории, исходные 53 действия без добавления и сокращения',()=>{
  assert.equal(scenarios.length,5);
  for(const level of scenarios){
    assert.ok(!('variants' in level));
    assert.deepEqual(level.steps.map(s=>s.id),expected[level.id]);
    assert.ok(level.steps.every(s=>!s.group&&!s.requiresAny));
    assert.deepEqual(finish(create(level)),expected[level.id]);
  }
  assert.equal(scenarios.reduce((n,l)=>n+l.steps.length,0),53);
});

test('Следующие и уже выполненные действия заблокированы, порядок строго последовательный',()=>{
  for(const level of scenarios){
    const game=create(level);
    for(const [index,step] of level.steps.entries()){
      for(const other of level.steps.filter(s=>s!==step)){
        assert.equal(game.act(other.id),null);assert.equal(game.index,index);
      }
      assert.equal(game.act('invalid'),null);assert.equal(game.current.id,step.id);game.act(step.id);
    }
    assert.equal(game.current,null);assert.equal(game.act('handover'),null);
  }
});

test('Без сознания с нормальным дыханием: пути, дыхание, боковое положение и вызов',()=>{
  const game=create(scenarios[0]),trace=finish(game);
  for(const [a,b] of [['safe','scan'],['scan','response'],['response','airway'],['airway','breathing'],['breathing','side'],['side','call'],['call','monitor']])before(trace,a,b);
  assert.ok(game.effects.has('normal-breathing'));assert.ok(game.effects.has('side'));
  assert.ok(!game.effects.has('cpr'));assert.ok(!game.effects.has('no-breathing'));
  assert.ok(!game.steps.some(s=>/пульс/i.test(s.action)));
});

test('Кровотечение остановлено давлением и повязкой, повторного вызова и жгута нет',()=>{
  const game=create(scenarios[1]),trace=finish(game);
  before(trace,'scan','press');before(trace,'press','check-pressure');before(trace,'check-pressure','bandage');before(trace,'bandage','check-bandage');before(trace,'check-bandage','blood-position');
  assert.ok(game.effects.has('pressure-stopped'));assert.ok(game.effects.has('bandage'));assert.ok(game.effects.has('call'));
  assert.ok(!game.steps.some(s=>/tourniquet|call-update/.test(s.id)));
  const calls=game.steps.flatMap(s=>s.frames.flatMap(f=>[f.effect,...f.also])).filter(e=>e==='call');
  assert.equal(calls.length,1);
});

test('Инсульт со стабильным состоянием: вызов до проб, время, опора и наблюдение',()=>{
  const game=create(scenarios[3]),trace=finish(game);
  for(const id of ['smile','speech','arms','time'])before(trace,'call',id);
  before(trace,'rest','monitor');assert.equal(game.facts.strokeTime,'14:20');
  assert.ok(!game.steps.some(s=>/deterioration|call-update|cpr/.test(s.id)));
  assert.ok(!game.effects.has('collapsed'));
});

test('Травма и переохлаждение сохраняют необходимые мероприятия в прежнем порядке',()=>{
  const injury=finish(create(scenarios[2]));
  for(const [a,b] of [['history','examine'],['support','immobilize'],['immobilize','cold'],['cold','check-fixation']])before(injury,a,b);
  const cold=finish(create(scenarios[4]));
  for(const [a,b] of [['recognize','call'],['call','shelter'],['shelter','insulate'],['insulate','dry'],['dry','blanket'],['blanket','monitor']])before(cold,a,b);
  assert.ok(!scenarios[4].steps.some(s=>/дать.*(пить|вод|алкоголь)/i.test(s.action)));
});

test('Зависимости и официальные ссылки всех действий полны; цели внутри сцены',()=>{
  for(const level of scenarios){
    const game=create(level);
    for(const [index,step] of level.steps.entries()){
      assert.deepEqual(step.requires,index?[level.steps[index-1].id]:[]);
      assert.ok(step.frames.length&&step.hint&&step.action&&step.result);
      step.sources.forEach(key=>assert.ok(medicalSources[key]));
      const point=position(level,step.target,game.effects);assert.equal(point?.length,2);assert.ok(point.every(n=>n>0&&n<100));
      game.act(step.id);
    }
  }
});

test('Повтор и возврат сбрасывают только текущую сцену, любой уровень всегда доступен',()=>{
  const game=new Game(scenarios);
  for(const level of scenarios){
    game.start(level.id);const first=finish(game);
    game.start(level.id);assert.equal(game.index,0);assert.equal(game.effects.size,0);assert.deepEqual(game.facts,{});assert.deepEqual(finish(game),first);
    game.home();assert.equal(game.level,null);assert.equal(game.done.size,0);assert.equal(game.current,null);
  }
  game.start('cold');game.next();assert.equal(game.level.id,'unconscious');
  assert.equal(game.start('missing'),false);assert.equal(game.level.id,'unconscious');
});

test('localStorage не используется, в движке нет истории прохождения уровней',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  let calls=0;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){calls++;throw Error('Storage must not be accessed');}});
  try{
    const game=new Game(scenarios);
    for(const level of scenarios){game.start(level.id);finish(game);game.home();}
    assert.equal(calls,0);
    for(const key of ['completed','completedVariants','storage','variant','choices'])assert.ok(!(key in game),key);
    const fresh=new Game(scenarios);assert.equal(fresh.screen,'home');assert.equal(fresh.done.size,0);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});

test('Визуальный проигрыватель и движок применяют одни и те же эффекты',()=>{
  for(const level of scenarios){
    const game=create(level),visible=new Set();
    while(game.screen==='game'){
      const step=game.current;step.frames.forEach(f=>applyFrame(visible,f));game.act(step.id);
      assert.deepEqual([...visible],[...game.effects]);
      const svg=scene(game.sceneLevel,visible,{facts:game.facts});
      assert.ok(svg.startsWith('<svg'));assert.ok(!svg.includes('undefined'));assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('-nose'));
    }
  }
});

test('Помощник статичен, повреждённая рука при травме и средства помощи сохраняются',()=>{
  const helper=svg=>svg.slice(svg.indexOf('<g class="helper"'),svg.indexOf('<g data-part="phone"'));
  const arm=svg=>[...svg.matchAll(/data-part="patient-injured-arm[^>]+/g)].map(m=>m[0]);
  for(const level of scenarios){
    const game=create(level),initial=scene(level),initialHelper=helper(initial),initialArm=arm(initial);
    while(game.screen==='game'){
      game.act(game.current.id);const svg=scene(level,game.effects,{facts:game.facts});
      assert.equal(helper(svg),initialHelper);
      if(level.id==='injury')assert.deepEqual(arm(svg),initialArm);
    }
    if(level.id==='injury'){assert.ok(game.effects.has('immobilized'));assert.ok(game.effects.has('cold'));}
    if(level.id==='cold')assert.ok(game.effects.has('blanket'));
  }
});
