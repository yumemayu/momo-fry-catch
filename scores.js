const gameScores = (() => {
  const nameInput = document.querySelector('#nickname');
  const readyCard = document.querySelector('#ready-card');
  const scoreCard = document.querySelector('#score-card');
  const scoreList = document.querySelector('#score-list');
  const best = document.querySelector('#personal-best');
  const levelFilter = document.querySelector('#score-level');
  const periodFilter = document.querySelector('#score-period');
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
    const level = levelFilter?.value || 'standard';
    const board = periodFilter.value === 'weekly' ? level + ':' + weekKey() : level;
    const rows = read(board);
    const nickname = nameInput.value.trim().toLowerCase();
    const record = rows.find(row => row.name.toLowerCase() === nickname);
    const rank = record ? 1 + rows.filter(row => row.score > record.score).length : null;
    best.textContent = record
      ? 'Your best: ' + record.score + ' points · Rank #' + rank
      : 'Your best will appear here!';

    scoreList.replaceChildren();
    document.querySelector('#scores-empty').hidden = rows.length > 0;
    let place = 0;
    rows.slice(0, 10).forEach((row, index) => {
      if (row.score !== rows[index - 1]?.score) place = index + 1;
      const item = document.createElement('li');
      const badge = document.createElement('span');
      badge.className = 'score-rank';
      badge.textContent = '#' + place;
      const name = document.createElement('span');
      name.textContent = row === record ? row.name + ' (you)' : row.name;
      const points = document.createElement('strong');
      points.textContent = String(row.score);
      item.classList.toggle('your-score', row === record);
      item.append(badge, name, points);
      scoreList.append(item);
    });
  }

  nameInput.addEventListener('input', render);
  levelFilter?.addEventListener('change', render);
  periodFilter.addEventListener('change', render);
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
      if (!name) {
        nameInput.value = '';
        nameInput.reportValidity();
        nameInput.focus();
        return false;
      }
      player = { name, level };
      try { localStorage.setItem(nameKey, name); } catch {}
      nameInput.readOnly = true;
      readyCard.hidden = scoreCard.hidden = true;
      return true;
    },
    clear() { readyCard.hidden = scoreCard.hidden = true; },
    showLevel(level) {
      levelFilter.value = level;
      render();
    },
    finish(score, completed) {
      nameInput.readOnly = false;
      document.querySelector('#final-score').textContent = String(score);
      let caption = completed ? 'Great game!' : 'Round stopped';
      if (completed) {
        const { name, level } = player;
        for (const board of [level, level + ':' + weekKey()]) {
          const rows = read(board);
          const previous = rows.find(row => row.name.toLowerCase() === name.toLowerCase());
          if (previous && score <= previous.score) continue;
          const updated = rows.filter(row => row !== previous);
          updated.push({ name, score });
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
        if (levelFilter) levelFilter.value = level;
        render();
      }
      scoreCard.querySelector('p').textContent = caption;
      scoreCard.hidden = false;
    }
  };
})();
