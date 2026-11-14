const gameScores = (() => {
  const nameInput = document.querySelector('#nickname');
  const readyCard = document.querySelector('#ready-card');
  const scoreCard = document.querySelector('#score-card');
  const scoreList = document.querySelector('#score-list');
  const best = document.querySelector('#personal-best');
  const changePlayer = document.querySelector('#change-player');
  const levelLabel = document.querySelector('#score-level');
  const periodButtons = document.querySelectorAll('[data-period]');
  let level = 'standard';
  let period = 'weekly';
  const nameKey = 'momo:nickname';
  const prefix = 'momo:scores:' + document.body.dataset.game + ':';
  const cache = new Map();
  let player;

  try { nameInput.value = localStorage.getItem(nameKey) || ''; } catch {}

  function weekKey(now = Date.now()) {
    // Japan time, Monday at midnight. A UTC date shifted by nine hours
    // gives the same calendar week on every device.
    const monday = new Date(now + 9 * 60 * 60 * 1000);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    return monday.toISOString().slice(0, 10);
  }

  function read(level) {
    if (cache.has(level)) return cache.get(level);
    try {
      const rows = JSON.parse(localStorage.getItem(prefix + level) || '[]');
      if (Array.isArray(rows)) return rows.filter(row => row && typeof row.name === 'string' && Number.isSafeInteger(row.score));
    } catch {}
    return [];
  }

  function render() {
    if (levelLabel) levelLabel.textContent = Array.from(document.querySelectorAll('[data-level]')).find(button => button.dataset.level === level)?.lastElementChild.textContent || '';
    const board = period === 'weekly' ? level + ':' + weekKey() : level;
    const rows = read(board);
    const nickname = nameInput.value.trim().toLowerCase();
    const record = rows.find(row => row.name.toLowerCase() === nickname);
    const rank = record ? 1 + rows.filter(row => row.score > record.score).length : null;
    best.textContent = record
      ? 'Your best: ' + record.score + ' points · Rank #' + rank
      : rows.length ? 'Your best: —' : 'No scores yet';

    scoreList.replaceChildren();
    let place = 0;
    rows.slice(0, 10).forEach((row, index) => {
      if (row.score !== rows[index - 1]?.score) place = index + 1;
      const item = document.createElement('li');
      const badge = document.createElement('span');
      badge.className = 'score-rank';
      badge.textContent = '#' + place;
      const name = document.createElement('span');
      name.textContent = row === record ? row.name + ' (you)' : row.name;
      if (typeof row.stageName === 'string' && row.stageName) {
        const stage = document.createElement('small');
        stage.className = 'score-stage';
        stage.textContent = ' · ' + row.stageName;
        name.append(stage);
      }
      const points = document.createElement('strong');
      points.textContent = String(row.score);
      item.classList.toggle('your-score', row === record);
      item.append(badge, name, points);
      scoreList.append(item);
    });
  }

  nameInput.addEventListener('input', render);
  periodButtons.forEach(button => button.addEventListener('click', () => {
    period = button.dataset.period;
    periodButtons.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    render();
  }));
  changePlayer.addEventListener('click', () => {
    readyCard.hidden = false;
    nameInput.focus();
  });
  const initialLevel = document.querySelector('[data-level][aria-pressed="true"]');
  if (initialLevel) level = initialLevel.dataset.level;
  window.addEventListener('storage', render);
  document.addEventListener('visibilitychange', render);
  let displayedWeek = weekKey();
  setInterval(() => {
    const currentWeek = weekKey();
    if (currentWeek === displayedWeek) return;
    displayedWeek = currentWeek;
    render();
  }, 1000);
  render();

  return {
    start(level = 'standard') {
      const name = nameInput.value.trim();
      player = { name, level };
      try {
        if (name) localStorage.setItem(nameKey, name);
        else localStorage.removeItem(nameKey);
      } catch {}
      nameInput.readOnly = true;
      changePlayer.hidden = true;
      readyCard.hidden = scoreCard.hidden = true;
    },
    clear() { readyCard.hidden = scoreCard.hidden = true; },
    showLevel(selectedLevel) {
      level = selectedLevel;
      render();
    },
    finish(score, completed, growth) {
      nameInput.readOnly = false;
      changePlayer.hidden = false;
      document.querySelector('#final-score').textContent = String(score);
      let caption = completed ? 'Great game!' : 'Round stopped';
      if (completed && player.name) {
        const { name, level } = player;
        for (const board of [level, level + ':' + weekKey()]) {
          const rows = read(board);
          const previous = rows.find(row => row.name.toLowerCase() === name.toLowerCase());
          if (previous && (score < previous.score ||
            (score === previous.score && (growth?.stage ?? 0) <= (previous.stage ?? 0)))) continue;
          const updated = rows.filter(row => row !== previous);
          const entry = { name, score };
          if (growth?.stage && growth.stageName) {
            entry.stage = growth.stage;
            entry.stageName = growth.stageName;
          }
          updated.push(entry);
          updated.sort((a, b) => b.score - a.score);
          const isAllTime = board === level;
          try {
            localStorage.setItem(prefix + board, JSON.stringify(updated));
            cache.delete(board);
            if (isAllTime) caption = 'New personal best!';
            else if (caption === 'Great game!') caption = 'New weekly best!';
          } catch {
            cache.set(board, updated);
            if (isAllTime) caption = 'New personal best for this visit!';
            else if (caption === 'Great game!') caption = 'New weekly best for this visit!';
          }
        }
        render();
      }
      scoreCard.querySelector('p').textContent = caption;
      scoreCard.hidden = false;
    }
  };
})();
