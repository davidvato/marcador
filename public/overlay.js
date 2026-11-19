// Cliente de Overlay para OBS Studio / Streamlabs / vMix
let ws = null;
let lastState = null;

const sportIcons = {
  volleyball: '🏐',
  basketball: '🏀',
  padel: '🎾',
  soccer: '⚽',
  custom: '🎯'
};

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[Overlay] Conectado al servidor WebSocket');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'STATE_UPDATE' && data.payload) {
        renderOverlay(data.payload);
      }
    } catch (err) {
      console.error('[Overlay] Error al procesar datos:', err);
    }
  };

  ws.onclose = () => {
    console.warn('[Overlay] Conexión perdida. Reconectando en 2 segundos...');
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error('[Overlay] Error en socket:', err);
    ws.close();
  };
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function renderTimeouts(container, total, used) {
  container.innerHTML = '';
  if (!total || total <= 0) return;

  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'timeout-dot';
    // Si el índice está dentro de los usados, marcarlo como usado
    if (i < used) {
      dot.classList.add('used');
    }
    container.appendChild(dot);
  }
}

function renderCustomFields(fields) {
  const container = document.getElementById('custom-fields-bar');
  if (!container) return;

  const activeFields = (fields || []).filter(f => f.visible !== false);

  if (activeFields.length === 0) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = '';

  activeFields.forEach(field => {
    const item = document.createElement('div');
    item.className = 'custom-field-item';

    const label = document.createElement('span');
    label.className = 'custom-field-label';
    label.textContent = field.label;
    item.appendChild(label);

    const values = document.createElement('div');
    values.className = 'custom-field-values';

    if (field.type === 'teamCounter' || field.type === 'teamText') {
      const v1 = document.createElement('span');
      v1.className = 'cf-val-1';
      v1.textContent = field.team1Value ?? 0;

      const sep = document.createElement('span');
      sep.className = 'cf-sep';
      sep.textContent = '-';

      const v2 = document.createElement('span');
      v2.className = 'cf-val-2';
      v2.textContent = field.team2Value ?? 0;

      values.appendChild(v1);
      values.appendChild(sep);
      values.appendChild(v2);
    } else {
      // Global
      const gv = document.createElement('span');
      gv.className = 'cf-global-val';
      gv.textContent = field.value ?? '';
      values.appendChild(gv);
    }

    item.appendChild(values);
    container.appendChild(item);
  });
}

function triggerScoreAnimation(elem) {
  elem.classList.remove('score-pop');
  // Trigger reflow to restart CSS animation
  void elem.offsetWidth;
  elem.classList.add('score-pop');
}

function renderOverlay(state) {
  // Posición
  const container = document.getElementById('overlay-container');
  if (container) {
    container.classList.remove('pos-top-center', 'pos-top-left', 'pos-bottom-center');
    container.classList.add(state.overlayPosition || 'pos-top-center');
  }

  // Metadatos
  document.getElementById('tournament-name').textContent = state.tournament || 'TORNEO DEPORTIVO';
  document.getElementById('match-stage').textContent = state.stage || 'FASE REGULAR';
  document.getElementById('current-set-num').textContent = state.currentSet || 1;

  if (state.maxSets) {
    document.getElementById('max-sets-container').classList.remove('hidden');
    document.getElementById('max-sets-num').textContent = state.maxSets;
  } else {
    document.getElementById('max-sets-container').classList.add('hidden');
  }

  // Temporizador
  const timerBadge = document.getElementById('timer-badge');
  if (state.timer && (state.timer.seconds > 0 || state.timer.running)) {
    timerBadge.classList.remove('hidden');
    document.getElementById('timer-display').textContent = formatTimer(state.timer.seconds);
  } else {
    timerBadge.classList.add('hidden');
  }

  // Ícono de deporte para servicio
  const currentIcon = sportIcons[state.sport] || '🏐';
  const serve1 = document.getElementById('team1-serve');
  const serve2 = document.getElementById('team2-serve');
  serve1.textContent = currentIcon;
  serve2.textContent = currentIcon;

  if (state.serving === 1) {
    serve1.classList.add('active');
    serve2.classList.remove('active');
  } else if (state.serving === 2) {
    serve1.classList.remove('active');
    serve2.classList.add('active');
  } else {
    serve1.classList.remove('active');
    serve2.classList.remove('active');
  }

  // Equipo 1
  document.getElementById('team1-name').textContent = state.team1.name || 'EQUIPO 1';
  document.getElementById('team1-color-bar').style.backgroundColor = state.team1.color || '#2563eb';
  document.getElementById('team1-sets').textContent = state.team1.setsWon ?? 0;

  const score1Elem = document.getElementById('team1-score');
  if (lastState && lastState.team1 && state.team1.score !== lastState.team1.score) {
    triggerScoreAnimation(score1Elem);
  }
  score1Elem.textContent = state.team1.score ?? 0;
  renderTimeouts(document.getElementById('team1-timeouts'), state.team1.timeoutsTotal, state.team1.timeoutsUsed);

  // Equipo 2
  document.getElementById('team2-name').textContent = state.team2.name || 'EQUIPO 2';
  document.getElementById('team2-color-bar').style.backgroundColor = state.team2.color || '#dc2626';
  document.getElementById('team2-sets').textContent = state.team2.setsWon ?? 0;

  const score2Elem = document.getElementById('team2-score');
  if (lastState && lastState.team2 && state.team2.score !== lastState.team2.score) {
    triggerScoreAnimation(score2Elem);
  }
  score2Elem.textContent = state.team2.score ?? 0;
  renderTimeouts(document.getElementById('team2-timeouts'), state.team2.timeoutsTotal, state.team2.timeoutsUsed);

  // Campos personalizados
  renderCustomFields(state.customFields);

  lastState = JSON.parse(JSON.stringify(state));
}

// Iniciar WebSocket
connectWebSocket();
