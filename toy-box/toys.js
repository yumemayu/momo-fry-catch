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
let sound = 'click';
function play(index, pitch = 0) {
  if (sound === 'mute') return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const soft = sound === 'soft' || pitch > 0;
  osc.type = soft ? 'sine' : 'triangle';
  osc.frequency.setValueAtTime(pitch || (soft ? 170 : 620) + index * 22, now);
  osc.frequency.exponentialRampToValueAtTime(pitch ? pitch * .95 : soft ? 78 : 150, now + .055);
  gain.gain.setValueAtTime(.12, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + .085);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + .09);
}

const buns = all('.bun');
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
  showColors();
  clock = setInterval(showColors, 1000);
});
buns.forEach((bun, index) => {
  bun.addEventListener('pointerdown', () => bun.classList.add('squeezed'));
  for (const event of ['pointerup', 'pointercancel', 'pointerleave']) {
    bun.addEventListener(event, () => bun.classList.remove('squeezed'));
  }
  bun.addEventListener('click', () => {
    play(index, 280 + index * 77);
    if (!colors.length) {
      bun.setAttribute('aria-pressed', String(bun.getAttribute('aria-pressed') !== 'true'));
      return;
    }
    if (Date.now() >= endsAt) return endColors(false);
    colorStep = index === colors[colorStep] ? colorStep + 1 : Number(index === colors[0]);
    buns.forEach((item, itemIndex) => {
      item.setAttribute('aria-pressed', String(colors.indexOf(itemIndex) < colorStep));
    });
    if (colorStep === colors.length) endColors(true);
    else showColors();
  });
});

const grid = one('#key-grid');
const keyCase = one('.key-case');
const paletteButtons = all('[data-palette]');
const soundButtons = all('[data-sound]');
const letters = 'ASDFGHJK';
const symbols = ['🍓', '♡', '✿', '🐾', '🍒', '✦', '🎀', '☁'];
const furs = ['#d68760', '#807182', '#b77250', '#4f4058'];
function renderKeys(theme) {
  keyCase.dataset.theme = theme;
  grid.replaceChildren(...symbols.map((symbol, index) => {
    const key = document.createElement('button');
    key.className = 'keycap';
    key.type = 'button';
    key.setAttribute('aria-label', letters[index]);
    const art = document.createElement('span');
    art.setAttribute('aria-hidden', 'true');
    art.textContent = symbol;
    if (theme === 'cat') {
      art.className = 'cat-face';
      art.style.setProperty('--fur', furs[index % furs.length]);
      art.textContent = '•ᴗ•';
    }
    key.append(art);
    key.addEventListener('click', () => play(index));
    return key;
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
spaceKey.addEventListener('click', () => play(0));
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.metaKey || event.ctrlKey || one('#keys').hidden) return;
  if (event.code === 'Space' && event.target.closest('button, a')) return;
  const key = event.code === 'Space' ? spaceKey : grid.children[letters.indexOf(event.key.toUpperCase())];
  if (!key) return;
  event.preventDefault();
  key.classList.add('pressed');
  key.click();
  setTimeout(() => key.classList.remove('pressed'), 110);
});

const puppy = one('#puppy');
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
  puppy.dataset.move = move;
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
  play(move);
  if (++guess < sequence.length) return;
  if (sequence.length === 5) return finishPuppy(true);
  sequence.push(Math.floor(Math.random() * 3));
  pose('');
  controlMoves(false);
  dogStatus.textContent = copy('Nice! Next round…', 'できた！ つぎのラウンド…');
  setTimeout(showPuppy, 500);
}));
