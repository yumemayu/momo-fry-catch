(() => {
  const board = document.querySelector('#board');
  const stage = document.querySelector('.play-stage');
  const wallsYouOutput = document.querySelector('#walls-you');
  const wallsCatOutput = document.querySelector('#walls-cat');
  const movesOutput = document.querySelector('#moves');
  const turnLine = document.querySelector('#turn-line');
  const verdict = document.querySelector('#quoridor-verdict');
  const start = document.querySelector('#start');
  const stop = document.querySelector('#stop');
  const sound = document.querySelector('#sound');
  const levelButtons = Array.from(document.querySelectorAll('[data-level]'));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Board geometry, in percent of the square board (see quoridor.css).
  const FRAME = 3;
  const CELL = (100 - FRAME * 2) / (9 + 8 * 0.16);
  const GROOVE = CELL * 0.16;
  const cellAt = i => FRAME + i * (CELL + GROOVE);
  const grooveAfter = i => cellAt(i) + CELL;

  const PLAYER_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="25" r="13" fill="#fff5fa" stroke="#a7195b" stroke-width="3"/><path d="M17 57c1-10 7-15 15-15s14 5 15 15z" fill="#f272a7" stroke="#a7195b" stroke-width="3"/><circle cx="27" cy="24" r="2.2" fill="#57344a"/><circle cx="37" cy="24" r="2.2" fill="#57344a"/><path d="M28 30q4 3 8 0" fill="none" stroke="#57344a" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const CAT_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 21 22 8l8 7M44 21 42 8l-8 7" fill="#4a3550" stroke="#2e2135" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="27" r="14" fill="#4a3550" stroke="#2e2135" stroke-width="3"/><path d="M15 58c1-10 8-16 17-16s16 6 17 16z" fill="#4a3550" stroke="#2e2135" stroke-width="3"/><circle cx="26.5" cy="26" r="2.4" fill="#ffe98f"/><circle cx="37.5" cy="26" r="2.4" fill="#ffe98f"/><path d="M29 33q3 2.4 6 0" fill="none" stroke="#ffe98f" stroke-width="2.2" stroke-linecap="round"/><path d="M13 31h8M14.5 37l7-2M51 31h-8M49.5 37l-7-2" stroke="#ffe98f" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const copy = {
    ja: {
      retry: 'もういちど', on: 'おと ON', off: 'おと OFF',
      yourTurn: 'あなたの ばん！', catTurn: 'ねこが かんがえ中…',
      preview: 'もう一度 タップで かべを おく！',
      win: '勝った！ むこう岸に ついた！🎉', lose: 'ねこが 先に ついちゃった！🐾',
      wall: 'かべ', cell: 'マス'
    },
    en: {
      retry: 'Play again', on: 'Sound on', off: 'Sound off',
      yourTurn: 'Your turn!', catTurn: 'The cat is thinking…',
      preview: 'Tap the wall again to place it!',
      win: 'You win! You reached the far side! 🎉', lose: 'The cat got there first! 🐾',
      wall: 'Wall', cell: 'Square'
    }
  };
  const aiConfig = {
    easy: { wallChance: 0.12, samples: 6, randomMove: 0.3 },
    normal: { wallChance: 0.35, samples: 14, randomMove: 0.05 },
    hard: { wallChance: 0.55, samples: 40, randomMove: 0 }
  };

  let language = 'en';
  let level = 'easy';
  let playing = false;
  let playedRound = false;
  let busy = false;
  let player = { r: 8, c: 4 };
  let cat = { r: 0, c: 4 };
  let wallsH = new Set();
  let wallsV = new Set();
  let wallsLeft = { you: 10, cat: 10 };
  let moves = 0;
  let preview = null;
  let cells = [];
  let playerPawn = null;
  let catPawn = null;
  let audio;
  let muted = false;

  const key = (r, c) => r + ',' + c;
  const posKey = p => key(p.r, p.c);

  const staticLabels = [['data-en', 'textContent'], ['data-en-label', 'aria-label'], ['data-en-placeholder', 'placeholder']]
    .flatMap(([data, property]) => Array.from(document.querySelectorAll('[' + data + ']'), element => ({
      element, property, en: element.getAttribute(data),
      ja: property === 'textContent' ? element.textContent : element.getAttribute(property)
    })));

  function renderLanguage() {
    document.documentElement.lang = language;
    staticLabels.forEach(({ element, property, [language === 'ja' ? 'ja' : 'en']: value }) => {
      if (property === 'textContent') element.textContent = value;
      else element.setAttribute(property, value);
    });
    start.textContent = playedRound && !playing ? copy[language].retry : 'Play';
    sound.textContent = copy[language][muted ? 'off' : 'on'];
    cells.forEach((row, r) => row.forEach((cell, c) => {
      cell.setAttribute('aria-label', copy[language].cell + ' ' + (r + 1) + '-' + (c + 1));
    }));
    gameScores.showLevel(level);
    render();
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

  function playStep() { tone(560, 0, .08, 'triangle', .09); }
  function playPeek() { tone(880, 0, .06, 'sine', .06); }
  function playWall() { tone(185, 0, .13, 'triangle', .14); tone(120, .02, .12, 'sine', .1); }
  function playWin() { [0, 4, 7, 12].forEach((n, i) => tone(523.25 * 2 ** (n / 12), i * .11, .3)); }
  function playLose() { tone(330, 0, .22, 'sine', .1); tone(196, .16, .34, 'sine', .1); }

  // ---- Rules -------------------------------------------------------------
  // A horizontal wall anchored (r, c) lies in the groove below row r and
  // spans columns c..c+1; a vertical wall lies right of column c and
  // spans rows r..r+1. Anchors run 0..7 on both axes.
  function blockedBetween(r1, c1, r2, c2) {
    if (r2 === r1 + 1) return wallsH.has(key(r1, c1)) || wallsH.has(key(r1, c1 - 1));
    if (r2 === r1 - 1) return wallsH.has(key(r2, c1)) || wallsH.has(key(r2, c1 - 1));
    if (c2 === c1 + 1) return wallsV.has(key(r1, c1)) || wallsV.has(key(r1 - 1, c1));
    if (c2 === c1 - 1) return wallsV.has(key(r1, c2)) || wallsV.has(key(r1 - 1, c2));
    return true;
  }

  function plainNeighbors(p) {
    const out = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = p.r + dr, c = p.c + dc;
      if (r < 0 || r > 8 || c < 0 || c > 8) continue;
      if (!blockedBetween(p.r, p.c, r, c)) out.push({ r, c });
    }
    return out;
  }

  // Shortest route to any cell of goalRow, pawns treated as passable.
  function bfs(startPos, goalRow) {
    const dist = new Map([[posKey(startPos), 0]]);
    const prev = new Map();
    const queue = [startPos];
    while (queue.length) {
      const cur = queue.shift();
      const d = dist.get(posKey(cur));
      if (cur.r === goalRow) return { dist: d, prev, end: cur };
      for (const n of plainNeighbors(cur)) {
        const k = posKey(n);
        if (!dist.has(k)) { dist.set(k, d + 1); prev.set(k, cur); queue.push(n); }
      }
    }
    return { dist: Infinity, prev, end: null };
  }

  // Legal pawn moves, including the jump over a facing opponent and the
  // diagonal sidesteps when that jump is walled off or off the board.
  function legalMoves(pos, opp) {
    const out = [];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = pos.r + dr, nc = pos.c + dc;
      if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
      if (blockedBetween(pos.r, pos.c, nr, nc)) continue;
      if (nr !== opp.r || nc !== opp.c) { out.push({ r: nr, c: nc }); continue; }
      const jr = nr + dr, jc = nc + dc;
      let jumped = false;
      if (jr >= 0 && jr <= 8 && jc >= 0 && jc <= 8 && !blockedBetween(nr, nc, jr, jc)) {
        out.push({ r: jr, c: jc });
        jumped = true;
      }
      if (!jumped) {
        const perps = dr === 0 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
        for (const [pr, pc] of perps) {
          const ar = nr + pr, ac = nc + pc;
          if (ar < 0 || ar > 8 || ac < 0 || ac > 8) continue;
          if (!blockedBetween(nr, nc, ar, ac)) out.push({ r: ar, c: ac });
        }
      }
    }
    return out;
  }

  function wallLegal(r, c, o) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    const set = o === 'h' ? wallsH : wallsV;
    const other = o === 'h' ? wallsV : wallsH;
    if (set.has(key(r, c)) || other.has(key(r, c))) return false;
    if (o === 'h' && (wallsH.has(key(r, c - 1)) || wallsH.has(key(r, c + 1)))) return false;
    if (o === 'v' && (wallsV.has(key(r - 1, c)) || wallsV.has(key(r + 1, c)))) return false;
    set.add(key(r, c));
    const ok = bfs(player, 0).dist !== Infinity && bfs(cat, 8).dist !== Infinity;
    set.delete(key(r, c));
    return ok;
  }

  // ---- Cat AI --------------------------------------------------------------
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function findCatWall(samples) {
    const pathInfo = bfs(player, 0);
    const pathCells = [];
    let cur = pathInfo.end;
    while (cur) { pathCells.push(cur); cur = pathInfo.prev.get(posKey(cur)); }
    pathCells.push(player);
    const candidates = new Map();
    for (const cell of pathCells) {
      for (const dr of [-1, 0]) for (const dc of [-1, 0]) {
        candidates.set('h:' + (cell.r + dr) + ',' + (cell.c + dc), { r: cell.r + dr, c: cell.c + dc, o: 'h' });
        candidates.set('v:' + (cell.r + dr) + ',' + (cell.c + dc), { r: cell.r + dr, c: cell.c + dc, o: 'v' });
      }
    }
    const basePlayer = pathInfo.dist;
    const baseCat = bfs(cat, 8).dist;
    let bestWall = null;
    let bestScore = 0;
    for (const w of shuffle([...candidates.values()]).slice(0, samples)) {
      if (!wallLegal(w.r, w.c, w.o)) continue;
      const set = w.o === 'h' ? wallsH : wallsV;
      set.add(key(w.r, w.c));
      const gain = bfs(player, 0).dist - basePlayer;
      const cost = Math.max(0, bfs(cat, 8).dist - baseCat);
      set.delete(key(w.r, w.c));
      const score = gain - cost;
      if (score > bestScore) { bestScore = score; bestWall = w; }
    }
    return bestWall;
  }

  function catPlay() {
    const cfg = aiConfig[level];
    const options = legalMoves(cat, player);
    if (!options.length) return;
    if (wallsLeft.cat > 0 && bfs(cat, 8).dist > 1 && Math.random() < cfg.wallChance) {
      const wall = findCatWall(cfg.samples);
      if (wall) {
        (wall.o === 'h' ? wallsH : wallsV).add(key(wall.r, wall.c));
        wallsLeft.cat--;
        playWall();
        return;
      }
    }
    let next;
    if (Math.random() < cfg.randomMove) {
      next = options[Math.floor(Math.random() * options.length)];
    } else {
      const scored = options.map(m => ({ m, d: bfs(m, 8).dist }));
      const best = Math.min(...scored.map(s => s.d));
      const ties = scored.filter(s => s.d === best).map(s => s.m);
      next = ties[Math.floor(Math.random() * ties.length)];
    }
    cat = next;
    playStep();
  }

  // ---- Rendering -----------------------------------------------------------
  function wallStyle(r, c, o) {
    if (o === 'h') {
      return { left: cellAt(c), top: grooveAfter(r), width: CELL * 2 + GROOVE, height: GROOVE };
    }
    return { left: grooveAfter(c), top: cellAt(r), width: GROOVE, height: CELL * 2 + GROOVE };
  }

  function applyBox(el, box) {
    el.style.left = box.left + '%';
    el.style.top = box.top + '%';
    el.style.width = box.width + '%';
    el.style.height = box.height + '%';
  }

  function buildBoard() {
    board.replaceChildren();
    cells = [];
    for (let r = 0; r < 9; r++) {
      const row = [];
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'qcell' + (r === 0 ? ' goal' : '');
        applyBox(cell, { left: cellAt(c), top: cellAt(r), width: CELL, height: CELL });
        cell.setAttribute('aria-label', copy[language].cell + ' ' + (r + 1) + '-' + (c + 1));
        cell.addEventListener('click', () => onCell(r, c));
        board.append(cell);
        row.push(cell);
      }
      cells.push(row);
    }
    playerPawn = document.createElement('div');
    playerPawn.className = 'qpawn';
    playerPawn.innerHTML = PLAYER_SVG;
    catPawn = document.createElement('div');
    catPawn.className = 'qpawn';
    catPawn.innerHTML = CAT_SVG;
    board.append(playerPawn, catPawn);
    render();
  }

  function placePawn(el, pos) {
    const size = CELL * 0.94;
    el.style.width = size + '%';
    el.style.height = size + '%';
    el.style.left = (cellAt(pos.c) + (CELL - size) / 2) + '%';
    el.style.top = (cellAt(pos.r) + (CELL - size) / 2) + '%';
  }

  function render() {
    const myTurn = playing && !busy;
    const targets = myTurn ? legalMoves(player, cat) : [];
    cells.forEach((row, r) => row.forEach((cell, c) => {
      const isTarget = targets.some(t => t.r === r && t.c === c);
      cell.classList.toggle('target', isTarget);
      cell.disabled = !isTarget;
    }));
    board.querySelectorAll('.qslot, .qwall').forEach(el => el.remove());
    for (const k of wallsH) {
      const [r, c] = k.split(',').map(Number);
      const el = document.createElement('div');
      el.className = 'qwall';
      applyBox(el, wallStyle(r, c, 'h'));
      board.append(el);
    }
    for (const k of wallsV) {
      const [r, c] = k.split(',').map(Number);
      const el = document.createElement('div');
      el.className = 'qwall';
      applyBox(el, wallStyle(r, c, 'v'));
      board.append(el);
    }
    if (preview) {
      const el = document.createElement('div');
      el.className = 'qwall preview';
      applyBox(el, wallStyle(preview.r, preview.c, preview.o));
      board.append(el);
    }
    if (myTurn && wallsLeft.you > 0) {
      const thick = GROOVE + 3.4;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        for (const o of ['h', 'v']) {
          if (!wallLegal(r, c, o)) continue;
          const slot = document.createElement('button');
          slot.type = 'button';
          slot.className = 'qslot';
          slot.setAttribute('aria-label', copy[language].wall + ' ' + (r + 1) + '-' + (c + 1));
          if (o === 'h') {
            applyBox(slot, { left: cellAt(c), top: grooveAfter(r) + GROOVE / 2 - thick / 2, width: CELL * 2 + GROOVE, height: thick });
          } else {
            applyBox(slot, { left: grooveAfter(c) + GROOVE / 2 - thick / 2, top: cellAt(r), width: thick, height: CELL * 2 + GROOVE });
          }
          slot.addEventListener('click', () => onSlot(r, c, o));
          board.append(slot);
        }
      }
    }
    if (playerPawn) placePawn(playerPawn, player);
    if (catPawn) placePawn(catPawn, cat);
    turnLine.textContent = !playing ? '' : busy ? copy[language].catTurn
      : preview ? copy[language].preview : copy[language].yourTurn;
    updateStats();
  }

  function updateStats() {
    wallsYouOutput.value = wallsLeft.you;
    wallsCatOutput.value = wallsLeft.cat;
    movesOutput.value = moves;
  }

  function setControls() {
    start.disabled = playing;
    stop.hidden = !playing;
    levelButtons.forEach(button => { button.disabled = playing; });
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

  // ---- Flow ------------------------------------------------------------------
  function onCell(r, c) {
    if (!playing || busy) return;
    if (!legalMoves(player, cat).some(t => t.r === r && t.c === c)) return;
    preview = null;
    player = { r, c };
    playStep();
    afterPlayerAction();
  }

  function onSlot(r, c, o) {
    if (!playing || busy) return;
    if (preview && preview.r === r && preview.c === c && preview.o === o) {
      (o === 'h' ? wallsH : wallsV).add(key(r, c));
      wallsLeft.you--;
      preview = null;
      playWall();
      afterPlayerAction();
    } else {
      preview = { r, c, o };
      playPeek();
      render();
    }
  }

  function afterPlayerAction() {
    moves++;
    if (player.r === 0) { finishGame(true); return; }
    busy = true;
    render();
    setTimeout(() => {
      catPlay();
      if (cat.r === 8) { busy = false; finishGame(false); return; }
      busy = false;
      render();
    }, 550);
  }

  function begin() {
    if (playing) return;
    ensureAudio();
    gameScores.start(level);
    player = { r: 8, c: 4 };
    cat = { r: 0, c: 4 };
    wallsH = new Set();
    wallsV = new Set();
    wallsLeft = { you: 10, cat: 10 };
    moves = 0;
    preview = null;
    busy = false;
    verdict.textContent = '';
    playing = true;
    playedRound = true;
    buildBoard();
    setControls();
    updateStats();
  }

  function finishGame(won) {
    playing = false;
    busy = false;
    preview = null;
    render();
    verdict.textContent = copy[language][won ? 'win' : 'lose'];
    if (won) { playWin(); burst(); } else playLose();
    gameScores.finish(won ? Math.max(200, 1000 - moves * 15) : 0, won);
    start.textContent = copy[language].retry;
    setControls();
    start.focus({ preventScroll: true });
  }

  function stopGame() {
    if (!playing) return;
    playing = false;
    busy = false;
    preview = null;
    render();
    verdict.textContent = '';
    gameScores.finish(0, false);
    start.textContent = copy[language].retry;
    setControls();
  }

  levelButtons.forEach(button => button.addEventListener('click', () => {
    if (playing) return;
    level = button.dataset.level;
    levelButtons.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    gameScores.showLevel(level);
  }));

  start.addEventListener('click', begin);
  stop.addEventListener('click', stopGame);
  sound.addEventListener('click', () => {
    muted = !muted;
    sound.setAttribute('aria-pressed', String(!muted));
    sound.textContent = copy[language][muted ? 'off' : 'on'];
    if (!muted) tone(660, 0, .1, 'triangle', .08);
  });

  buildBoard();
  setControls();
  momoLanguage.subscribe(code => { language = code; renderLanguage(); });
})();
