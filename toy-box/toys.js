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
  const mask = colors.length ? 0 : buns.reduce((sum, bun, index) => {
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
  play(index, 280 + index * 77);
  bounceBun(bun);
  if (!colors.length) {
    bun.setAttribute('aria-pressed', String(bun.getAttribute('aria-pressed') !== 'true'));
    showMix();
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
  function squeeze() {
    clearTimeout(expressionTimer);
    bun.classList.remove('bouncing');
    bun.classList.add('squeezed');
    bun.dataset.face = 'squeeze';
    expressionTimer = setTimeout(() => { bun.dataset.face = 'surprised'; }, 550);
  }
  function relax() {
    clearTimeout(expressionTimer);
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
  if (sequence.length === 5) return finishPuppy(true);
  sequence.push(Math.floor(Math.random() * 3));
  pose('');
  controlMoves(false);
  dogStatus.textContent = copy('Nice! Next round…', 'できた！ つぎのラウンド…');
  setTimeout(showPuppy, 500);
}));
