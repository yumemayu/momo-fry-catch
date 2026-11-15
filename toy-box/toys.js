const one = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const copy = (en, ja) => momoLanguage.pick(en, ja);
const tabs = all('[data-toy]');
function select(buttons, selected) {
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button === selected)));
}
tabs.forEach(button => button.addEventListener('click', () => {
  select(tabs, button);
  all('.toy').forEach(panel => { panel.hidden = panel.id !== button.dataset.toy; });
}));

const stickerCatalog = [
  ['bun-light', '🏮', 'Bun Lights', '肉まんライト', 'Mix two colors', '２色をまぜる'],
  ['ribbon', '🎀', 'MOMO ribbon', 'MOMOのリボン', 'Type the secret word', 'ひみつの言葉を入力'],
  ['puppy', '🐾', 'Cloud dog', '雲の犬', 'Copy the first sequence', '最初のまねっこをクリア'],
  ['fries', '🍟', 'Fry Catch', 'フライキャッチ'],
  ['buns', '🥟', 'Smiley Bun Catch', 'にこにこ肉まんキャッチ'],
  ['cats', '🐱', 'Find the Glasses Cat', 'メガネ猫さがし'],
  ['piano', '🎹', 'MOMO Piano', 'MOMOピアノ', 'Finish a song', '１曲最後まで弾く'],
  ['capybara', '♨️', 'Capybara Onsen Merge', 'カピバラ温泉マージ'],
  ['capybara-memory', '🃏', 'Capybara Memory', 'カピバラ神経衰弱'],
  ['capybara-tap', '🫧', 'Capybara Bath Tap', 'カピバラおふろタップ'],
  ['cat-trap', '📦', 'Trap the Cat', 'ねこをかこもう！', 'Trap the cat', 'ねこを囲む'],
];
function stickerEntry([id, icon, en, ja, taskEn = 'Finish a round', taskJa = '１ラウンド最後まで遊ぶ']) {
  const earned = momoStickers.has(id);
  const item = document.createElement('li');
  item.dataset.earned = String(earned);
  const art = document.createElement('span');
  art.className = 'sticker-art';
  art.setAttribute('aria-hidden', 'true');
  art.textContent = earned ? icon : '✧';
  const title = document.createElement('strong');
  title.textContent = copy(en, ja);
  const hint = document.createElement('small');
  hint.textContent = earned ? copy('Collected!', 'ゲット！') : copy(taskEn, taskJa);
  item.append(art, title, hint);
  return item;
}
function renderStickers() {
  const count = stickerCatalog.filter(([id]) => momoStickers.has(id)).length;
  one('#sticker-progress').textContent = copy(
    count + ' / ' + stickerCatalog.length + ' collected',
    stickerCatalog.length + '枚のうち ' + count + '枚 ゲット',
  );
  one('#toy-stickers').replaceChildren(...stickerCatalog.slice(0, 3).map(stickerEntry));
  one('#game-stickers').replaceChildren(...stickerCatalog.slice(3).map(stickerEntry));
}
momoStickers.subscribe(id => {
  renderStickers();
  const item = stickerCatalog.find(sticker => sticker[0] === id);
  if (item) one('#sticker-announcement').textContent = copy(item[2] + ' sticker unlocked!', item[3] + 'のシールをゲット！');
});
momoLanguage.subscribe(renderStickers);
tabs.find(button => '#' + button.dataset.toy === location.hash)?.click();

let audio;
const keySamples = new Map();
let sound = 'soft';
const majorScale = [0, 2, 4, 5, 7, 9, 11];
function cuteNoteRate(index) {
  const rowStart = index < 10 ? 0 : index < 19 ? 10 : 19;
  const octave = rowStart === 0 ? 0 : rowStart === 10 ? -12 : -24;
  const step = index === 26 ? 0 : index - rowStart;
  const semitones = octave + 12 * Math.floor(step / 7) + majorScale[step % 7];
  return 2 ** (semitones / 12);
}
function play(index, pitch = 0) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  const now = audio.currentTime;
  if (!pitch) {
    if (!keySamples.has(sound)) {
      const rate = audio.sampleRate;
      const cute = sound === 'cute';
      const sample = audio.createBuffer(1, Math.ceil(rate * (cute ? .34 : .105)), rate);
      const data = sample.getChannelData(0);
      for (let frame = 0; frame < data.length; frame++) {
        const t = frame / rate;
        if (cute) {
          const phase = 2 * Math.PI * 554.365 * t;
          const envelope = (1 - Math.exp(-t * 245)) * Math.exp(-t * 25);
          const body = Math.sin(phase);
          const overtone = Math.sin(2 * phase) * Math.exp(-t * 50);
          data[frame] = envelope * (body * .75 + overtone * .16);
          continue;
        }
        const rise = 1 - Math.exp(-t * 730);
        const strike = rise * Math.exp(-t * 100);
        const releaseTime = Math.max(0, t - .043);
        const release = .19 * (1 - Math.exp(-releaseTime * 520)) * Math.exp(-releaseTime * 170);
        const body = Math.sin(2 * Math.PI * 275 * t);
        const shell = Math.sin(2 * Math.PI * 510 * t);
        const returnTone = Math.sin(2 * Math.PI * 335 * releaseTime);
        data[frame] = strike * (body * .68 + shell * .23) + release * returnTone;
      }
      keySamples.set(sound, sample);
    }
    const source = audio.createBufferSource();
    const level = audio.createGain();
    source.buffer = keySamples.get(sound);
    source.playbackRate.value = sound === 'cute' ? cuteNoteRate(index) : .92 + (index % 7) * .037;
    level.gain.value = sound === 'cute' ? .105 : .15;
    source.connect(level).connect(audio.destination);
    source.start(now);
    return;
  }
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch, now);
  osc.frequency.exponentialRampToValueAtTime(pitch * .95, now + .055);
  gain.gain.setValueAtTime(.12, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + .085);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + .09);
}

function meow() {
  if (!audio) return;
  const now = audio.currentTime;
  const voice = audio.createOscillator();
  const vowel = audio.createBiquadFilter();
  const level = audio.createGain();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(305, now);
  voice.frequency.exponentialRampToValueAtTime(595, now + .115);
  voice.frequency.exponentialRampToValueAtTime(350, now + .40);
  vowel.type = 'bandpass';
  vowel.frequency.setValueAtTime(860, now);
  vowel.frequency.linearRampToValueAtTime(550, now + .38);
  vowel.Q.value = 2;
  level.gain.setValueAtTime(.001, now);
  level.gain.exponentialRampToValueAtTime(.11, now + .08);
  level.gain.exponentialRampToValueAtTime(.001, now + .43);
  voice.connect(vowel).connect(level).connect(audio.destination);
  voice.start(now);
  voice.stop(now + .44);
}

function bounceBun(bun) {
  bun.classList.add('bouncing');
  for (let i = 0; i < 6; i++) {
    const spark = document.createElement('span');
    const angle = (i / 5) * Math.PI;
    const radius = bun.clientWidth * .73;
    spark.className = 'bun-spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.textContent = i % 2 ? '✧' : '✦';
    spark.style.setProperty('--x', Math.round(Math.cos(angle) * radius) + 'px');
    spark.style.setProperty('--y', Math.round(-Math.sin(angle) * radius - 18) + 'px');
    bun.append(spark);
    setTimeout(() => spark.remove(), 680);
  }
}

const buns = all('.bun');
const tray = one('#bun-tray');
const mixLabel = one('#bun-mix-label');
const heldBuns = new Map();
const mixtures = {
  3: ['purple', 'Pink + blue = purple!', 'ピンク ＋ 水色 ＝ むらさき！'],
  5: ['peach', 'Pink + yellow = peach!', 'ピンク ＋ 黄色 ＝ ピーチ！'],
  6: ['mint', 'Blue + yellow = mint!', '水色 ＋ 黄色 ＝ ミント！'],
  7: ['rainbow', 'All three = rainbow! ✨', '３色そろって にじいろ！ ✨'],
};

function showMix() {
  const mask = colors.length || isNight() ? 0 : buns.reduce((sum, bun, index) => {
    const lit = bun.getAttribute('aria-pressed') === 'true' || [...heldBuns.values()].includes(index);
    return sum | (lit ? 1 << index : 0);
  }, 0);
  const mix = mixtures[mask];
  if (mix) tray.dataset.mix = mix[0];
  else delete tray.dataset.mix;
  mixLabel.textContent = mix ? copy(mix[1], mix[2]) : '';
}

const bunStatus = one('#bun-status');
const bunStart = one('#bun-mission');
const nightButton = one('#bun-night');
const nightControls = one('#bun-night-controls');
const nightDuration = one('#bun-night-duration');
const nightClock = one('#bun-night-clock');
let nightEndsAt = 0;
let nightInterval;
const isNight = () => nightButton.getAttribute('aria-pressed') === 'true';

function updateNightClock() {
  const left = Math.max(0, Math.ceil((nightEndsAt - Date.now()) / 1000));
  nightClock.value = left ? Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : '☾';
  if (left) return;
  clearInterval(nightInterval);
  tray.dataset.sleeping = '';
  buns.forEach(bun => bun.setAttribute('aria-pressed', 'false'));
  bunStatus.textContent = copy('Good night ♡', 'おやすみ ♡');
}
function startNightTimer() {
  clearInterval(nightInterval);
  nightEndsAt = Date.now() + Number(nightDuration.value) * 60000;
  delete tray.dataset.sleeping;
  buns.forEach(bun => bun.setAttribute('aria-pressed', 'true'));
  bunStatus.textContent = '';
  updateNightClock();
  nightInterval = setInterval(updateNightClock, 1000);
}
nightButton.addEventListener('click', () => {
  const active = !isNight();
  nightButton.setAttribute('aria-pressed', String(active));
  nightControls.hidden = !active;
  bunStart.disabled = active;
  if (active) {
    clearInterval(clock);
    colors = [];
    tray.dataset.night = '';
    startNightTimer();
  } else {
    clearInterval(nightInterval);
    delete tray.dataset.night;
    delete tray.dataset.sleeping;
    buns.forEach(bun => bun.setAttribute('aria-pressed', 'false'));
    bunStatus.textContent = '';
  }
  showMix();
});
nightDuration.addEventListener('change', startNightTimer);
let colors = [];
let colorStep = 0;
let clock;
let endsAt;
const colorName = index => [
  copy('pink', 'ピンク'), copy('blue', '水色'), copy('yellow', '黄色'),
][index];
function showColors() {
  const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  if (!seconds) return endColors(false);
  bunStatus.textContent = colors.map(colorName).join(' → ') + '  ·  ' + colorStep + '/3  ·  ' + seconds + 's';
}
function endColors(won) {
  clearInterval(clock);
  colors = [];
  bunStart.disabled = false;
  bunStatus.textContent = won ? copy('All lit up! ✨', 'ぜんぶ光ったよ！ ✨') : copy('Time’s up. Try again?', '時間だよ。もういちど？');
}
bunStart.addEventListener('click', () => {
  colors = [0, 1, 2];
  for (let index = colors.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [colors[index], colors[other]] = [colors[other], colors[index]];
  }
  colorStep = 0;
  endsAt = Date.now() + 30000;
  bunStart.disabled = true;
  buns.forEach(bun => bun.setAttribute('aria-pressed', 'false'));
  showMix();
  showColors();
  clock = setInterval(showColors, 1000);
});
function activateBun(bun, index) {
  if (isNight()) {
    if ('sleeping' in tray.dataset) startNightTimer();
    return;
  }
  play(index, 280 + index * 77);
  bounceBun(bun);
  if (!colors.length) {
    bun.setAttribute('aria-pressed', String(bun.getAttribute('aria-pressed') !== 'true'));
    showMix();
    if (buns.filter(item => item.getAttribute('aria-pressed') === 'true').length >= 2) momoStickers.award('bun-light');
    return;
  }
  if (Date.now() >= endsAt) return endColors(false);
  colorStep = index === colors[colorStep] ? colorStep + 1 : Number(index === colors[0]);
  buns.forEach((item, itemIndex) => {
    item.setAttribute('aria-pressed', String(colors.indexOf(itemIndex) < colorStep));
  });
  if (colorStep === colors.length) endColors(true);
  else showColors();
}

buns.forEach((bun, index) => {
  let expressionTimer;
  let sleepyTimer;
  function squeeze() {
    clearTimeout(expressionTimer);
    clearTimeout(sleepyTimer);
    if (isNight()) return;
    bun.classList.remove('bouncing');
    bun.classList.add('squeezed');
    bun.dataset.face = 'squeeze';
    expressionTimer = setTimeout(() => {
      bun.dataset.face = 'surprised';
      if (!isNight()) play(index, 460 + index * 45);
    }, 550);
    sleepyTimer = setTimeout(() => { bun.dataset.face = 'sleepy'; }, 1450);
  }
  function relax() {
    clearTimeout(expressionTimer);
    clearTimeout(sleepyTimer);
    bun.classList.remove('squeezed');
    delete bun.dataset.face;
  }
  bun.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    squeeze();
    if (event.pointerType === 'touch') {
      heldBuns.set(event.pointerId, index);
      bun.setPointerCapture(event.pointerId);
      showMix();
    }
  });
  bun.querySelector('.bun-cap').addEventListener('animationend', () => bun.classList.remove('bouncing'));
  bun.addEventListener('pointerup', event => {
    relax();
    if (event.pointerType !== 'touch' || !heldBuns.delete(event.pointerId)) return;
    activateBun(bun, index);
  });
  for (const event of ['pointercancel', 'lostpointercapture', 'pointerleave']) {
    bun.addEventListener(event, pointerEvent => {
      if (event === 'pointerleave' && heldBuns.has(pointerEvent.pointerId)) return;
      relax();
      if (heldBuns.delete(pointerEvent.pointerId)) showMix();
    });
  }
  bun.addEventListener('keydown', event => {
    if (event.code === 'Space' && !event.repeat) squeeze();
  });
  bun.addEventListener('keyup', event => {
    if (event.code === 'Space') relax();
  });
  bun.addEventListener('blur', relax);
  bun.addEventListener('click', event => {
    if (event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents) return;
    activateBun(bun, index);
  });
});
momoLanguage.subscribe(showMix);

const grid = one('#key-grid');
const keyCase = one('.key-case');
const paletteButtons = all('[data-palette]');
const soundButtons = all('[data-sound]');
const keyboardRows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const decorations = [
  'bow', 'heart', 'strawberry', 'flower', 'star', 'paw', 'flower', 'heart', 'bow', 'star',
  'star', 'paw', 'heart', 'strawberry', 'flower', 'bow', 'paw', 'star', 'heart',
  'strawberry', 'bow', 'heart', 'flower', 'paw', 'strawberry', 'star',
];
const furs = ['#d89068', '#b7a0ab', '#cb9c83', '#53475c'];
const keyByLetter = new Map();
const notebook = one('#key-note');
const noteStorage = 'momo:toy-box:note';
const ribbon = one('#momo-ribbon');
const momoCommand = 'MOMO';
ribbon.hidden = !momoStickers.has('ribbon');
momoStickers.subscribe(id => { if (id === 'ribbon') ribbon.hidden = false; });
let celebrationTimer;
function celebrateMomo() {
  momoStickers.award('ribbon');
  if (keyCase.classList.contains('momo-celebration')) return;
  keyCase.classList.add('momo-celebration');
  clearTimeout(celebrationTimer);
  celebrationTimer = setTimeout(() => keyCase.classList.remove('momo-celebration'), 1250);
}
const noteLimit = 120;
try { notebook.value = (localStorage.getItem(noteStorage) || '').slice(-noteLimit); } catch {}
function saveNote(value) {
  notebook.value = value.slice(-noteLimit);
  notebook.scrollTop = notebook.scrollHeight;
  try { localStorage.setItem(noteStorage, notebook.value); } catch {}
}
one('#note-back').addEventListener('click', () => saveNote(notebook.value.slice(0, -1)));
one('#note-clear').addEventListener('click', () => saveNote(''));
let catPresses = 0;
let nextMeow = 8;

function pressKeycap(key, index, letter) {
  play(index);
  saveNote(notebook.value + letter);
  if (notebook.value.endsWith(momoCommand)) celebrateMomo();
  const catSound = keyCase.dataset.theme === 'cat' && ++catPresses >= nextMeow;
  if (catSound) {
    catPresses = 0;
    nextMeow = 7 + Math.floor(Math.random() * 5);
    meow();
  }
  key.querySelector('.key-spark')?.remove();
  const sparkle = document.createElement('span');
  sparkle.className = catSound ? 'key-spark meow' : 'key-spark';
  sparkle.setAttribute('aria-hidden', 'true');
  sparkle.textContent = catSound ? copy('Meow!', 'にゃ〜') : '✦';
  key.append(sparkle);
  setTimeout(() => sparkle.remove(), 330);
}
function renderKeys(theme) {
  keyCase.dataset.theme = theme;
  keyByLetter.clear();
  grid.replaceChildren(...keyboardRows.map((letters, rowIndex) => {
    const row = document.createElement('div');
    row.className = 'key-row';
    [...letters].forEach((letter, index) => {
      const key = document.createElement('button');
      key.className = 'keycap';
      key.type = 'button';
      key.dataset.color = (index + rowIndex * 3) % 7;
      key.style.setProperty('--shine-delay', (index * 65 + rowIndex * 35) + 'ms');
      const legend = document.createElement('span');
      legend.className = 'key-legend';
      legend.textContent = letter;
      key.append(legend);
      const keyIndex = keyByLetter.size;
      const symbol = decorations[keyIndex];
      const art = document.createElement('span');
      art.className = theme === 'cat' ? 'cat-face' : 'key-art';
      art.setAttribute('aria-hidden', 'true');
      if (theme === 'cat') {
        art.textContent = '•ᴗ•';
        art.style.setProperty('--fur', furs[(index + rowIndex) % furs.length]);
      } else {
        art.dataset.art = symbol;
      }
      key.append(art);
      key.addEventListener('click', () => pressKeycap(key, keyIndex, letter));
      keyByLetter.set(letter, key);
      row.append(key);
    });
    return row;
  }));
}
paletteButtons.forEach(button => button.addEventListener('click', () => {
  select(paletteButtons, button);
  renderKeys(button.dataset.palette);
  button.focus();
}));
soundButtons.forEach(button => button.addEventListener('click', () => {
  select(soundButtons, button);
  sound = button.dataset.sound;
  play(3);
}));
renderKeys('pastel');
const spaceKey = one('.space');
spaceKey.addEventListener('click', () => pressKeycap(spaceKey, 26, ' '));
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.metaKey || event.ctrlKey || one('#keys').hidden) return;
  if (event.key === 'Backspace') {
    event.preventDefault();
    saveNote(notebook.value.slice(0, -1));
    return;
  }
  if (event.code === 'Space' && event.target.closest('button:not(.keycap), a')) return;
  const key = event.code === 'Space' ? spaceKey : keyByLetter.get(event.key.toUpperCase());
  if (!key) return;
  event.preventDefault();
  key.classList.add('pressed');
  key.click();
  setTimeout(() => key.classList.remove('pressed'), 110);
});

const puppyMove = one('#puppy-move');
const dogStatus = one('#dog-status');
const dogStart = one('#dog-start');
const moves = all('[data-move]');
const signs = ['🦴', '🐾', '✦'];
let sequence = [];
let guess = 0;
let showing = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function pose(move) {
  puppyMove.textContent = signs[move] || (move === 'win' ? '✧ ♡ ✧' : '');
}
function controlMoves(enabled) {
  moves.forEach(button => { button.disabled = !enabled; });
}
async function showPuppy() {
  showing = true;
  controlMoves(false);
  guess = 0;
  dogStatus.textContent = copy('Watch the puppy…', '犬のポーズを見てね…');
  for (const move of sequence) {
    pose(move);
    play(move, 460 + move * 90);
    await pause(620);
    pose('');
    await pause(180);
  }
  showing = false;
  controlMoves(true);
  dogStatus.textContent = copy('Your turn!', 'こんどはきみの番！');
}
function finishPuppy(won) {
  pose(won ? 'win' : '');
  dogStatus.textContent = won ? copy('You copied all five moves! ✨', '５つのポーズをまねできたよ！ ✨') : copy('Good try! Play again?', 'おしい！ もういちど？');
  controlMoves(false);
  dogStart.disabled = false;
}
dogStart.addEventListener('click', () => {
  dogStart.disabled = true;
  sequence = [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)];
  showPuppy();
});
moves.forEach(button => button.addEventListener('click', () => {
  if (showing || !dogStart.disabled) return;
  const move = Number(button.dataset.move);
  if (move !== sequence[guess]) return finishPuppy(false);
  pose(move);
  play(move, 460 + move * 90);
  if (++guess < sequence.length) return;
  momoStickers.award('puppy');
  if (sequence.length === 5) return finishPuppy(true);
  sequence.push(Math.floor(Math.random() * 3));
  pose('');
  controlMoves(false);
  dogStatus.textContent = copy('Nice! Next round…', 'できた！ つぎのラウンド…');
  setTimeout(showPuppy, 500);
}));
