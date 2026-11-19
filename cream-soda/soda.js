'use strict';

const levels = [
  ['ppgb', 'ggbp', 'bbpg', '', ''],
  ['pgbp', 'bpgb', 'gbpg', '', ''],
  ['pbgp', 'gppb', 'bgbg', '', '']
];
const colors = {
  p: ['pink', 'strawberry', 'いちご'],
  g: ['green', 'melon', 'メロン'],
  b: ['blue', 'blue soda', 'ブルーソーダ']
};

function pour(board, from, to) {
  const source = board[from];
  const target = board[to];
  const color = source.at(-1);
  if (from === to || !color || target.length === 4 || (target && target.at(-1) !== color)) return null;
  const run = source.length - source.replace(new RegExp(color + '+$'), '').length;
  const amount = Math.min(4 - target.length, run);
  return board.map((glass, index) => {
    if (index === from) return glass.slice(0, -amount);
    if (index === to) return glass + color.repeat(amount);
    return glass;
  });
}

const filled = glass => glass.length === 4 && [...glass].every(color => color === glass[0]);
const solved = board => board.every(glass => !glass || filled(glass));

if (typeof module !== 'undefined') module.exports = { levels, pour, solved };

if (typeof document !== 'undefined') {
  const pick = (en, ja) => momoLanguage.pick(en, ja);
  const tray = document.querySelector('#glasses');
  const message = document.querySelector('#message');
  const undo = document.querySelector('#undo');
  const next = document.querySelector('#next');
  const levelButtons = [...document.querySelectorAll('#levels button')];

  let stage = 0;
  let board = levels[stage];
  let selected = -1;
  let history = [];
  let status = ['', ''];

  function render(focusIndex) {
    const previous = [...tray.children];
    board.forEach((glass, index) => {
      const button = previous[index] || document.createElement('button');
      if (!previous[index]) {
        button.type = 'button';
        button.className = 'glass';
        button.addEventListener('click', () => select(index));
        tray.append(button);
      }
      if (button.dataset.contents !== glass) {
        button.dataset.contents = glass;
        button.replaceChildren(...[...glass].map(color => {
          const layer = document.createElement('span');
          layer.className = 'layer ' + colors[color][0];
          layer.setAttribute('aria-hidden', 'true');
          return layer;
        }));
        if (filled(glass)) {
          const topping = document.createElement('span');
          topping.className = 'topping';
          topping.textContent = '🍨🍒';
          topping.setAttribute('aria-hidden', 'true');
          button.append(topping);
        }
      }
      const names = [...glass].reverse().map(color => pick(colors[color][1], colors[color][2])).join(' / ');
      button.setAttribute('aria-label', pick(`Glass ${index + 1}: ${names || 'empty'}`, `グラス ${index + 1}、${names || 'からっぽ'}`));
      button.setAttribute('aria-pressed', String(selected === index));
      button.disabled = solved(board);
    });
    undo.disabled = !history.length;
    next.hidden = !solved(board) || stage + 1 === levels.length;
    levelButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(stage === index)));
    message.textContent = pick(...status);
    if (focusIndex !== undefined && !solved(board)) tray.children[focusIndex].focus();
  }

  function select(index) {
    status = ['', ''];
    if (selected === index) selected = -1;
    else if (selected === -1) {
      if (board[index]) selected = index;
    } else {
      const moved = pour(board, selected, index);
      if (moved) {
        history.push(board);
        board = moved;
        selected = -1;
        if (solved(board)) {
          const reward = sodaGems.clear(stage);
          status = reward ? ['Cream sodas are ready! 💎 +10', 'クリームソーダ、できあがり！ 💎 +10'] :
            ['Cream sodas are ready!', 'クリームソーダ、できあがり！'];
        }
      } else {
        selected = board[index] ? index : selected;
        status = ['Try an empty glass or a matching top color.', '空のグラスか、いちばん上が同じ色のグラスを選んでね。'];
      }
    }
    render(index);
  }

  function start(index) {
    stage = index;
    board = levels[stage];
    history = [];
    selected = -1;
    status = ['', ''];
    render();
  }

  undo.addEventListener('click', () => {
    if (!history.length) return;
    board = history.pop();
    selected = -1;
    status = ['', ''];
    render();
  });
  document.querySelector('#reset').addEventListener('click', () => start(stage));
  next.addEventListener('click', () => start(stage + 1));
  levelButtons.forEach((button, index) => button.addEventListener('click', () => start(index)));
  momoLanguage.subscribe(() => render());
}
