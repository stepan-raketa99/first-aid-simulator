// Adult rigs use explicit shoulder / elbow / wrist and hip / knee / ankle joints.
// All moving parts keep stable keys so animation can interpolate their geometry.
import { attachedAids, clinicalOverlay } from './clinical.js';
const SKIN = '#efb699';
const part = (key, attributes, body = '', tag = 'g') => `<${tag} data-part="${key}" ${attributes}>${body}</${tag}>`;
const line = (key, a, b, color, width) => part(key, `d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"`, '', 'path');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const angle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;

function hand(key, elbow, wrist, glove = false) {
  return part(key, `transform="translate(${wrist.join(' ')}) rotate(${angle(elbow, wrist)})"`, '<path d="M-5-6 Q4-8 11-4 L14-1 Q15 5 8 6 L-5 5Z" fill="' + (glove ? '#b7d9dd' : SKIN) + '"/>');
}
function arm(key, shoulder, elbow, wrist, shirt, glove = false) {
  return `<g data-limb="${key}">${line(key + '-upper', shoulder, elbow, SKIN, 17)}${line(key + '-forearm', elbow, wrist, SKIN, 14)}${line(key + '-sleeve', shoulder, mix(shoulder, elbow, .55), shirt, 25)}${hand(key + '-hand', elbow, wrist, glove)}</g>`;
}
function shoe(key, ankle, left = false) {
  return part(key, `transform="translate(${ankle.join(' ')}) rotate(0)"`, `<path d="${left ? 'M9-8 H-8 L-28 0 Q-34 2-31 9 H10Z' : 'M-9-8 H8 L28 0 Q34 2 31 9 H-10Z'}" fill="#283955"/><path d="M${left ? '-30' : '-9'} 7h39" stroke="#617188" stroke-width="2"/>`);
}
function leg(key, hip, knee, ankle, color, left = false) {
  return `<g data-limb="${key}">${line(key + '-thigh', hip, knee, color, 28)}${line(key + '-shin', knee, ankle, color, 23)}${shoe(key + '-shoe', ankle, left)}</g>`;
}
function torso(key, left, right, hipLeft, hipRight, color) {
  return part(key, `d="M${left.join(' ')} Q${(left[0] + right[0]) / 2} ${left[1] - 13} ${right.join(' ')} L${hipRight.join(' ')} Q${(hipLeft[0] + hipRight[0]) / 2} ${hipLeft[1] + 12} ${hipLeft.join(' ')} Z" fill="${color}"`, '', 'path');
}
function head(key, transform, { hair = '#76554c', mood = 'concern', profile = false, long = false, hat = false } = {}) {
  const closed = mood === 'closed' || mood === 'cough';
  const eyes = closed ? 'M-10 0 L-5 1 M6 1 L11 0' : mood === 'tired' ? 'M-10 0 L-5 1 M6 1 L11 2' : 'M-9 0 L-8 1 M8 0 L9 1';
  const mouth = mood === 'cough' ? 'M-5 14 Q1 23 8 14' : mood === 'asymmetry' ? 'M-6 14 Q1 9 10 17' : mood === 'pain' ? 'M-6 16 Q1 10 8 16' : 'M-5 15 Q1 14 8 14';
  return part(key, `transform="${transform}"`, `${long ? '<path d="M-21-6 Q-34 23-25 51 L-10 43 16 36 23 2Z" fill="' + hair + '"/>' : ''}<path d="M-8 18 L-8 42 9 42 9 18Z" fill="${SKIN}"/><path data-face="${key.replace('-head','')}" d="M-20-5 Q-20-30 2-29 Q24-26 21-2 L17 16 Q3 31-13 17Z" fill="${SKIN}"/><path d="M-21 1 Q-28-28-3-30 Q21-34 24-10 L19 5 14-13 Q-2-10-10-21 Q-10-8-21 1Z" fill="${hair}"/><ellipse cx="${profile ? -14 : 18}" cy="6" rx="4" ry="6" fill="${SKIN}"/>${part(key + '-eyes', `d="${eyes}" stroke="#584d56" stroke-width="2.3" stroke-linecap="round" fill="none"`, '', 'path')}<path d="M-13-7 Q-7-10-3-7 M5-7 Q10-9 14-6" stroke="${hair}" stroke-width="1.7" fill="none"/>${part(key + '-mouth', `d="${mouth}" stroke="#b77870" stroke-width="1.8" fill="none" stroke-linecap="round"`, '', 'path')}${hat ? '<path d="M-23-7 Q-25-37 0-38 Q25-36 24-7Z" fill="#bf7470"/><path d="M-22-6 H24" stroke="#db9690" stroke-width="8" stroke-linecap="round"/>' : ''}`);
}

export function currentPose(effects, phase) { return phase || [...effects].at(-1) || 'idle'; }

function seated(id, e, facts) {
  const bench = id === 'stroke' || id === 'cold';
  const dy = bench ? -22 : 0;
  const coat = id === 'cold' ? (e.has('dry') ? '#7b9db7' : '#6f94b5') : id === 'injury' ? '#dd8377' : id === 'stroke' ? '#c39b64' : '#6c9ca0';
  const hip = bench ? [[564, 378], [589, 378]] : [[580, 427], [601, 427]];
  const knees = bench ? [[627, 395], [663, 388]] : [[631, 469], [665, 443]];
  const ankles = bench ? [[626, 479], [664, 479]] : [[685, 489], [721, 479]];
  const left = [575, 328 + dy], right = [612, 328 + dy];
  const injured = id === 'injury' || id === 'bleeding';
  const armsRaised=id==='stroke'&&e.has('arms')&&!e.has('rest');
  const nearElbow = injured ? [636, 381] : armsRaised?[666,306]:[630, 358];
  const nearWrist = injured ? [578, 391] : armsRaised?[720,306]:[581, 369];
  const farElbow = injured ? [548, 376] : [550, 355];
  const farWrist = injured ? [589, 399] : [590, 365];
  const flowing=id==='bleeding'&&(!e.has('pressure-stopped')&&!e.has('bleeding-stopped')||e.has('bleeding-continues'));
  return `<g class="patient" data-character="patient" data-pose="${armsRaised?'arms-raised':bench ? 'bench' : 'ground-seated'}">
    <ellipse cx="637" cy="493" rx="112" ry="9" fill="#7b819b" opacity=".16"/>
    ${leg('patient-far-leg', hip[0], knees[0], ankles[0], '#34456a')}
    ${leg('patient-near-leg', hip[1], knees[1], ankles[1], '#293a60')}
    ${part('back-support', `opacity="${e.has('rest') ? 1 : 0}"`, '<path d="M548 307 Q560 301 568 310 L569 376 547 376Z" fill="#b7c59c"/>')}
    ${arm('patient-far-arm', left, farElbow, farWrist, coat)}
    ${torso('patient-torso', left, right, [hip[0][0] - 10, hip[0][1]], [hip[1][0] + 12, hip[1][1]], coat)}
    ${part('arm-support', `opacity="${e.has('support') ? 1 : 0}"`, '<path d="M568 404 Q602 392 642 394 L646 407 Q607 421 568 416Z" fill="#e8d8b7"/><path d="M577 411 L634 403" stroke="#d3c19e" stroke-width="3"/>')}
    ${arm('patient-injured-arm', right, nearElbow, nearWrist, coat)}
    ${head('patient-head', `translate(593 ${286 + dy}) rotate(${id === 'cold' ? 5 : id === 'injury' ? -5 : 0})`, { hair: id === 'injury' ? '#854f49' : id === 'stroke' ? '#827569' : '#665b56', mood: id === 'stroke' ? 'asymmetry' : id === 'cold' ? 'tired' : 'pain', long: id === 'injury', hat: id === 'cold' })}
    ${part('wound', `opacity="${flowing ? 1 : 0}"`, '<path d="M595 386 L606 384" stroke="#bd6964" stroke-width="6" stroke-linecap="round"/><path d="M601 392 Q594 401 601 403 Q608 401 601 392" fill="#bd6964"/>')}
    ${part('gauze', `opacity="${e.has('gauze') ? 1 : 0}"`, '<path d="M588 378 L613 376 616 397 590 400Z" fill="#fffaf0"/>')}
    ${part('bandage', `opacity="${e.has('bandage') ? 1 : 0}"`, '<path d="M585 377 L618 374 622 398 589 403Z" fill="#fcfcf3"/><path d="M593 378 L597 400 M601 377 L605 399 M609 376 L613 398" stroke="#d6ddd7" stroke-width="2"/>')}
    ${part('leak',`opacity="${flowing&&e.has('gauze')?1:0}"`,'<ellipse cx="602" cy="389" rx="11" ry="8" fill="#bd6964" opacity=".55"/><path d="M607 398 Q602 408 609 408 Q616 406 607 398" fill="#bd6964"/>')}
    ${part('cold-pack', `opacity="${e.has('cold') ? 1 : 0}"`, '<rect x="584" y="374" width="37" height="28" rx="6" fill="#eee9da"/><rect x="589" y="379" width="27" height="18" rx="4" fill="#a5cddc"/><path d="M595 380 V396 M604 380 V396" stroke="#d8e8e9" stroke-width="2"/>')}
    ${part('scarf', `opacity="${id === 'cold' && !e.has('dry') ? 1 : 0}"`, '<path d="M570 306 Q593 313 614 305 L615 321 Q590 330 567 320Z" fill="#c57e77"/>')}
    ${part('blanket', `opacity="${e.has('blanket') ? 1 : 0}" transform="translate(0 ${e.has('blanket') ? 0 : -18}) rotate(0)"`, '<path d="M565 309 Q592 329 620 309 L690 466 Q636 482 554 463Z" fill="#b7c59c"/><path d="M580 329 L579 457 M600 332 L620 463 M621 350 L659 463" stroke="#d7dfbc" stroke-width="5"/><path d="M555 379 L646 379 647 390 553 391Z" fill="#d7dfbc"/>')}
    ${part('seat-insulation', `opacity="${e.has('insulated') ? 1 : 0}"`, '<path d="M551 376 H617 L628 387 H548Z" fill="#d6c6a7"/>')}
    ${part('monitor', `opacity="${e.has('observe') ? 1 : 0}"`, '<circle cx="702" cy="333" r="19" fill="#f8faee"/><path d="M689 333 Q702 317 715 333 Q702 349 689 333Z" fill="none" stroke="#789b80" stroke-width="2"/><circle cx="702" cy="333" r="4" fill="#789b80"/>')}
    ${attachedAids(id,e,{facts})}
  </g>`;
}

function lying(id,e,facts) {
  const side = e.has('side');
  const headAngle = side ? -72 : e.has('airway') ? -102 : -90;
  const compact=id!=='unconscious',blood=e.has('blood-position');
  const coat=id==='stroke'?'#c39b64':id==='bleeding'?'#6c9ca0':'#de8a7a';
  return `<g class="patient" data-character="patient" data-pose="${side ? 'side' : blood?'blood-supine':'supine'}" transform="${compact?'translate(176 65) scale(.84)':'translate(0 0) scale(1)'}">
    <ellipse cx="605" cy="478" rx="193" ry="9" fill="#7b819b" opacity=".16"/>
    ${part('leg-support',`opacity="${blood?1:0}"`,'<path d="M710 442 Q745 429 790 439 L795 460 H711Z" fill="#d6c6a7"/>')}
    ${leg('patient-far-leg', [589, 431], [675, 435], [764, blood?414:444], '#34456a')}
    ${leg('patient-near-leg', [588, 449], side ? [651, 501] : [676, 454], side ? [725, 467] : [765, blood?432:463], '#293a60')}
    ${arm('patient-far-arm', [493, 413], [539, 402], [584, 414], coat)}
    ${part('patient-torso', `d="M480 ${side ? 421 : 413} Q529 ${side ? 410 : 395} 592 423 L593 458 Q536 468 480 450 Z" fill="${coat}"`, '', 'path')}
    ${head('patient-head', `translate(482 429) rotate(${headAngle}) translate(0 -36)`, {mood:id==='bleeding'?'pain':e.has('signs')&&!e.has('recovered')?'cough':'closed',hair:id==='stroke'?'#827569':'#665b56'})}
    ${part('lying-blanket',`opacity="${blood?1:0}"`,'<path d="M490 417 L592 420 741 434 740 458 591 458 488 449Z" fill="#b7c59c"/><path d="M516 420 V450 M544 421 V453 M573 422 V454" stroke="#d7dfbc" stroke-width="4"/>')}
    ${arm('patient-injured-arm', [492, 441], side ? [484, 481] : [534, 472], side ? [432, 451] : [587, 475], coat)}
    ${part('lying-bandage',`opacity="${id==='bleeding'&&e.has('bandage')?1:0}"`,'<path d="M548 463 H578 V483 H548Z" fill="#fcfcf3"/><path d="M554 464 V482 M563 464 V482 M572 464 V482" stroke="#d6ddd7" stroke-width="2"/>')}
    ${part('breathing-mark', `opacity="${e.has('breathing') ? 1 : 0}"`, '<path class="breath-wave" d="M518 409 Q533 397 548 409 M521 401 Q533 391 545 401" stroke="#f9eed8" stroke-width="3" fill="none"/>')}
    ${attachedAids(id,e,{lying:true,facts})}
  </g>`;
}

// One well-supported kneeling pose per location; it never depends on a phase.
export function helperJoints(id) {
  return id === 'unconscious'
    ? {head:[390,284],left:[374,332],right:[402,332],far:[398,411],near:[315,405],farElbow:[420,374],nearElbow:[342,366]}
    : {head:[449,280],left:[433,329],right:[463,329],far:[505,411],near:[416,410],farElbow:[492,369],nearElbow:[417,370]};
}
function helper(id) {
  const p = helperJoints(id), gloves = id === 'bleeding';
  const lying = id === 'unconscious';
  return `<g class="helper" data-character="helper" data-pose="kneeling-static">
    ${leg('helper-far-leg', lying ? [329,411] : [432,416], lying ? [330,476] : [402,479], lying ? [274,480] : [348,480], '#34466a', true)}
    ${leg('helper-near-leg', lying ? [354,416] : [447,416], lying ? [398,423] : [505,423], lying ? [391,482] : [509,482], '#293a60')}
    ${arm('helper-far-arm', p.right, p.farElbow, p.far, '#e6eaf4', gloves)}
    ${part('helper-torso', `d="${lying ? 'M374 332 Q375 329 379 324 Q387 326 393 324 Q400 327 402 332 L369 417 Q342.5 425 316 413 Z' : 'M433 329 Q434 326 438 321 Q446 323 454 321 Q461 324 463 329 L462 417 Q440 425 418 413 Z'}" fill="#e6eaf4"`, '', 'path')}
    ${head('helper-head', `translate(${p.head.join(' ')}) rotate(7)`, {hair:'#92574d',profile:true,long:true})}
    ${arm('helper-near-arm', p.left, p.nearElbow, p.near, '#e6eaf4', gloves)}
  </g>`;
}
function phone(key, x, y, rotate, called, scale = 1) {
  return part(key, `transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})"`, `<rect x="-12" y="-23" width="24" height="43" rx="5" fill="#334e65"/><rect x="-9" y="-18" width="18" height="29" rx="2" fill="${called ? '#bdd5bc' : '#e4eaf0'}"/><text x="0" y="0" text-anchor="middle" fill="#3d605b" font-size="8" font-family="Arial">${called ? '✓' : '112'}</text><path d="M-4 15h8" stroke="#a8c4cc" stroke-width="2"/>`);
}
function witness(id) {
  if (id !== 'stroke' && id !== 'bleeding') return '';
  const wrist = [323,337];
  return `<g data-character="witness">
    ${leg('witness-far-leg',[277, 347],[264, 414],[264, 479],'#405b75')}
    ${leg('witness-near-leg',[291, 347],[304, 413],[310, 479],'#344b65')}
    ${arm('witness-far-arm',[263, 256],[246, 305],[257, 352],'#8eacb3')}
    ${torso('witness-torso',[263, 256],[299, 256],[264, 347],[304, 347],'#8eacb3')}
    ${head('witness-head','translate(282 214) rotate(0)',{hair:'#685f56'})}
    ${arm('witness-near-arm',[299,256],[327,292],wrist,'#8eacb3')}
    ${phone('witness-phone-body',323,331,8,false,.85)}
  </g>`;
}
export function characters(id, e, activePhase, facts={}) {
  const pose = currentPose(e, activePhase);
  return `${witness(id)}${id === 'unconscious'||e.has('collapsed')||e.has('blood-position') ? lying(id,e,facts) : seated(id,e,facts)}${helper(id)}${phone('phone',365,451,8,e.has('call'))}
    ${part('inspection',`opacity="${pose === 'safe' ? 1 : 0}"`,'<path d="M184 394 H809 Q826 394 826 411 V498 Q826 510 809 510 H184 Q170 510 170 496 V411 Q170 394 184 394Z" fill="none" stroke="#669586" stroke-width="3" stroke-dasharray="8 9"/>')}
    ${part('time-note',`opacity="${e.has('time') ? 1 : 0}"`,'<rect x="338" y="260" width="78" height="45" rx="6" fill="#fffdf6"/><path d="M348 270H406" stroke="#bdc7b1" stroke-width="2"/><text x="377" y="292" text-anchor="middle" fill="#426254" font-size="17">14:20</text>')}
    ${part('dry-clothes',`opacity="${e.has('dry') && !e.has('blanket') ? 1 : 0}"`,'<path d="M703 416 L720 408 731 418 741 411 755 424 744 440 737 435 736 461 713 461 713 435 706 440 695 425Z" fill="#7b9db7"/><path d="M714 470 L722 479 738 460" fill="none" stroke="#719675" stroke-width="4"/>')}
    ${clinicalOverlay(e,pose)}`;
}

export function characterTarget(level, target, effects = new Set()) {
  if (target === 'phone') return [36.5,80.5];
  if (target === 'kit') return [21.3,80.5];
  if (target === 'aed') return [81.5,68];
  if (target === 'note') return [69,62];
  if(effects.has('collapsed')||effects.has('blood-position')) {
    if(target==='head')return [48,69];
    if(['person','chest','support','wound'].includes(target))return [63,78];
  }
  if (level.id === 'unconscious') {
    if (target === 'head') return [38,70];
    if (target === 'person' || target === 'chest') return [53,78];
  }
  const bench = level.id === 'stroke' || level.id === 'cold';
  const targets = { area:[23,56], person:[59.3,bench ? 61 : 65], head:[66,bench ? 47 : 51], chest:[59.5,bench ? 61 : 65], wound:[60,69], support:level.id === 'stroke' ? [55,63] : [60,72], witness:[34.5,52], shelter:[82,49],blanket:[63,65] };
  return targets[target];
}
