(() => {
  const court = document.querySelector('.court');
  const opponent = document.querySelector('.opponent');
  const ball = document.querySelector('#ball');
  const aim = document.querySelector('.aim');
  const reaction = document.querySelector('#reaction');
  const hitsOutput = document.querySelector('#hits');
  const leftOutput = document.querySelector('#left');
  const status = document.querySelector('#status');
  const finish = document.querySelector('#finish');
  const result = document.querySelector('#result');
  const retry = document.querySelector('#retry');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const total = 5;
  const hitFaces = ['squint', 'surprised', 'dizzy'];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const say = (en, ja) => momoLanguage.pick(en, ja);
  let hits = 0;
  let thrown = 0;
  let catX = 50;
  let target = 50;
  let drag = null;
  let busy = false;
  let reactionTimer;
  let audio;

  function moveCat(time) {
    if (!reducedMotion.matches && finish.hidden && !opponent.classList.contains('hit')) {
      catX = 50 + Math.sin(time / 650) * (21 + thrown * 1.8);
      opponent.style.left = catX + '%';
    }
    requestAnimationFrame(moveCat);
  }

  function tone(start, end, delay = 0) {
    if (!audio || audio.state !== 'running') return;
    const time = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(start, time);
    oscillator.frequency.exponentialRampToValueAtTime(end, time + .16);
    gain.gain.setValueAtTime(.001, time);
    gain.gain.exponentialRampToValueAtTime(.09, time + .025);
    gain.gain.exponentialRampToValueAtTime(.001, time + .2);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(time);
    oscillator.stop(time + .21);
  }

  function showAim(position) {
    target = position;
    aim.style.left = position + '%';
    aim.hidden = false;
  }

  function showResults() {
    result.textContent = say(hits + ' / ' + total + ' hits!', total + '球中 ' + hits + '球ヒット！');
  }

  async function throwBall(position) {
    if (busy || thrown >= total) return;
    busy = true;
    ball.setAttribute('aria-disabled', 'true');
    aim.hidden = true;
    if (window.AudioContext) {
      try {
        audio ??= new AudioContext();
        if (audio.state === 'suspended') audio.resume().catch(() => {});
      } catch {}
    }
    tone(470, 250);
    const x = (position - 50) / 100 * court.clientWidth;
    const y = court.clientHeight * .37;
    const speed = reducedMotion.matches ? 1 : 340;
    const flight = ball.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${x * .5}px, ${-y * .57}px) scale(.72)`, offset: .5 },
      { transform: `translate(${x}px, ${-y}px) scale(.43)` }
    ], { duration: speed, easing: 'ease-in', fill: 'forwards' });
    await flight.finished;
    const hit = Math.abs(position - catX) / 100 * court.clientWidth <= opponent.offsetWidth * .35 + ball.offsetWidth * .16;
    thrown += 1;
    hits += Number(hit);
    hitsOutput.textContent = hits;
    leftOutput.textContent = total - thrown;
    clearTimeout(reactionTimer);
    opponent.classList.remove('hit');
    if (hit) {
      opponent.dataset.face = hitFaces[(hits - 1) % hitFaces.length];
      // Restart the squash and glasses animations even on consecutive hits.
      void opponent.offsetWidth;
      opponent.classList.add('hit');
    }
    reaction.textContent = hit ? say('Meow!', 'にゃっ！') : say('Missed me!', 'よけた！');
    reaction.hidden = false;
    status.textContent = (hit ? say('Hit!', 'ヒット！') : say('Miss!', 'はずれ！')) + ' ' + say((total - thrown) + ' left.', 'のこり ' + (total - thrown) + ' 球。');
    if (hit) {
      tone(440, 170);
      tone(520, 890, .10);
      tone(830, 680, .20);
    } else {
      tone(250, 180);
    }
    const reboundX = hit ? x + (x >= 0 ? 90 : -90) : x;
    const reboundY = hit ? -y - 25 : -y + 22;
    const bounce = ball.animate([
      { transform: `translate(${x}px, ${-y}px) scale(.43)`, opacity: 1 },
      { transform: `translate(${reboundX}px, ${reboundY}px) scale(.57)`, offset: .47, opacity: .95 },
      { transform: `translate(${reboundX + (x >= 0 ? 32 : -32)}px, ${-y + 105}px) scale(.65)`, opacity: 0 }
    ], { duration: reducedMotion.matches ? 1 : 230, fill: 'forwards' });
    await bounce.finished;
    bounce.cancel();
    flight.cancel();
    busy = false;
    ball.removeAttribute('aria-disabled');
    if (thrown === total) {
      ball.hidden = true;
      showResults();
      finish.hidden = false;
      retry.focus();
    }
    reactionTimer = setTimeout(() => {
      opponent.classList.remove('hit');
      reaction.hidden = true;
    }, 510);
  }

  function swipeTarget(event) {
    const dy = drag.y - event.clientY;
    if (dy < 20) return null;
    const dx = event.clientX - drag.x;
    return clamp(50 + dx / dy * court.clientHeight * 37 / court.clientWidth, 3, 97);
  }

  ball.addEventListener('pointerdown', event => {
    if (busy || drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    ball.setPointerCapture(event.pointerId);
  });
  ball.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const position = swipeTarget(event);
    aim.hidden = position === null;
    if (position !== null) showAim(position);
  });
  ball.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const position = swipeTarget(event);
    drag = null;
    aim.hidden = true;
    if (position !== null) void throwBall(position);
  });
  ball.addEventListener('lostpointercapture', () => {
    drag = null;
    aim.hidden = true;
  });
  ball.addEventListener('keydown', event => {
    if (busy || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    showAim(clamp(target + (event.key === 'ArrowRight' ? 6 : -6), 3, 97));
  });
  ball.addEventListener('click', event => {
    if (event.detail === 0) void throwBall(target);
  });
  retry.addEventListener('click', () => {
    clearTimeout(reactionTimer);
    opponent.classList.remove('hit');
    reaction.hidden = true;
    finish.hidden = true;
    thrown = hits = 0;
    target = 50;
    hitsOutput.textContent = hits;
    leftOutput.textContent = total;
    status.textContent = '';
    ball.hidden = false;
    ball.focus();
  });
  momoLanguage.subscribe(() => {
    if (!finish.hidden) showResults();
  });
  requestAnimationFrame(moveCat);
})();
