(() => {
  const wires = document.querySelector('#wires');
  const nodes = document.querySelector('#nodes');
  const modes = [...document.querySelectorAll('[data-mode]')];
  const gates = [...document.querySelectorAll('[data-gate]')];
  const gatePicker = document.querySelector('#gates');
  const goal = document.querySelector('#goal');
  const readout = document.querySelector('#readout');
  const advance = document.querySelector('#advance');
  const reset = document.querySelector('#reset');
  const pick = momoLanguage.pick;
  const svgNS = 'http://www.w3.org/2000/svg';
  const gatePaths = {
    NOT: 'M12 9 65 32 12 55Z M75 32a5 5 0 1 0-10 0 5 5 0 0 0 10 0Z',
    OR: 'M9 9 Q52 8 74 32 Q52 56 9 55 Q28 32 9 9Z',
    AND: 'M12 9H38 C83 9 83 55 38 55H12Z'
  };
  const rules = {
    WIRE: ['The output follows the input.', '入力と同じ値が出る。'],
    NOT: ['The output flips: 0 → 1, 1 → 0.', '入力を反転する。0 → 1、1 → 0。'],
    OR: ['At least one input must be 1.', '入力のどちらか一方、または両方が1なら出力は1。'],
    AND: ['Both inputs must be 1.', '両方の入力が1のときだけ出力は1。']
  };
  const puzzles = [
    { outputs: ['WIRE', 'NOT'], count: 1, target: [1, 0] },
    { outputs: ['NOT'], count: 1, initial: [1], target: [1] },
    { outputs: ['OR'], count: 2, target: [1] },
    { outputs: ['AND'], count: 2, target: [1] },
    { outputs: ['OR', 'AND'], count: 2, target: [1, 0] },
    { outputs: ['NOT', 'AND'], count: 2, initial: [0, 1], target: [0, 0] }
  ];
  let mode = 'lab';
  let kind = 'WIRE';
  let index = 0;
  let stage;
  let bits;
  let inputs;
  let outputs;

  function evaluate(type) {
    switch (type) {
      case 'NOT': return 1 - bits[0];
      case 'OR': return bits[0] | bits[1];
      case 'AND': return bits[0] & bits[1];
      default: return bits[0];
    }
  }

  function node(tag, className, x, y) {
    const el = document.createElement(tag);
    el.className = 'node ' + className;
    el.style.setProperty('--x', (x / 10) + '%');
    el.style.setProperty('--y', (y / 4.4) + '%');
    nodes.append(el);
    return el;
  }

  function caption(el, text) {
    const label = document.createElement('span');
    label.className = 'node-caption';
    label.textContent = text;
    el.append(label);
    return label;
  }

  function path(d, active, pulse, delay) {
    const line = document.createElementNS(svgNS, 'path');
    line.setAttribute('d', d);
    line.setAttribute('class', active ? 'wire lit' : 'wire');
    wires.append(line);
    if (!active || !pulse) return;
    const highlight = line.cloneNode();
    highlight.setAttribute('class', 'wire pulse');
    highlight.setAttribute('pathLength', '1');
    highlight.style.setProperty('--delay', delay + 'ms');
    wires.append(highlight);
  }

  function redraw(animate = false) {
    wires.replaceChildren();
    inputs.forEach(({ button, digit, name }, i) => {
      digit.textContent = bits[i];
      button.setAttribute('aria-pressed', String(bits[i] === 1));
      button.setAttribute('aria-label', pick('Input ', '入力 ') + name + ': ' + bits[i]);
    });
    const values = stage.outputs.map(evaluate);
    const solved = mode === 'puzzle' && values.every((value, i) => value === stage.target[i]);
    outputs.forEach(({ type, lamp, digit, gate, y, name }, i) => {
      const isBinary = type === 'OR' || type === 'AND';
      const on = values[i] === 1;
      const from = isBinary ? [0, 1] : [0];
      from.forEach((n, port) => {
        const elbow = isBinary && outputs.length > 1 ? 285 + 48 * n + 18 * i : 310;
        const endY = isBinary ? y + (port === 0 ? -17 : 17) : y;
        path('M120 ' + inputs[n].y + 'H' + elbow + 'V' + endY + 'H' + (gate ? 500 : 860), bits[n], animate, 0);
      });
      if (gate) {
        gate.classList.toggle('marked', on);
        path('M500 ' + y + 'H860', on, animate, 155);
      }
      digit.textContent = values[i];
      lamp.setAttribute('aria-label', pick('Output ', '出力 ') + name + ': ' + values[i]);
      lamp.classList.toggle('lit', on);
      lamp.classList.toggle('correct', solved && on);
    });
    renderCopy(solved);
  }

  function renderCopy(solved) {
    gatePicker.hidden = mode !== 'lab';
    goal.hidden = mode !== 'puzzle';
    advance.hidden = !solved;
    if (mode === 'lab') {
      readout.textContent = pick(...rules[kind]);
      return;
    }
    const targets = stage.target.map((value, i) => outputs[i].name + ' = ' + value).join(' / ');
    goal.textContent = pick('Goal ', 'お題 ') + (index + 1) + '/' + puzzles.length + '  ·  ' + targets;
    readout.textContent = solved
      ? (index === puzzles.length - 1 ? pick('All six circuits solved!', '6問すべてクリア！') : pick('Circuit solved!', 'クリア！'))
      : pick('Set the inputs to match the target outputs.', 'スイッチを切り替えて、お題と同じ出力にしよう。');
    advance.textContent = index === puzzles.length - 1 ? pick('Play again', 'もういちど') : pick('Next circuit →', '次の回路 →');
  }

  function loadStage() {
    stage = mode === 'puzzle' ? puzzles[index] : {
      outputs: [kind], count: kind === 'OR' || kind === 'AND' ? 2 : 1
    };
    bits = stage.initial?.slice() || Array(stage.count).fill(0);
    nodes.replaceChildren();
    inputs = bits.map((_, i) => {
      const y = bits.length === 1 ? 220 : 125 + i * 178;
      const name = i === 0 ? 'A' : 'B';
      const button = node('button', 'input', 120, y);
      button.type = 'button';
      const digit = document.createElement('span');
      button.append(digit);
      caption(button, name);
      button.addEventListener('click', () => {
        bits[i] ^= 1;
        playClick();
        redraw(true);
      });
      return { button, digit, name, y };
    });
    outputs = stage.outputs.map((type, i) => {
      const y = stage.outputs.length === 1 ? 220 : 125 + i * 178;
      const name = i === 0 ? 'X' : 'Y';
      let gate;
      if (type !== 'WIRE') {
        gate = node('div', 'gate', 500, y);
        const symbol = document.createElementNS(svgNS, 'svg');
        symbol.setAttribute('viewBox', '0 0 84 64');
        symbol.setAttribute('aria-hidden', 'true');
        const outline = document.createElementNS(svgNS, 'path');
        outline.setAttribute('d', gatePaths[type]);
        symbol.append(outline);
        gate.append(symbol);
        caption(gate, type);
      }
      const lamp = node('div', 'lamp', 860, y);
      lamp.setAttribute('role', 'img');
      lamp.style.setProperty('--lamp', i === 0 ? 'var(--pink)' : 'var(--blue)');
      const digit = document.createElement('span');
      lamp.append(digit);
      caption(lamp, name);
      return { type, lamp, digit, gate, y, name };
    });
    redraw();
  }

  let audio;
  function playClick() {
    if (!window.AudioContext) return;
    try {
      audio ??= new AudioContext();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      oscillator.frequency.setValueAtTime(330, now);
      oscillator.frequency.exponentialRampToValueAtTime(150, now + .045);
      gain.gain.setValueAtTime(.06, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + .06);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + .065);
    } catch {}
  }

  modes.forEach(button => button.addEventListener('click', () => {
    if (mode === button.dataset.mode) return;
    mode = button.dataset.mode;
    modes.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    loadStage();
  }));
  gates.forEach(button => button.addEventListener('click', () => {
    if (kind === button.dataset.gate) return;
    kind = button.dataset.gate;
    gates.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    loadStage();
  }));
  reset.addEventListener('click', loadStage);
  advance.addEventListener('click', () => {
    index = (index + 1) % puzzles.length;
    loadStage();
    inputs[0].button.focus({ preventScroll: true });
  });
  loadStage();
  momoLanguage.subscribe(() => redraw());
})();
