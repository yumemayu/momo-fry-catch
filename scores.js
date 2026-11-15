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
  const ONLINE_URL = 'https://script.google.com/macros/s/AKfycbwIZWAIOqgmjctFItur6QacLZqf2zL6paAyLxFeCoV1cAnD2O3yV70ZiKiprBi1xTdIVQ/exec';
  let source = 'local';
  const onlineCache = new Map();
  let onlineState = 'idle';
  let player;
  let formatStage = (_, fallback) => fallback;
  let nicknameState = '';
  const saveNicknameButton = document.createElement('button');
  saveNicknameButton.type = 'button';
  saveNicknameButton.className = 'save-nickname';
  const nicknameFeedback = document.createElement('small');
  nicknameFeedback.className = 'nickname-saved';
  nicknameFeedback.setAttribute('role', 'status');
  nameInput.parentElement.append(saveNicknameButton, nicknameFeedback);

  try {
    nameInput.value = localStorage.getItem(nameKey) || '';
    if (nameInput.value) nicknameState = 'saved';
  } catch {}

  function renderNickname() {
    saveNicknameButton.textContent = momoLanguage.pick('Save nickname', 'ニックネームを保存');
    const messages = {
      saved: ['Nickname saved on this device.', 'この端末にニックネームを保存しました。'],
      cleared: ['Saved nickname cleared.', '保存したニックネームを消しました。'],
      unavailable: ['Could not save on this device.', 'この端末には保存できませんでした。']
    };
    nicknameFeedback.textContent = nicknameState ? momoLanguage.pick(...messages[nicknameState]) : '';
  }

  function saveNickname() {
    const name = nameInput.value.trim();
    nameInput.value = name;
    try {
      if (name) localStorage.setItem(nameKey, name);
      else localStorage.removeItem(nameKey);
      nicknameState = name ? 'saved' : 'cleared';
    } catch { nicknameState = 'unavailable'; }
    renderNickname();
    render();
    return name;
  }

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

  function drawRows(rows, record) {
    scoreList.replaceChildren();
    let place = 0;
    rows.slice(0, 10).forEach((row, index) => {
      if (row.score !== rows[index - 1]?.score) place = index + 1;
      const item = document.createElement('li');
      const badge = document.createElement('span');
      badge.className = 'score-rank';
      badge.textContent = '#' + place;
      const name = document.createElement('span');
      name.textContent = row === record ? row.name + momoLanguage.pick(' (you)', '（あなた）') : row.name;
      if (typeof row.stageName === 'string' && row.stageName) {
        const stage = document.createElement('small');
        stage.className = 'score-stage';
        stage.textContent = ' · ' + formatStage(row.stage, row.stageName);
        name.append(stage);
      }
      const points = document.createElement('strong');
      points.textContent = String(row.score);
      item.classList.toggle('your-score', row === record);
      item.append(badge, name, points);
      scoreList.append(item);
    });
  }

  function bestLine(rows, record) {
    const rank = record ? 1 + rows.filter(row => row.score > record.score).length : null;
    return record
      ? momoLanguage.pick(`Your best: ${record.score} points · Rank #${rank}`, `ベスト：${record.score}点 · ${rank}位`)
      : rows.length ? momoLanguage.pick('Your best: —', 'ベスト：—') : momoLanguage.pick('No scores yet', 'まだスコアがありません');
  }

  function render() {
    if (levelLabel) levelLabel.textContent = Array.from(document.querySelectorAll('[data-level]')).find(button => button.dataset.level === level)?.lastElementChild.textContent || '';
    if (source === 'online') { renderOnline(); return; }
    const board = period === 'weekly' ? level + ':' + weekKey() : level;
    const rows = read(board);
    const nickname = nameInput.value.trim().toLowerCase();
    const record = rows.find(row => row.name.toLowerCase() === nickname);
    best.textContent = bestLine(rows, record);
    drawRows(rows, record);
  }

  function onlineKey() { return level + '|' + period; }

  function renderOnline() {
    const rows = onlineCache.get(onlineKey()) || [];
    const nickname = nameInput.value.trim().toLowerCase();
    const record = rows.find(row => row.name.toLowerCase() === nickname);
    best.textContent = onlineState === 'loading'
      ? momoLanguage.pick('Loading…', '読み込み中…')
      : onlineState === 'error'
        ? momoLanguage.pick('Could not load the online board.', 'オンラインランキングを読み込めませんでした')
        : bestLine(rows, record);
    drawRows(onlineState === 'idle' ? rows : [], record);
  }

  async function fetchOnline() {
    if (!ONLINE_URL || source !== 'online') return;
    const key = onlineKey();
    if (onlineCache.has(key)) { render(); return; }
    onlineState = 'loading';
    render();
    try {
      const query = '?game=' + encodeURIComponent(document.body.dataset.game)
        + '&level=' + encodeURIComponent(level)
        + '&period=' + (period === 'weekly' ? 'week' : 'all');
      const response = await fetch(ONLINE_URL + query);
      const data = await response.json();
      onlineCache.set(key, Array.isArray(data.rows) ? data.rows : []);
      onlineState = 'idle';
    } catch { onlineState = 'error'; }
    render();
  }

  function refreshBoard() {
    if (source === 'online') fetchOnline();
    else render();
  }

  nameInput.addEventListener('input', () => {
    nicknameState = '';
    renderNickname();
    render();
  });
  saveNicknameButton.addEventListener('click', saveNickname);
  nameInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing || nameInput.readOnly) return;
    event.preventDefault();
    saveNickname();
  });
  periodButtons.forEach(button => button.addEventListener('click', () => {
    period = button.dataset.period;
    periodButtons.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    refreshBoard();
  }));
  const sourceButtons = {};
  if (ONLINE_URL) {
    const sourceGroup = document.createElement('div');
    sourceGroup.className = 'score-period score-source';
    sourceGroup.setAttribute('role', 'group');
    sourceGroup.setAttribute('aria-label', 'Ranking source');
    for (const key of ['local', 'online']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.source = key;
      button.setAttribute('aria-pressed', String(key === 'local'));
      button.addEventListener('click', () => {
        source = key;
        renderSourceButtons();
        refreshBoard();
      });
      sourceButtons[key] = button;
      sourceGroup.append(button);
    }
    document.querySelector('.score-period')?.after(sourceGroup);
  }
  function renderSourceButtons() {
    if (sourceButtons.local) sourceButtons.local.textContent = momoLanguage.pick('This device', 'この端末');
    if (sourceButtons.online) sourceButtons.online.textContent = momoLanguage.pick('Everyone', 'みんな');
    for (const key in sourceButtons) sourceButtons[key].setAttribute('aria-pressed', String(key === source));
  }
  renderSourceButtons();
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
    onlineCache.clear();
    refreshBoard();
  }, 1000);
  momoLanguage.subscribe(() => {
    renderNickname();
    renderSourceButtons();
    render();
  });

  return {
    start(level = 'standard') {
      const name = saveNickname();
      player = { name, level };
      nameInput.readOnly = true;
      changePlayer.hidden = true;
      readyCard.hidden = scoreCard.hidden = true;
    },
    clear() { readyCard.hidden = scoreCard.hidden = true; },
    showLevel(selectedLevel) {
      level = selectedLevel;
      refreshBoard();
    },
    setStageFormatter(formatter) {
      formatStage = formatter;
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
        if (ONLINE_URL) {
          onlineCache.clear();
          fetch(ONLINE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ game: document.body.dataset.game, level, name, score, completed: 1, stage: growth?.stage || 0, stageName: growth?.stageName || '' }),
            keepalive: true
          }).then(() => { if (source === 'online') fetchOnline(); }).catch(() => {});
        }
      }
      scoreCard.querySelector('p').textContent = caption;
      scoreCard.hidden = false;
    }
  };
})();
