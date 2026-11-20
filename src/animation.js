const NUMBERS = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

// Only rigid patient transforms and attached aids interpolate. Limb paths never
// morph; changing body pose uses a brief fade between complete valid drawings.
export async function animateScene(svg, markup, { duration = 500, signal } = {}) {
  const target = new DOMParser().parseFromString(markup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '), 'image/svg+xml').documentElement;
  if (target.querySelector('parsererror')) throw Error('Invalid scene SVG');
  const background = svg.querySelector('[data-background]');
  const nextBackground = target.querySelector('[data-background]');
  if (background.dataset.background !== nextBackground.dataset.background) {
    background.replaceChildren(...Array.from(nextBackground.childNodes).map(n => document.importNode(n, true)));
    background.dataset.background = nextBackground.dataset.background;
  }
  const tweens = [];
  function sync(node, next, moving = false) {
    if (!node) throw Error('Missing SVG node for '+next.nodeName);
    if (node.nodeType !== 1) { if (node.textContent !== next.textContent) node.textContent = next.textContent; return; }
    for (const attribute of next.attributes) {
      const {name, value} = attribute;
      const before = node.getAttribute(name);
      if (before === value) continue;
      if (moving && duration && before !== null && ['transform','opacity'].includes(name) && before.replace(NUMBERS, '#') === value.replace(NUMBERS, '#')) {
        const from = (before.match(NUMBERS) || []).map(Number), to = (value.match(NUMBERS) || []).map(Number);
        tweens.push(t => { let i = 0; node.setAttribute(name, value.replace(NUMBERS, () => String(from[i] + (to[i] - from[i++]) * t))); });
      } else node.setAttribute(name, value);
    }
    if(node.childNodes.length!==next.childNodes.length){
      node.replaceChildren(...Array.from(next.childNodes).map(child=>document.importNode(child,true)));
    }else for (let i = 0; i < next.childNodes.length; i++) sync(node.childNodes[i], next.childNodes[i],moving);
  }
  // Helpers / witnesses are immutable. Only the patient and attached aid animate.
  svg.dataset.phase = target.dataset.phase;
  for (const next of target.children) {
    if (next.matches('[data-background], title')) continue;
    if (next.matches('[data-character="helper"], [data-character="witness"]')) continue;
    const key = next.getAttribute('data-part') || next.getAttribute('data-character');
    if (!key) continue;
    const node = svg.querySelector(`[data-part="${key}"], [data-character="${key}"]`);
    const patient = next.matches('[data-character="patient"]');
    if (patient && node.dataset.pose !== next.dataset.pose) {
      // Sitting -> lying may have different parts: swap the entire casualty only.
      const replacement=document.importNode(next,true);
      const out=duration?node.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'}):null;
      if(duration)await pause(160,signal);
      if(signal.aborted){out?.cancel();return false;}
      node.replaceWith(replacement); out?.cancel();
      if(duration){
        const enter=replacement.animate([{opacity:0},{opacity:1}],{duration:160,fill:'forwards'});
        await pause(160,signal); enter.cancel();
      }
      if(signal.aborted)return false;
    } else sync(node,next,patient);
  }
  if (!duration || !tweens.length) return !signal?.aborted;
  return new Promise(resolve => {
    let frame, start;
    const stop = () => { cancelAnimationFrame(frame); resolve(false); };
    signal?.addEventListener('abort', stop, {once:true});
    const tick = now => {
      if (signal?.aborted) { stop(); return; }
      start ??= now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      tweens.forEach(tween => tween(eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { signal?.removeEventListener('abort', stop); resolve(true); }
    };
    frame = requestAnimationFrame(tick);
  });
}

export function pause(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort',done); resolve(); };
    const timer = setTimeout(done,ms);
    signal.addEventListener('abort',done,{once:true});
  });
}

export const CPR_CYCLE = Object.freeze({compressions:30,periodMs:550,breaths:2,breathMs:1000});

// Educational playback only: it counts illustrated compressions, never clicks.
export async function playCprCycle(svg,signal) {
  for(let count=1;count<=CPR_CYCLE.compressions;count++){
    await pause(CPR_CYCLE.periodMs,signal);
    if(signal.aborted)return false;
    svg.querySelector('[data-cpr-count]').textContent=`${count} / ${CPR_CYCLE.compressions}`;
  }
  return true;
}
