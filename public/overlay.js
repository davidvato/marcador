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

function renderCustomFields(fields, state) {
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

  const isTeam1Top = state && state.topTeam !== 2;
  const topTeam = isTeam1Top ? state?.team1 : state?.team2;
  const bottomTeam = isTeam1Top ? state?.team2 : state?.team1;

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
      const topVal = isTeam1Top ? field.team1Value : field.team2Value;
      const bottomVal = isTeam1Top ? field.team2Value : field.team1Value;

      const v1 = document.createElement('span');
      v1.className = 'cf-val-1';
      v1.style.color = topTeam?.color || '#60a5fa';
      v1.textContent = topVal ?? 0;

      const sep = document.createElement('span');
      sep.className = 'cf-sep';
      sep.textContent = '-';

      const v2 = document.createElement('span');
      v2.className = 'cf-val-2';
      v2.style.color = bottomTeam?.color || '#f87171';
      v2.textContent = bottomVal ?? 0;

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
    container.classList.remove('pos-top-center', 'pos-top-left', 'pos-top-right', 'pos-bottom-center');
    container.classList.add(state.overlayPosition || 'pos-top-center');
  }

  // Ventana de Tiempo Fuera con tiempo corriendo (ubicada en el marcador)
  const timeoutBanner = document.getElementById('timeout-overlay-banner');

  const activeSponsors = (state.sponsors || []).filter(s => s.visible !== false);
  const currentSponsorIdx = state.sponsorSettings?.currentSponsorIndex || 0;
  const currentSponsor = activeSponsors.length > 0 ? activeSponsors[currentSponsorIdx % activeSponsors.length] : null;

  if (state.activeTimeout && state.activeTimeout.secondsLeft > 0) {
    timeoutBanner.classList.remove('hidden');
    document.getElementById('tob-team-name').textContent = state.activeTimeout.teamName || 'EQUIPO';
    document.getElementById('tob-seconds').textContent = `${state.activeTimeout.secondsLeft}s`;
    if (state.activeTimeout.color) {
      timeoutBanner.style.borderLeftColor = state.activeTimeout.color;
    }
  } else {
    timeoutBanner.classList.add('hidden');
  }

  // Ventana APARTE de Patrocinadores al CENTRO DE LA PANTALLA durante Tiempo Fuera
  const centerSponsorModal = document.getElementById('timeout-center-sponsor-modal');
  if (state.activeTimeout && state.activeTimeout.secondsLeft > 0 && state.sponsorSettings?.showDuringTimeout && currentSponsor) {
    centerSponsorModal.classList.remove('hidden');
    const tcsmLogo = document.getElementById('tcsm-logo');
    const tcsmName = document.getElementById('tcsm-name');
    const tcsmDots = document.getElementById('tcsm-dots');

    if (currentSponsor.image) {
      tcsmLogo.src = currentSponsor.image;
      tcsmLogo.classList.remove('hidden');
    } else {
      tcsmLogo.classList.add('hidden');
    }
    tcsmName.textContent = currentSponsor.name || '';

    if (tcsmDots) {
      tcsmDots.innerHTML = '';
      if (activeSponsors.length > 1) {
        activeSponsors.forEach((_, i) => {
          const dot = document.createElement('span');
          dot.className = `tcsm-dot ${i === (currentSponsorIdx % activeSponsors.length) ? 'active' : ''}`;
          tcsmDots.appendChild(dot);
        });
      }
    }
  } else {
    if (centerSponsorModal) {
      centerSponsorModal.classList.add('hidden');
    }
  }

  // Patrocinadores durante el juego en vivo
  const gameSponsorBar = document.getElementById('game-sponsor-bar');
  if (state.sponsorSettings?.showDuringGame && currentSponsor && (!state.activeTimeout || !state.sponsorSettings?.showDuringTimeout)) {
    gameSponsorBar.classList.remove('hidden');
    const gsbImg = document.getElementById('gsb-img');
    const gsbName = document.getElementById('gsb-name');
    if (currentSponsor.image) {
      gsbImg.src = currentSponsor.image;
      gsbImg.classList.remove('hidden');
    } else {
      gsbImg.classList.add('hidden');
    }
    gsbName.textContent = currentSponsor.name || '';
  } else {
    gameSponsorBar.classList.add('hidden');
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

  // Identificar qué equipo está en la posición de arriba y cuál en la posición inferior
  const isTeam1Top = state.topTeam !== 2;
  const topTeam = isTeam1Top ? state.team1 : state.team2;
  const topNum = isTeam1Top ? 1 : 2;
  const bottomTeam = isTeam1Top ? state.team2 : state.team1;
  const bottomNum = isTeam1Top ? 2 : 1;

  // Ícono de deporte para servicio
  const currentIcon = sportIcons[state.sport] || '🏐';

  // --- FILA SUPERIOR (Posición de Arriba) ---
  document.getElementById('row-top-name').textContent = topTeam.name || (topNum === 1 ? 'LOCAL' : 'VISITANTE');
  document.getElementById('row-top-color-bar').style.backgroundColor = topTeam.color || '#2563eb';
  document.getElementById('row-top-sets').textContent = topTeam.setsWon ?? 0;

  const serveTop = document.getElementById('row-top-serve');
  serveTop.textContent = currentIcon;
  if (state.serving === topNum) {
    serveTop.classList.add('active');
  } else {
    serveTop.classList.remove('active');
  }

  const topTimeoutsSection = document.getElementById('row-top-timeouts-section');
  if (topTeam.timeoutsTotal && topTeam.timeoutsTotal > 0) {
    topTimeoutsSection.classList.remove('hidden');
    renderTimeouts(document.getElementById('row-top-timeouts'), topTeam.timeoutsTotal, topTeam.timeoutsUsed);
  } else {
    topTimeoutsSection.classList.add('hidden');
  }

  const scoreTopElem = document.getElementById('row-top-score');
  const prevTopScore = lastState ? (topNum === 1 ? lastState.team1?.score : lastState.team2?.score) : null;
  if (prevTopScore !== null && topTeam.score !== prevTopScore) {
    triggerScoreAnimation(scoreTopElem);
  }
  scoreTopElem.textContent = topTeam.score ?? 0;

  // --- FILA INFERIOR (Posición Inferior) ---
  document.getElementById('row-bottom-name').textContent = bottomTeam.name || (bottomNum === 1 ? 'LOCAL' : 'VISITANTE');
  document.getElementById('row-bottom-color-bar').style.backgroundColor = bottomTeam.color || '#dc2626';
  document.getElementById('row-bottom-sets').textContent = bottomTeam.setsWon ?? 0;

  const serveBottom = document.getElementById('row-bottom-serve');
  serveBottom.textContent = currentIcon;
  if (state.serving === bottomNum) {
    serveBottom.classList.add('active');
  } else {
    serveBottom.classList.remove('active');
  }

  const bottomTimeoutsSection = document.getElementById('row-bottom-timeouts-section');
  if (bottomTeam.timeoutsTotal && bottomTeam.timeoutsTotal > 0) {
    bottomTimeoutsSection.classList.remove('hidden');
    renderTimeouts(document.getElementById('row-bottom-timeouts'), bottomTeam.timeoutsTotal, bottomTeam.timeoutsUsed);
  } else {
    bottomTimeoutsSection.classList.add('hidden');
  }

  const scoreBottomElem = document.getElementById('row-bottom-score');
  const prevBottomScore = lastState ? (bottomNum === 1 ? lastState.team1?.score : lastState.team2?.score) : null;
  if (prevBottomScore !== null && bottomTeam.score !== prevBottomScore) {
    triggerScoreAnimation(scoreBottomElem);
  }
  scoreBottomElem.textContent = bottomTeam.score ?? 0;

  // Campos personalizados
  renderCustomFields(state.customFields, state);

  lastState = JSON.parse(JSON.stringify(state));
}

// Iniciar WebSocket
connectWebSocket();
