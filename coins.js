'use strict';
/* Home page coin dock: fixed at the top right (the prime spot), with a
   "+N" celebration when the balance grew since the last visit and a
   small goal line ("N to go until the next 50"). Coins are earned in
   games (scores.js) and kept on this device. */
(() => {
  let coins = sodaGems.balance();
  let seen = null;
  try {
    const raw = localStorage.getItem('momo:coins-seen');
    seen = raw === null ? null : (parseInt(raw, 10) || 0);
  } catch { seen = null; }
  const pick = (en, ja) => (typeof momoLanguage !== 'undefined' && momoLanguage.pick) ? momoLanguage.pick(en, ja) : en;
  const wrap = document.createElement('div');
  wrap.className = 'coin-dock';
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'coin-chip';
  chip.setAttribute('aria-label', 'Gems');
  chip.innerHTML = `💎 <span>${coins}</span>`;
  const goal = document.createElement('div');
  goal.className = 'coin-goal';
  const goalText = () => pick('Mini sodas: 20 gems', 'ミニソーダは20ジェム');
  goal.textContent = goalText();
  const hint = document.createElement('div');
  hint.className = 'coin-hint';
  hint.hidden = true;
  const hintText = () => pick('Trade gems for a mini soda on the toy shelf!', 'おもちゃ棚でジェムをミニソーダと交換できるよ！');
  hint.textContent = hintText();
  chip.addEventListener('click', () => { hint.hidden = !hint.hidden; });
  wrap.append(chip, goal, hint);
  document.body.append(wrap);
  if (seen !== null && coins > seen) {
    const plus = document.createElement('span');
    plus.className = 'coin-plus';
    plus.textContent = `+${coins - seen}`;
    chip.append(plus);
    chip.classList.add('coin-pop');
  }
  try { localStorage.setItem('momo:coins-seen', String(coins)); } catch { /* storage unavailable */ }
  const refresh = () => {
    coins = sodaGems.balance();
    chip.querySelector('span').textContent = coins;
    try { localStorage.setItem('momo:coins-seen', String(coins)); } catch {}
  };
  window.addEventListener('momo-gems-change', refresh);
  window.addEventListener('storage', refresh);
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  if (typeof momoLanguage !== 'undefined' && momoLanguage.subscribe) {
    momoLanguage.subscribe(() => { goal.textContent = goalText(); hint.textContent = hintText(); });
  }
})();
