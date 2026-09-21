(() => {
  const controls = document.querySelector('.program-controls');
  const buttons = [...document.querySelectorAll('[data-day]')];
  const days = [...document.querySelectorAll('.agenda-day')];
  const sessions = [...document.querySelectorAll('.agenda-session')];
  const search = document.querySelector('#program-search');
  const clear = document.querySelector('#clear-search');
  const expand = document.querySelector('#expand-sessions');
  const status = document.querySelector('.program-status');
  const empty = document.querySelector('.program-empty');
  let selectedDay = 'mon';
  let savedOpenState = null;
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const visibleSessions = () => sessions.filter(session => !session.hidden && !session.closest('.agenda-day').hidden);

  function updateExpandLabel() {
    const visible = visibleSessions();
    const allOpen = visible.length > 0 && visible.every(session => session.open);
    expand.textContent = allOpen ? 'Collapse all sessions −' : 'Expand all sessions +';
    expand.hidden = !visible.length;
  }

  function render() {
    const query = normalize(search.value);
    const words = query.split(' ').filter(Boolean);
    if (query && !savedOpenState) savedOpenState = new Map(sessions.map(session => [session, session.open]));
    if (!query && savedOpenState) {
      sessions.forEach(session => { session.open = savedOpenState.get(session); });
      savedOpenState = null;
    }
    let matches = 0;
    for (const day of days) {
      let dayMatches = 0;
      for (const session of day.querySelectorAll('.agenda-session')) {
        const sessionName = session.querySelector('.session-name').textContent;
        let sessionMatches = 0;
        for (const talk of session.querySelectorAll('.talk')) {
          const text = normalize(`${sessionName} ${talk.textContent}`);
          const match = !query || words.every(word => text.includes(word));
          talk.hidden = !match;
          if (match) sessionMatches++;
        }
        session.hidden = !!query && !sessionMatches;
        if (query) session.open = sessionMatches > 0;
        dayMatches += sessionMatches;
      }
      day.querySelectorAll('.agenda-event').forEach(event => { event.hidden = !!query; });
      day.hidden = query ? !dayMatches : selectedDay !== 'all' && day.id !== `day-${selectedDay}`;
      matches += dayMatches;
    }
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.day === (query ? 'all' : selectedDay))));
    clear.hidden = !query;
    empty.hidden = !query || matches > 0;
    status.textContent = query ? `${matches} ${matches === 1 ? 'result' : 'results'} across all days · Presentations & roundtable participants` : '';
    updateExpandLabel();
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    selectedDay = button.dataset.day;
    search.value = '';
    render();
  }));
  search.addEventListener('input', render);
  function resetSearch() { search.value = ''; render(); search.focus(); }
  clear.addEventListener('click', resetSearch);
  document.querySelector('#reset-search').addEventListener('click', resetSearch);
  search.addEventListener('keydown', event => { if (event.key === 'Escape') resetSearch(); });
  expand.addEventListener('click', () => {
    const visible = visibleSessions();
    const shouldOpen = !visible.every(session => session.open);
    visible.forEach(session => { session.open = shouldOpen; });
    updateExpandLabel();
  });
  sessions.forEach(session => session.addEventListener('toggle', updateExpandLabel));
  let printState;
  window.addEventListener('beforeprint', () => {
    printState = sessions.map(session => session.open);
    sessions.forEach(session => { session.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (printState) sessions.forEach((session, i) => { session.open = printState[i]; });
  });
  controls.hidden = false;
  render();
})();
