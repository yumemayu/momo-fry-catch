(() => {
  const field = document.querySelector('#field');
  const stage = document.querySelector('.play-stage');
  const movesOutput = document.querySelector('#moves');
  const hudLevel = document.querySelector('#hud-level');
  const verdict = document.querySelector('#trap-verdict');
  const start = document.querySelector('#start');
  const stop = document.querySelector('#stop');
  const sound = document.querySelector('#sound');
  const levelButtons = Array.from(document.querySelectorAll('[data-level]'));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const SIZE = 9;
  const CENTER = 4;
  const levelConfig = {
    easy: { blocks: 12 },
    normal: { blocks: 8 },
    hard: { blocks: 5 }
  };
  const copy = {
    ja: {
      title: 'メガネ猫をかこもう！', retry: 'もういちど', on: 'おと ON', off: 'おと OFF',
      tile: 'マス', box: '箱', catHere: '猫',
      lines: { idle: 'にゃーん！', taunt: 'つかまえられないよ！', worried: 'あれ…？', caught: 'つかまった〜', bye: 'バイバイ！' },
      verdictWin: '猫を つかまえた！🎉', verdictEscape: '猫に にげられた！🐾'
    },
    en: {
      title: 'Trap the Glasses Cat', retry: 'Play again', on: 'Sound on', off: 'Sound off',
      tile: 'Tile', box: 'box', catHere: 'cat',
      lines: { idle: 'Meow!', taunt: "Can't catch me!", worried: 'Uh oh…', caught: 'You got me!', bye: 'Bye-bye!' },
      verdictWin: 'You trapped the cat! 🎉', verdictEscape: 'The cat escaped! 🐾'
    }
  };
  // The glasses-cat face from glasses-cat/cats.js, in the mock's warm beige.
  const catArt = `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M9 30 11 11 26 19 Q32 17 38 19 L53 11 55 30 C65 65 -1 65 9 30Z" fill="#f2c894" stroke="#57344a" stroke-width="2"/>
      <path d="M15 17 21 23 14 26Z M49 17 50 26 43 23Z" fill="#f987aa"/>
      <circle cx="23" cy="35" r="2.2" fill="#57344a"/><circle cx="41" cy="35" r="2.2" fill="#57344a"/>
      <path d="M28 43Q30 46 32 42Q34 46 37 43" fill="none" stroke="#57344a" stroke-width="2" stroke-linecap="round"/>
      <path d="M29 35h6" stroke="#493153" stroke-width="3"/><circle cx="22" cy="35" r="7" fill="none" stroke="#493153" stroke-width="3"/><circle cx="42" cy="35" r="7" fill="none" stroke="#493153" stroke-width="3"/>
      </svg>`;
  const boxArt = `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 22 16 10h32l10 12" fill="#e0aa6e" stroke="#57344a" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="6" y="22" width="52" height="34" rx="4" fill="#d9a066" stroke="#57344a" stroke-width="2.5"/>
      <path d="M6 34h52M32 22v34" stroke="#b57e42" stroke-width="4"/>
      <path d="M27 10h10l-2 12h-6Z" fill="#e8bc82" stroke="#b57e42" stroke-width="1.6"/>
      </svg>`;
  let language = 'en';
  let level = 'easy';
  let playing = false;
  let playedRound = false;
  let moves = 0;
  let blocked = new Set();
  let cat = { r: CENTER, c: CENTER };
  let lineKey = 'idle';
  let audio;
  let muted = false;
  const tiles = [];

  const key = (r, c) => r * SIZE + c;
  const inBoard = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const isEdge = (r, c) => r === 0 || c === 0 || r === SIZE - 1 || c === SIZE - 1;

  // Odd rows are shifted half a tile right (odd-r offset coordinates).
  function neighbors(r, c) {
    const deltas = r % 2 === 0
      ? [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
      : [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
    return deltas.map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => inBoard(nr, nc));
  }

  function shortestPathToEdge() {
    const startKey = key(cat.r, cat.c);
    const prev = new Map([[startKey, null]]);
    const queue = [[cat.r, cat.c]];
    while (queue.length) {
      const [r, c] = queue.shift();
      if (isEdge(r, c)) {
        const path = [];
        let k = key(r, c);
        while (k !== null) { path.unshift([Math.floor(k / SIZE), k % SIZE]); k = prev.get(k); }
        return path;
      }
      for (const [nr, nc] of neighbors(r, c)) {
        const nk = key(nr, nc);
        if (prev.has(nk) || blocked.has(nk)) continue;
        prev.set(nk, key(r, c));
        queue.push([nr, nc]);
      }
    }
    return null;
  }

  function catSurrounded() {
    if (isEdge(cat.r, cat.c)) return false;
    return neighbors(cat.r, cat.c).every(([r, c]) => blocked.has(key(r, c)));
  }

  const staticLabels = [['data-en', 'textContent'], ['data-en-label', 'aria-label'], ['data-en-placeholder', 'placeholder']]
    .flatMap(([data, property]) => Array.from(document.querySelectorAll('[' + data + ']'), element => ({
      element, property, en: element.getAttribute(data),
      ja: property === 'textContent' ? element.textContent : element.getAttribute(property)
    })));

  function renderLanguage() {
    document.documentElement.lang = language;
    document.title = copy[language].title + ' | Momo.squirrels';
    staticLabels.forEach(({ element, property, [language === 'ja' ? 'ja' : 'en']: value }) => {
      if (property === 'textContent') element.textContent = value;
      else element.setAttribute(property, value);
    });
    start.textContent = playedRound && !playing ? copy[language].retry : 'Play';
    sound.textContent = copy[language][muted ? 'off' : 'on'];
    const pressed = levelButtons.find(button => button.dataset.level === level);
    hudLevel.textContent = pressed ? pressed.lastElementChild.textContent : '';
    tiles.forEach(tile => labelTile(tile));
    updateBubble();
    gameScores.showLevel(level);
  }

  function ensureAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    try {
      audio ??= new Audio();
      if (audio.state !== 'running') audio.resume().catch(() => {});
      return audio;
    } catch { return null; }
  }

  function tone(freq, at, dur = .18, type = 'sine', vol = .12) {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + at;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(vol, startAt + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, startAt + dur);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(startAt);
    oscillator.stop(startAt + dur + .02);
  }

  function slide(from, to, at, dur, type = 'triangle', vol = .1) {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + at;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(to, startAt + dur);
    gain.gain.setValueAtTime(.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(vol, startAt + .03);
    gain.gain.exponentialRampToValueAtTime(.0001, startAt + dur);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(startAt);
    oscillator.stop(startAt + dur + .02);
  }

  function playPop() { tone(300, 0, .08, 'triangle', .12); tone(190, .04, .09, 'sine', .1); }
  function playMeow() { slide(540, 880, 0, .1); slide(880, 430, .1, .17); }
  function playWin() { [0, 4, 7, 12].forEach((n, i) => tone(523.25 * 2 ** (n / 12), i * .11, .3)); }
  function playEscape() { slide(680, 170, 0, .42, 'sawtooth', .05); slide(500, 140, .08, .4, 'triangle', .08); }

  function buildBoard() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tile';
        button.dataset.r = r;
        button.dataset.c = c;
        button.dataset.content = 'empty';
        button.style.left = ((c + (r % 2 ? .5 : 0)) / (SIZE + .5) * 100) + '%';
        button.style.top = (r / SIZE * 100) + '%';
        button.addEventListener('click', () => tapTile(r, c));
        tiles.push({ button, r, c });
        field.append(button);
      }
    }
  }

  function labelTile(tile) {
    const { r, c } = tile;
    let label = copy[language].tile + ' ' + (r + 1) + '-' + (c + 1);
    if (blocked.has(key(r, c))) label += ' · ' + copy[language].box;
    if (cat.r === r && cat.c === c) label += ' · ' + copy[language].catHere;
    tile.button.setAttribute('aria-label', label);
  }

  function updateBubble() {
    const bubble = field.querySelector('.cat-bubble');
    if (bubble) bubble.textContent = copy[language].lines[lineKey];
  }

  function render(hop = false) {
    for (const tile of tiles) {
      const { button, r, c } = tile;
      const content = blocked.has(key(r, c)) ? 'box' : (cat.r === r && cat.c === c) ? 'cat' : 'empty';
      if (button.dataset.content !== content) {
        button.dataset.content = content;
        button.classList.toggle('blocked', content === 'box');
        button.classList.toggle('has-cat', content === 'cat');
        if (content === 'box') button.innerHTML = boxArt;
        else if (content === 'cat') button.innerHTML = catArt + '<span class="cat-bubble" role="status"></span>';
        else button.innerHTML = '';
        if (content === 'cat' && hop && !reducedMotion.matches) {
          button.classList.remove('hop');
          void button.offsetWidth;
          button.classList.add('hop');
        }
      }
      button.disabled = !playing || content !== 'empty';
      labelTile(tile);
    }
    movesOutput.value = String(moves);
    updateBubble();
  }

  function newPuzzle() {
    blocked = new Set();
    const count = levelConfig[level].blocks;
    while (blocked.size < count) {
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (r === CENTER && c === CENTER) continue;
      blocked.add(key(r, c));
    }
    cat = { r: CENTER, c: CENTER };
    moves = 0;
    lineKey = 'idle';
    verdict.textContent = '';
    render();
  }

  function burst() {
    if (reducedMotion.matches) return;
    const rect = stage.getBoundingClientRect();
    for (let i = 0; i < 16; i++) {
      const star = document.createElement('span');
      star.className = 'burst-star';
      star.textContent = i % 3 ? '★' : '✦';
      star.style.left = '50%';
      star.style.top = '45%';
      star.style.setProperty('--dx', (Math.random() * 2 - 1) * rect.width * .45 + 'px');
      star.style.setProperty('--dy', (Math.random() * 2 - 1) * rect.height * .45 + 'px');
      stage.append(star);
      setTimeout(() => star.remove(), 1000);
    }
  }

  function tapTile(r, c) {
    if (!playing || blocked.has(key(r, c)) || (cat.r === r && cat.c === c)) return;
    blocked.add(key(r, c));
    moves++;
    playPop();
    if (catSurrounded()) { render(); endRound('win'); return; }
    moveCat();
  }

  function moveCat() {
    const path = shortestPathToEdge();
    if (path && path.length > 1) {
      const [nr, nc] = path[1];
      cat = { r: nr, c: nc };
      lineKey = 'taunt';
      playMeow();
      render(true);
      if (isEdge(nr, nc)) { lineKey = 'bye'; updateBubble(); endRound('escape'); return; }
      if (catSurrounded()) endRound('win');
      return;
    }
    // No way out: the cat is fenced in, so it dodges to a random open neighbor.
    const open = neighbors(cat.r, cat.c).filter(([r, c]) => !blocked.has(key(r, c)));
    if (!open.length) { render(); endRound('win'); return; }
    const [nr, nc] = open[Math.floor(Math.random() * open.length)];
    cat = { r: nr, c: nc };
    lineKey = 'worried';
    playMeow();
    render(true);
    if (catSurrounded()) endRound('win');
  }

  function setControls() {
    start.disabled = playing;
    stop.hidden = !playing;
    levelButtons.forEach(button => { button.disabled = playing; });
  }

  function begin() {
    if (playing) return;
    ensureAudio();
    gameScores.start(level);
    newPuzzle();
    playing = true;
    playedRound = true;
    setControls();
    render();
  }

  function endRound(result) {
    playing = false;
    if (result === 'win') {
      lineKey = 'caught';
      updateBubble();
      playWin();
      burst();
      verdict.textContent = copy[language].verdictWin;
      gameScores.finish(Math.max(200, 1000 - moves * 20), true);
    } else if (result === 'escape') {
      playEscape();
      verdict.textContent = copy[language].verdictEscape;
      gameScores.finish(0, false);
    } else {
      gameScores.finish(0, false);
      newPuzzle();
    }
    start.textContent = copy[language].retry;
    setControls();
    render();
    start.focus({ preventScroll: true });
  }

  levelButtons.forEach(button => button.addEventListener('click', () => {
    if (playing) return;
    level = button.dataset.level;
    levelButtons.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    newPuzzle();
    renderLanguage();
  }));

  start.addEventListener('click', begin);
  stop.addEventListener('click', () => { if (playing) endRound('stop'); });
  sound.addEventListener('click', () => {
    muted = !muted;
    sound.setAttribute('aria-pressed', String(!muted));
    sound.textContent = copy[language][muted ? 'off' : 'on'];
    if (!muted) tone(660, 0, .1, 'triangle', .08);
  });

  buildBoard();
  newPuzzle();
  setControls();
  momoLanguage.subscribe(code => { language = code; renderLanguage(); render(); });
})();
