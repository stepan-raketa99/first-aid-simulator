// The single presentation path for spoken lines. Instructions never enter it.
export function showDialogue(stage, dialogue) {
  const layer = stage.querySelector('.dialogue-layer');
  layer.replaceChildren();
  if (!dialogue) return;
  const bubble = document.createElement('div');
  bubble.className = 'dialogue-bubble';
  bubble.dataset.speaker = dialogue.speaker;
  bubble.textContent = dialogue.text;
  layer.append(bubble);
  positionDialogue(stage);
}

export function positionDialogue(stage) {
  const bubble = stage?.querySelector('.dialogue-bubble');
  if (!bubble) return;
  const face = stage.querySelector(`[data-face="${bubble.dataset.speaker}"]`);
  if (!face) throw Error('Dialogue speaker not in scene');
  const bounds = stage.getBoundingClientRect(), head = face.getBoundingClientRect();
  const center = head.left + head.width / 2 - bounds.left;
  const clamp = x => Math.max(8,Math.min(x,bounds.width - bubble.offsetWidth - 8));
  let left = clamp(center - bubble.offsetWidth / 2);
  const top = Math.max(26,head.top - bounds.top - bubble.offsetHeight - 12);
  const faces = [...stage.querySelectorAll('[data-face]')].filter(f=>f !== face).map(f=>f.getBoundingClientRect());
  const clear = x => faces.every(r=>x + bubble.offsetWidth + bounds.left + 5 <= r.left || x + bounds.left - 5 >= r.right || top + bubble.offsetHeight + bounds.top + 5 <= r.top || top + bounds.top - 5 >= r.bottom);
  if (!clear(left)) {
    const candidates = faces.flatMap(r=>[clamp(r.right - bounds.left + 7),clamp(r.left - bounds.left - bubble.offsetWidth - 7)]).concat([8,clamp(bounds.width)]);
    left = candidates.filter(clear).sort((a,b)=>Math.abs(a-left)-Math.abs(b-left))[0] ?? left;
  }
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  bubble.style.setProperty('--tail-x',`${Math.max(14,Math.min(bubble.offsetWidth - 14,center - left))}px`);
}
