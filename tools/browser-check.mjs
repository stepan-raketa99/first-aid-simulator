// Dependency-free integration checks against an installed headless Chrome (CDP).
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { scenarios } from '../src/scenarios.js';
import { Game } from '../src/engine.js';
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await mkdtemp(path.join(process.env.OPENCODE_TEST_TEMP || tmpdir(),'ryadom-browser-'));
const server = spawn(process.execPath,['tools/serve.mjs'],{stdio:'ignore'});
const browser = spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=9333',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay = ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try {
  let target;
  for (let i=0;i<80;i++) {
    try {target=(await(await fetch('http://127.0.0.1:9333/json')).json()).find(t=>t.type==='page');if(target)break;}catch{}
    await delay(150);
  }
  assert.ok(target,'Chrome debugging endpoint');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let sequence=0;const requests=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const msg=JSON.parse(event.data);
    if(msg.id){const request=requests.get(msg.id);requests.delete(msg.id);msg.error?request.reject(Error(JSON.stringify(msg.error))):request.resolve(msg.result);}
    if(msg.method==='Runtime.exceptionThrown'){const text=msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text;errors.push(text);console.error(text);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;requests.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const wait=async expression=>{for(let i=0;i<1000;i++){if(await evaluate(expression))return;await delay(40);}throw Error('Timeout: '+expression);};
  const click=async selector=>{
    const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Unavailable: ${selector}');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  };
  const screenshot=async name=>{if(!process.env.SCREENSHOTS)return;const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(process.env.SCREENSHOTS,`ryadom-${name}.png`),Buffer.from(s.data,'base64'));};
  const layout=async()=>{
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'No horizontal overflow');
    assert.equal(await evaluate(`[...document.querySelectorAll('.hotspot>span')].every(e=>{const r=e.getBoundingClientRect(),s=document.querySelector('.stage').getBoundingClientRect();return r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom;})`),true,'Scene targets fit');
    assert.equal(await evaluate('document.querySelectorAll("[data-part*=nose]").length'),0,'No noses');
  };
  async function action(level,id,viaScene=false) {
    try {
    const step=level.steps.find(s=>s.id===id);
    await layout();
    assert.equal(await evaluate('document.querySelectorAll(".control-panel .action-button").length>0'),true);
    assert.equal(await evaluate(`!new DOMParser().parseFromString(document.querySelector('.stage>.scene-art').outerHTML,'image/svg+xml').querySelector('parsererror')`),true);
    const readyBefore=await evaluate(`[...document.querySelectorAll('.control-panel button:not(:disabled)')].map(b=>b.dataset.action)`);
    await evaluate(`document.querySelectorAll('.control-panel button:disabled').forEach(b=>b.click())`);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.control-panel button:not(:disabled)')].map(b=>b.dataset.action)`),readyBefore,'Locked buttons cannot change state');
    await evaluate(`window.beforeSVG=document.querySelector('.stage>.scene-art');window.beforeHelper=document.querySelector('[data-character=helper]').outerHTML;window.beforeWitness=document.querySelector('[data-character=witness]')?.outerHTML;window.frames=[];window.patientStates=[];window.patientHeadValues=[];window.limbGeometry=[];window.helperMutations=0;window.phaseObserver?.disconnect();window.helperObserver?.disconnect();window.phaseObserver=new MutationObserver(()=>{const s=window.beforeSVG,p=s.querySelector('[data-character=patient]');if(window.frames.at(-1)!==s.dataset.phase)window.frames.push(s.dataset.phase);window.patientStates.push(p.outerHTML);window.patientHeadValues.push(p.querySelector('[data-part=patient-head]').getAttribute('transform'));window.limbGeometry.push([...p.querySelectorAll('[data-limb] path[d]')].map(e=>e.getAttribute('d')).join('|'));});window.phaseObserver.observe(window.beforeSVG,{subtree:true,attributes:true});window.helperObserver=new MutationObserver(r=>window.helperMutations+=r.length);window.helperObserver.observe(document.querySelector('[data-character=helper]'),{subtree:true,attributes:true,childList:true});`);
    await click(viaScene?`.hotspot[data-action="${id}"]>span`:`.control-panel [data-action="${id}"]`);
    for(const frame of step.frames){
      await wait(`window.beforeSVG.dataset.phase==='${frame.effect}'`);
      assert.equal(await evaluate('document.querySelectorAll(".control-panel [data-action]:not(:disabled)").length'),0,'Input locked only during action');
      assert.equal(await evaluate('document.querySelector("[data-character=helper]").outerHTML===window.beforeHelper'),true,'Helper never changes');
      assert.equal(await evaluate('document.querySelector("[data-character=witness]")?.outerHTML===window.beforeWitness'),true,'Witness never changes');
      if(frame.dialogue){
        await wait(`document.querySelector('.dialogue-bubble')?.textContent===${JSON.stringify(frame.dialogue.text)}`);
        assert.equal(await evaluate('document.querySelectorAll(".dialogue-bubble").length'),1);
        assert.equal(await evaluate('document.querySelector(".dialogue-bubble").dataset.speaker'),frame.dialogue.speaker);
        assert.equal(await evaluate(`!document.querySelector('.control-panel').textContent.includes(${JSON.stringify(frame.dialogue.text)})`),true,'Speech is not repeated in panel');
        const placement=await evaluate(`(()=>{const b=document.querySelector('.dialogue-bubble'),r=b.getBoundingClientRect(),s=document.querySelector('.stage').getBoundingClientRect(),f=document.querySelector('[data-face="'+b.dataset.speaker+'"]').getBoundingClientRect();return{fits:r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom,above:r.bottom<f.top,faces:[...document.querySelectorAll('.stage [data-face]')].every(e=>{const a=e.getBoundingClientRect();return r.right<=a.left||r.left>=a.right||r.bottom<=a.top||r.top>=a.bottom;})};})()`);
        assert.deepEqual(placement,{fits:true,above:true,faces:true},`${level.id}/${frame.effect}: speech placement`);
        if((id==='time'||id==='call')&&level.id==='stroke')await screenshot(`${level.id}-${frame.effect}-dialogue-${width}`);
      }else assert.equal(await evaluate('document.querySelectorAll(".dialogue-bubble").length'),0,'No stale speech');
    }
    await wait(`!document.querySelector('.stage[data-playing]')`);
    assert.equal(await evaluate('window.helperMutations'),0,'No helper animation frames');
    assert.equal(await evaluate('document.querySelector("[data-character=helper]").getAnimations({subtree:true}).length'),0,'No helper CSS or JS animations');
    assert.ok(await evaluate('new Set(window.limbGeometry).size<=2'),'No intermediate deformed limbs');
    if(id==='airway'){
      const headStates=await evaluate('new Set(window.patientHeadValues).size');
      assert.ok(reducedMotion?headStates<=2:headStates>3,'Head motion is rigid and respects reduced motion');
    }
    assert.deepEqual(await evaluate('window.frames'),step.frames.map(f=>f.effect),'Phase order');
    assert.equal(await evaluate('document.querySelectorAll("[data-ui=outcome]").length'),0);
    assert.equal(await evaluate(`document.querySelectorAll('[data-action="${id}"]').length`),0,'Completed action is not offered again');
    if(!await evaluate('!!document.querySelector(".memo")'))assert.equal(await evaluate('window.beforeSVG===document.querySelector(".stage>.scene-art")'),true);
    assert.equal(await evaluate('document.querySelectorAll(".dialogue-bubble").length'),0);
    assert.equal(await evaluate('document.querySelectorAll(".variant-selector,[data-variant],.completion-count").length'),0,'No alternatives or level history UI');
    assert.equal(await evaluate('window.storageAccesses'),0,'The app never accesses localStorage');
    if(['blood-position','arms','side','blanket','handover','immobilize'].includes(id))await screenshot(`${level.id}-${id}-${width}`);
    } catch(error) { await screenshot(`failure-${level.id}-${id}-${width}`); error.message=`${level.id}/${id}/${width}: ${error.message}`; throw error; }
  }
  await send('Runtime.enable');await send('Page.enable');
  // Seed legacy history, then trap every app access: old records must be ignored.
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    window.testDocumentToken=Date.now()+'-'+Math.random();
    window.storageAccesses=0;
    try {
      const saved=window.localStorage;
      saved.setItem('ryadom.completed',${JSON.stringify(JSON.stringify(scenarios.map(l=>l.id)))});
      saved.setItem('ryadom.variants','["unconscious/breathing","bleeding/controlled","injury/forearm","stroke/stable","cold/hypothermia"]');
    } catch { /* The fixture also supports Chrome with native storage disabled. */ }
    window.storageAccesses=0;
    Object.defineProperty(window,'localStorage',{configurable:true,get(){window.storageAccesses++;throw Error('The app must not access localStorage');}});
  })()`});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  let width, reducedMotion=false;
  async function runRoute(level){
    const model=new Game(scenarios);model.start(level.id);
    let count=0;
    while(model.screen==='game'){
      assert.ok(count++<60,'No endless route');
      assert.deepEqual(await evaluate(`[...document.querySelectorAll('.control-panel button:not(:disabled)')].map(b=>b.dataset.action)`),model.available.map(s=>s.id),'UI availability matches state');
      assert.equal(model.available.length,1,'One sequential story');
      const step=model.current;
      await action(level,step.id,step.id==='safe'||step.id==='side');model.act(step.id);
    }
    assert.equal(await evaluate('!!document.querySelector(".memo")'),true);
    assert.equal(await evaluate('window.storageAccesses'),0);
  }
  for(width of (process.env.BROWSER_WIDTHS || '1440,390').split(',').map(Number)){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
    const beforeNavigation=await evaluate('window.testDocumentToken || null');
    await send('Page.navigate',{url:'http://127.0.0.1:4173'});
    await wait(`window.testDocumentToken && window.testDocumentToken!==${JSON.stringify(beforeNavigation)} && document.querySelectorAll('.level-card').length===5`);
    await layout();await click('[data-ui=about]');assert.equal(await evaluate('document.querySelector("dialog").open'),true);await click('dialog .close');
    await screenshot(`home-${width}`);
    const originalCards=await evaluate('document.querySelector(".level-grid").innerHTML');
    assert.equal(await evaluate('document.querySelectorAll(".completion-count,.variant-selector,[data-variant]").length'),0,'Legacy history is not restored');
    let routes=0;
    for(const level of scenarios){
      await click(`[data-level="${level.id}"]`);
      assert.ok(await evaluate('document.querySelectorAll(".control-panel button:disabled").length>0'),'Future actions are visibly locked');
      await runRoute(level);routes++;
      console.log(`${width}px: ${level.id}, all ${level.steps.length} actions passed`);
      if(level.id==='cold'){
        await click('[data-ui=next]');assert.equal(await evaluate('document.querySelector(".level-heading h1").textContent'),scenarios[0].title);
      }else{
        await click('[data-ui=replay]');assert.equal(await evaluate('document.querySelector(".hotspot").dataset.action'),'safe');
      }
      await click('[data-ui=home]');
      assert.equal(await evaluate('document.querySelector(".level-grid").innerHTML'),originalCards,'Finishing never marks cards or stores level history');
    }
    assert.equal(routes,5);
    await click('[data-ui=begin]');assert.equal(await evaluate('document.querySelector(".level-heading h1").textContent'),scenarios[0].title);await click('.brand');
    await click('[data-level=unconscious]');await click('.hotspot>span');await click('[data-ui=home]');await delay(1700);
    assert.equal(await evaluate('document.querySelectorAll(".level-card").length'),5,'Navigation cancels phases');
    const beforeReload=await evaluate('window.testDocumentToken');
    await send('Page.reload');await wait(`window.testDocumentToken && window.testDocumentToken!==${JSON.stringify(beforeReload)} && document.querySelectorAll('.level-card').length===5`);
    assert.equal(await evaluate('document.querySelector(".level-grid").innerHTML'),originalCards,'Reload starts with all five unmarked levels');
    assert.equal(await evaluate('window.storageAccesses'),0);
    console.log(`${width}px: all 5 single-story levels, repeat/navigation, unchanged cards, no localStorage or history passed`);
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  reducedMotion=true;
  await click('[data-level=unconscious]');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hotspot>span")).animationName'),'none');
  for(const id of ['safe','scan','response','airway','breathing'])await action(scenarios[0],id);
  assert.equal(await evaluate('document.querySelector("[data-character=patient]").getAnimations({subtree:true}).length'),0,'Reduced motion disables patient animation');
  assert.deepEqual(errors,[]);console.log('Reduced motion, patient-only animation and JavaScript console: passed.');
}finally{ws?.close();browser.kill();server.kill();await delay(500);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300}).catch(()=>{});}
