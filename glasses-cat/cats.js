const cats = document.querySelector('#cats');
const score = document.querySelector('#score');
const time = document.querySelector('#time');
const play = document.querySelector('#play');
const result = document.querySelector('#result');
const colors = ['#f6b57f', '#d2b0eb', '#f5b6c9', '#d5eac6', '#d8c0a7'];
let found = 0;
let remaining = 0;
let deadline;

const practice = document.querySelector('#practice');
const stop = document.querySelector('#stop');
stop.addEventListener('click', () => {
  if (deadline !== Infinity && play.disabled) deadline = performance.now();
});
document.querySelector('#cat-example').insertAdjacentHTML('afterbegin', catArt(true));

function catArt(target) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M9 30 11 11 26 19 Q32 17 38 19 L53 11 55 30 C65 65 -1 65 9 30Z" fill="${colors[Math.floor(Math.random() * colors.length)]}" stroke="#57344a" stroke-width="2"/>
      <path d="M15 17 21 23 14 26Z M49 17 50 26 43 23Z" fill="#f987aa"/>
      <circle cx="23" cy="35" r="2.2" fill="#57344a"/><circle cx="41" cy="35" r="2.2" fill="#57344a"/>
      <path d="M28 43Q30 46 32 42Q34 46 37 43" fill="none" stroke="#57344a" stroke-width="2" stroke-linecap="round"/>
      ${target ? '<path d="M29 35h6" stroke="#493153" stroke-width="3"/><circle cx="22" cy="35" r="7" fill="none" stroke="#493153" stroke-width="3"/><circle cx="42" cy="35" r="7" fill="none" stroke="#493153" stroke-width="3"/>' : ''}
      </svg>`;
}

function makeBoard() {
  const previousFocus = cats.contains(document.activeElement);
  cats.replaceChildren();
  const count = deadline === Infinity ? 8 : 16;
  const positions = Array.from({ length: count }, (_, index) => index);
  const targets = new Set();
  while (targets.size < 3) targets.add(positions.splice(Math.floor(Math.random() * positions.length), 1)[0]);
  remaining = targets.size;
  for (let i = 0; i < count; i++) {
    const target = targets.has(i);
    const cat = document.createElement('button');
    cat.type = 'button';
    cat.setAttribute('aria-label', 'Cat ' + (i + 1) + (target ? ', wearing glasses' : ', no glasses'));
    cat.innerHTML = catArt(target);
    cat.addEventListener('click', () => {
      if (performance.now() >= deadline || cat.getAttribute('aria-disabled') === 'true') return;
      cat.setAttribute('aria-disabled', 'true');
      cat.classList.add(target ? 'found' : 'miss');
      if (!target) {
        result.textContent = 'No glasses on that cat. Keep looking!';
        return;
      }
      score.value = ++found;
      remaining--;
      result.textContent = remaining ? 'Found one!' : 'New cats!';
      if (!remaining) {
        if (deadline === Infinity) {
          result.textContent = 'You found all three! Practice again or tap Play.';
          for (const tile of cats.children) tile.disabled = true;
        } else {
          makeBoard();
        }
      }
    });
    cats.append(cat);
  }
  if (previousFocus) cats.firstElementChild.focus();
}

function tick() {
  const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
  time.value = seconds + 's left';
  if (seconds > 0) {
    requestAnimationFrame(tick);
    return;
  }
  for (const cat of cats.children) cat.disabled = true;
  stop.hidden = true;
  play.disabled = false;
  practice.disabled = false;
  play.textContent = 'Play again';
  result.textContent = 'You found ' + found + (found === 1 ? ' cat!' : ' cats!');
}

play.addEventListener('click', () => {
  score.value = found = 0;
  time.value = '30s left';
  deadline = performance.now() + 30000;
  play.textContent = 'Playing…';
  play.disabled = true;
  stop.hidden = false;
  practice.disabled = true;
  cats.dataset.practice = "false";
  result.textContent = 'Find the glasses!';
  makeBoard();
  requestAnimationFrame(tick);
});

practice.addEventListener('click', () => {
  score.value = found = 0;
  time.value = 'No timer';
  deadline = Infinity;
  cats.dataset.practice = 'true';
  result.textContent = 'Find three cats with glasses!';
  makeBoard();
});
