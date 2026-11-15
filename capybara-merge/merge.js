(() => {
  const field = document.querySelector('#field');
  const ink = field.getContext('2d');
  const scoreOutput = document.querySelector('#score');
  const nextImage = document.querySelector('#next-piece');
  const guide = document.querySelector('#growth');
  const growthBest = document.querySelector('#growth-best');
  const notice = document.querySelector('#notice');
  const start = document.querySelector('#start');
  const stop = document.querySelector('#stop');
  const dropButton = document.querySelector('#drop');
  const left = document.querySelector('#left');
  const right = document.querySelector('#right');
  const sound = document.querySelector('#sound');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const width = 360;
  const height = 420;
  const wall = 15;
  const floor = 393;
  const limit = 88;
  const timestep = 1000 / 60;
  const saveKey = 'momo:capybara:best-stage';
  const languageKey = 'momo:capybara:language';
  const copy = {
    ja: {title:'カピバラ温泉マージ', growth:'いちばん育った姿', retry:'もういちど', on:'おと ON', off:'おと OFF',
      special:'ろてん風呂に とうちゃく！', full:'いっぱいになったよ。もういちど！', error:'ゲームを読みこめませんでした。ページを開きなおしてください。'},
    en: {title:'Capybara Onsen Merge', growth:'Biggest piece', retry:'Play again', on:'Sound on', off:'Sound off',
      special:'You made it to the outdoor bath!', full:'The bath is full. Try again!', error:'The game could not load. Please reload the page.'}
  };
  let language = navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'ja';
  try {
    const saved = localStorage.getItem(languageKey);
    if (saved === 'ja' || saved === 'en') language = saved;
  } catch {}
  const stages = [
    ['ゆず', 'Yuzu', 14], ['みかん', 'Mandarin', 18], ['おふろアヒル', 'Rubber duck', 23],
    ['あかちゃんカピバラ', 'Baby capybara', 29], ['こどもカピバラ', 'Young capybara', 35],
    ['おとなカピバラ', 'Adult capybara', 43], ['ゆずのせカピバラ', 'Capybara with yuzu', 50],
    ['てぬぐいカピバラ', 'Capybara with towel', 58], ['おけ風呂カピバラ', 'Wooden tub capybara', 67],
    ['ろてん風呂カピバラ', 'Outdoor bath capybara', 77]
  ].map(([ja, en, radius], index) => {
    const image = new Image(192, 192);
    image.src = 'pieces/' + (index + 1) + '.webp';
    const thumbnail = document.createElement('li');
    const icon = document.createElement('img');
    icon.src = image.src;
    icon.alt = language === 'en' ? en : ja;
    icon.width = icon.height = 48;
    thumbnail.append(icon);
    guide.append(thumbnail);
    return {ja, en, radius, image, thumbnail, icon};
  });
  const physics = window.Matter;
  let bestStage = 0;
  try {
    const saved = Number(localStorage.getItem(saveKey));
    if (Number.isInteger(saved) && saved >= 0 && saved <= stages.length) bestStage = saved;
  } catch {}

  function renderGrowth() {
    stages.forEach(({thumbnail, icon, [language]: name}, index) => {
      thumbnail.classList.toggle('seen', index < bestStage);
      icon.alt = name;
    });
    growthBest.textContent = copy[language].growth + ': ' + (stages[bestStage - 1]?.[language] ?? '—');
  }
  let engine;
  let playing = false;
  let score = 0;
  let biggest = 0;
  let current = 0;
  let next = 1;
  let aim = width / 2;
  let pointer = null;
  let cooldown = 0;
  let overTime = 0;
  let age = 0;
  let lastTime = null;
  let backlog = 0;
  let frame = null;
  let audio;
  let muted = false;
  let playedRound = false;
  let noticeKey = '';
  const finalGrowth = document.querySelector('#final-growth');
  const languageButtons = document.querySelectorAll('[data-language]');
  const staticLabels = [['data-en', 'textContent'], ['data-en-label', 'aria-label'], ['data-en-placeholder', 'placeholder']]
    .flatMap(([data, property]) => Array.from(document.querySelectorAll('[' + data + ']'), element => ({
      element, property, en: element.getAttribute(data),
      ja: property === 'textContent' ? element.textContent : element.getAttribute(property)
    })));

  function setNotice(key) {
    noticeKey = key;
    notice.textContent = copy[language][key] ?? '';
  }

  function renderLanguage() {
    document.documentElement.lang = language;
    document.title = copy[language].title + ' | Momo.squirrels';
    languageButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
    staticLabels.forEach(({element, property, [language]: value}) => {
      if (property === 'textContent') element.textContent = value;
      else element.setAttribute(property, value);
    });
    renderGrowth();
    updateNext();
    setNotice(noticeKey);
    start.textContent = playedRound && !playing ? copy[language].retry : 'Play';
    sound.textContent = copy[language][muted ? 'off' : 'on'];
    finalGrowth.textContent = playedRound && !playing && biggest ? copy[language].growth + ': ' + stages[biggest - 1][language] : '';
    gameScores.setStageFormatter?.((stage, fallback) => stages[stage - 1]?.[language] ?? fallback);
  }
  const pieces = new Map();
  const pairs = [];
  const effects = [];

  function queuePiece() {
    const draw = Math.random();
    return draw < .54 ? 0 : draw < .87 ? 1 : 2;
  }

  function updateNext() {
    nextImage.src = stages[next].image.src;
    nextImage.alt = stages[next][language];
  }

  function playChime(stage, special) {
    if (muted) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      audio ??= new Audio();
      if (audio.state !== 'running') audio.resume().catch(() => {});
      if (stage === undefined) return;
      const pitch = 329.63 * 2 ** (stage / 12);
      const notes = special ? [0, 4, 7, 12] : [0];
      notes.forEach((offset, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const at = audio.currentTime + index * .11;
        oscillator.frequency.setValueAtTime(pitch * 2 ** (offset / 12), at);
        gain.gain.setValueAtTime(.0001, at);
        gain.gain.exponentialRampToValueAtTime(.12, at + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, at + .31);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(at);
        oscillator.stop(at + .32);
      });
    } catch {}
  }

  function markStage(index) {
    const stage = index + 1;
    biggest = Math.max(biggest, stage);
    if (stage <= bestStage) return;
    bestStage = stage;
    try { localStorage.setItem(saveKey, String(stage)); } catch {}
    renderGrowth();
  }

  function buildWorld() {
    if (engine) physics.Events.off(engine);
    engine = physics.Engine.create({positionIterations: 9, velocityIterations: 7});
    engine.gravity.y = 1.2;
    const barrier = {isStatic: true, friction: .17, restitution: .04};
    physics.Composite.add(engine.world, [
      physics.Bodies.rectangle(width / 2, floor + 18, width, 36, barrier),
      physics.Bodies.rectangle(wall - 12, height / 2, 24, height * 2, barrier),
      physics.Bodies.rectangle(width - wall + 12, height / 2, 24, height * 2, barrier)
    ]);
    const gather = event => {
      for (const {bodyA, bodyB} of event.pairs) {
        const first = pieces.get(bodyA.id);
        const second = pieces.get(bodyB.id);
        if (first && second && first.stage === second.stage && first.stage < stages.length - 1) {
          pairs.push([first, second]);
        }
      }
    };
    physics.Events.on(engine, 'collisionStart collisionActive', gather);
  }

  function insert(stage, x, y) {
    const radius = stages[stage].radius;
    const body = physics.Bodies.circle(clampAim(x, radius), y, radius, {
      friction: .21, frictionAir: .016, restitution: .12, density: .0012, slop: .03
    }, Math.max(24, Math.round(radius / 1.8)));
    const piece = {body, stage, born: age};
    pieces.set(body.id, piece);
    physics.Composite.add(engine.world, body);
    markStage(stage);
    return piece;
  }

  function clampAim(x, radius = stages[current].radius) {
    return Math.max(wall + radius + 1, Math.min(width - wall - radius - 1, x));
  }

  function remove(piece) {
    pieces.delete(piece.body.id);
    physics.Composite.remove(engine.world, piece.body);
  }

  function mergePairs() {
    for (const [first, second] of pairs) {
      const a = first.body;
      const b = second.body;
      if (!pieces.has(a.id) || !pieces.has(b.id)) continue;
      const stage = first.stage + 1;
      const radius = stages[stage].radius;
      const x = (a.position.x + b.position.x) / 2;
      const y = Math.min((a.position.y + b.position.y) / 2, floor - radius);
      const vx = (a.velocity.x + b.velocity.x) * .3;
      const vy = (a.velocity.y + b.velocity.y) * .3;
      remove(first);
      remove(second);
      const merged = insert(stage, x, y);
      physics.Body.setVelocity(merged.body, {x: vx, y: vy});
      score += (stage + 1) * (stage + 2) / 2;
      scoreOutput.value = score;
      const special = stage === stages.length - 1;
      effects.push({x: merged.body.position.x, y, stage, at: age, special});
      playChime(stage, special);
      if (special) setNotice('special');
    }
    pairs.length = 0;
  }

  function stepWorld() {
    age += timestep;
    physics.Engine.update(engine, timestep);
    mergePairs();
    const backedUp = [...pieces.values()].some(({body, stage, born}) =>
      age - born > 550 && body.position.y - stages[stage].radius < limit && Math.abs(body.velocity.y) < 1.5);
    overTime = backedUp ? overTime + timestep : 0;
    if (overTime >= 2000) finish(true);
  }

  function setControls() {
    left.disabled = right.disabled = dropButton.disabled = !playing;
    start.disabled = playing || !physics;
    stop.hidden = !playing;
  }

  function begin() {
    if (playing || !physics) return;
    buildWorld();
    pieces.clear();
    effects.length = pairs.length = 0;
    score = biggest = age = backlog = overTime = cooldown = 0;
    lastTime = pointer = null;
    current = queuePiece();
    next = queuePiece();
    aim = width / 2;
    playing = true;
    scoreOutput.value = 0;
    setNotice('');
    finalGrowth.textContent = '';
    start.textContent = 'Play';
    gameScores.start();
    updateNext();
    setControls();
    playChime();
    field.focus({preventScroll: true});
    if (frame === null) frame = requestAnimationFrame(tick);
  }

  function finish(completed) {
    playing = false;
    pointer = null;
    playedRound = true;
    finalGrowth.textContent = biggest ? copy[language].growth + ': ' + stages[biggest - 1][language] : '';
    gameScores.finish(score, completed, {stage: biggest, stageName: stages[biggest - 1]?.ja});
    setNotice(completed ? 'full' : '');
    start.textContent = copy[language].retry;
    setControls();
    start.focus({preventScroll: true});
  }

  function drop() {
    if (!playing || age < cooldown) return;
    insert(current, aim, limit - 36);
    cooldown = age + 370;
    current = next;
    next = queuePiece();
    aim = clampAim(aim);
    updateNext();
  }

  function drawPiece(stage, x, y, angle) {
    const {image, radius} = stages[stage];
    ink.save();
    ink.translate(x, y);
    ink.rotate(angle);
    if (image.complete && image.naturalWidth) {
      ink.drawImage(image, -radius, -radius, radius * 2, radius * 2);
    } else {
      ink.fillStyle = ['#ffda73', '#ffa86e', '#ffe18a'][stage] ?? '#dfad91';
      ink.beginPath();
      ink.arc(0, 0, radius * .94, 0, Math.PI * 2);
      ink.fill();
    }
    ink.restore();
  }

  function drawBoard() {
    const bounds = field.getBoundingClientRect();
    const density = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(bounds.width * density));
    const pixelHeight = Math.max(1, Math.round(bounds.height * density));
    if (field.width !== pixelWidth) field.width = pixelWidth;
    if (field.height !== pixelHeight) field.height = pixelHeight;
    ink.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    ink.fillStyle = '#fff2e7';
    ink.fillRect(0, 0, width, height);
    ink.fillStyle = '#f3d4b7';
    ink.fillRect(0, 0, wall, height);
    ink.fillRect(width - wall, 0, wall, height);
    ink.fillRect(0, floor, width, height - floor);
    ink.fillStyle = '#d9edeb';
    ink.fillRect(wall, floor - 43, width - wall * 2, 43);
    ink.strokeStyle = '#fff9f1';
    ink.lineWidth = 2;
    for (const x of [40, 107, 179, 247]) {
      ink.beginPath();
      ink.moveTo(x, floor - 21);
      ink.quadraticCurveTo(x + 14, floor - 17, x + 38, floor - 21);
      ink.stroke();
    }
    ink.strokeStyle = overTime > 0 ? '#ce638b' : '#be9bd1';
    ink.lineWidth = 2.5;
    ink.lineCap = 'round';
    ink.setLineDash([1, 9]);
    ink.beginPath();
    ink.moveTo(wall + 8, limit);
    ink.lineTo(width - wall - 8, limit);
    ink.stroke();
    ink.setLineDash([]);
    if (playing) {
      ink.globalAlpha = age < cooldown ? .35 : .70;
      ink.strokeStyle = '#c2a0cc';
      ink.setLineDash([3, 7]);
      ink.beginPath();
      ink.moveTo(aim, limit);
      ink.lineTo(aim, floor);
      ink.stroke();
      ink.setLineDash([]);
      drawPiece(current, aim, limit - 36, 0);
      ink.globalAlpha = 1;
    }
    for (const {body, stage} of pieces.values()) {
      drawPiece(stage, body.position.x, body.position.y, body.angle);
    }
    drawEffects();
  }

  function drawEffects() {
    if (reducedMotion.matches) {
      effects.length = 0;
      return;
    }
    const sparkColors = ['#d495cd', '#e9a279', '#f6c558'];
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      const elapsed = (age - effect.at) / (effect.special ? 960 : 420);
      if (elapsed >= 1) {
        effects.splice(i, 1);
        continue;
      }
      ink.globalAlpha = 1 - elapsed;
      const count = effect.special ? 16 : 6;
      for (let p = 0; p < count; p++) {
        const angle = p / count * Math.PI * 2;
        const distance = stages[effect.stage].radius * .72 + elapsed * (effect.special ? 64 : 19);
        const x = effect.x + Math.cos(angle) * distance;
        const y = effect.y + Math.sin(angle) * distance - elapsed * 14;
        ink.fillStyle = sparkColors[p % sparkColors.length];
        ink.beginPath();
        ink.arc(x, y, effect.special ? 3 : 2.5, 0, Math.PI * 2);
        ink.fill();
      }
      ink.globalAlpha = 1;
    }
  }

  function tick(time) {
    frame = null;
    if (lastTime !== null) backlog += Math.min(50, time - lastTime);
    lastTime = time;
    while (playing && backlog >= timestep) {
      backlog -= timestep;
      stepWorld();
    }
    drawBoard();
    if (playing) frame = requestAnimationFrame(tick);
  }

  function aimPointer(event) {
    const bounds = field.getBoundingClientRect();
    aim = clampAim((event.clientX - bounds.left) / bounds.width * width);
  }

  field.addEventListener('pointerdown', event => {
    if (!playing || pointer !== null || event.button !== 0) return;
    pointer = event.pointerId;
    aimPointer(event);
    field.setPointerCapture(pointer);
  });
  field.addEventListener('pointermove', event => {
    if (playing && (event.pointerId === pointer || (pointer === null && event.pointerType === 'mouse'))) aimPointer(event);
  });
  field.addEventListener('pointerup', event => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    aimPointer(event);
    drop();
  });
  field.addEventListener('lostpointercapture', () => { pointer = null; });
  field.addEventListener('keydown', event => {
    if (!playing || !['ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      aim = clampAim(aim + (event.key === 'ArrowLeft' ? -12 : 12));
    } else if (!event.repeat) drop();
  });
  left.addEventListener('click', () => { aim = clampAim(aim - 17); });
  right.addEventListener('click', () => { aim = clampAim(aim + 17); });
  dropButton.addEventListener('click', drop);
  start.addEventListener('click', begin);
  stop.addEventListener('click', () => finish(false));
  sound.addEventListener('click', () => {
    muted = !muted;
    sound.setAttribute('aria-pressed', String(!muted));
    sound.textContent = copy[language][muted ? 'off' : 'on'];
    if (!muted) playChime();
  });
  languageButtons.forEach(button => button.addEventListener('click', () => {
    language = button.dataset.language;
    try { localStorage.setItem(languageKey, language); } catch {}
    renderLanguage();
  }));
  if (!physics) setNotice('error');
  setControls();
  renderLanguage();
  new ResizeObserver(drawBoard).observe(field);
  drawBoard();
})();
