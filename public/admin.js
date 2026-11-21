// Controlador del Panel de Administración (Operator Dashboard)
let ws = null;
let currentState = null;

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  const pill = document.getElementById('connection-pill');
  const text = document.getElementById('connection-text');

  ws.onopen = () => {
    pill.className = 'status-pill online';
    text.textContent = 'En Vivo';
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'STATE_UPDATE' && data.payload) {
        currentState = data.payload;
        renderAdminUI(data.payload);
      }
    } catch (err) {
      console.error('[Admin] Error al procesar mensaje:', err);
    }
  };

  ws.onclose = () => {
    pill.className = 'status-pill offline';
    text.textContent = 'Desconectado';
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error('[Admin] Error en WebSocket:', err);
    ws.close();
  };
}

function sendAction(type, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'ACTION',
      action: { type, payload }
    }));
  } else {
    // Fallback REST si WebSocket aún no está listo
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    }).catch(err => console.error('Error al enviar acción:', err));
  }
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function renderAdminUI(state) {
  // Preset selector
  const presetSelect = document.getElementById('preset-select');
  if (presetSelect && state.sport && document.activeElement !== presetSelect) {
    presetSelect.value = state.sport;
  }

  // Deshacer / Rehacer
  document.getElementById('btn-undo').disabled = !state.canUndo;
  document.getElementById('btn-redo').disabled = !state.canRedo;

  // Equipo 1
  const t1Name = document.getElementById('t1-name');
  if (document.activeElement !== t1Name) t1Name.value = state.team1.name || '';
  document.getElementById('t1-color').value = state.team1.color || '#2563eb';
  document.getElementById('t1-score-display').textContent = state.team1.score ?? 0;
  document.getElementById('t1-sets-display').textContent = state.team1.setsWon ?? 0;
  
  const t1Used = state.team1.timeoutsUsed ?? 0;
  const t1Total = state.team1.timeoutsTotal ?? 2;
  const t1Avail = Math.max(0, t1Total - t1Used);
  document.getElementById('t1-timeouts-display').textContent = `Disponibles: ${t1Avail}/${t1Total}`;

  // Equipo 2
  const t2Name = document.getElementById('t2-name');
  if (document.activeElement !== t2Name) t2Name.value = state.team2.name || '';
  document.getElementById('t2-color').value = state.team2.color || '#dc2626';
  document.getElementById('t2-score-display').textContent = state.team2.score ?? 0;
  document.getElementById('t2-sets-display').textContent = state.team2.setsWon ?? 0;

  const t2Used = state.team2.timeoutsUsed ?? 0;
  const t2Total = state.team2.timeoutsTotal ?? 2;
  const t2Avail = Math.max(0, t2Total - t2Used);
  document.getElementById('t2-timeouts-display').textContent = `Disponibles: ${t2Avail}/${t2Total}`;

  // Saque / Posesión
  const t1ServeBtn = document.getElementById('t1-serve-btn');
  const t2ServeBtn = document.getElementById('t2-serve-btn');
  if (state.serving === 1) {
    t1ServeBtn.classList.add('active');
    t2ServeBtn.classList.remove('active');
  } else if (state.serving === 2) {
    t1ServeBtn.classList.remove('active');
    t2ServeBtn.classList.add('active');
  } else {
    t1ServeBtn.classList.remove('active');
    t2ServeBtn.classList.remove('active');
  }

  // Posición de Equipos en el Marcador (Arriba vs Inferior)
  const isTeam1Top = state.topTeam !== 2;
  const t1Badge = document.getElementById('t1-pos-badge');
  const t2Badge = document.getElementById('t2-pos-badge');
  if (t1Badge && t2Badge) {
    if (isTeam1Top) {
      t1Badge.textContent = '⬆ Posición Arriba';
      t1Badge.className = 'pos-badge pos-top';
      t2Badge.textContent = '⬇ Posición Inferior';
      t2Badge.className = 'pos-badge pos-bottom';
    } else {
      t1Badge.textContent = '⬇ Posición Inferior';
      t1Badge.className = 'pos-badge pos-bottom';
      t2Badge.textContent = '⬆ Posición Arriba';
      t2Badge.className = 'pos-badge pos-top';
    }
  }

  // Anuncio / Modal de Tiempo Fuera
  const timeoutModal = document.getElementById('timeout-admin-modal');
  if (timeoutModal) {
    if (state.activeTimeout && state.activeTimeout.secondsLeft > 0) {
      timeoutModal.classList.remove('hidden');
      document.getElementById('timeout-admin-team').textContent = state.activeTimeout.teamName || 'EQUIPO';
      document.getElementById('timeout-admin-seconds').textContent = `${state.activeTimeout.secondsLeft}s`;

      // Vista previa de patrocinador en rotación durante tiempo fuera
      const msp = document.getElementById('modal-sponsor-preview');
      if (msp) {
        const activeSponsors = (state.sponsors || []).filter(s => s.visible !== false);
        if (state.sponsorSettings?.showDuringTimeout && activeSponsors.length > 0) {
          const curIdx = state.sponsorSettings.currentSponsorIndex || 0;
          const curSp = activeSponsors[curIdx % activeSponsors.length];
          msp.classList.remove('hidden');
          const mspLogo = document.getElementById('msp-logo');
          const mspName = document.getElementById('msp-name');
          if (curSp.image) {
            mspLogo.src = curSp.image;
            mspLogo.classList.remove('hidden');
          } else {
            mspLogo.classList.add('hidden');
          }
          mspName.textContent = curSp.name || '';
        } else {
          msp.classList.add('hidden');
        }
      }
    } else {
      timeoutModal.classList.add('hidden');
    }
  }

  // Barra de Tiempo Fuera Activo en el panel
  const activeBar = document.getElementById('admin-active-timeout-bar');
  if (activeBar) {
    if (state.activeTimeout && state.activeTimeout.secondsLeft > 0) {
      activeBar.classList.remove('hidden');
      document.getElementById('aatb-team-name').textContent = state.activeTimeout.teamName || 'EQUIPO';
      document.getElementById('aatb-seconds').textContent = `${state.activeTimeout.secondsLeft}s`;
    } else {
      activeBar.classList.add('hidden');
    }
  }

  // Ajustes de Tiempo Fuera
  const defDurInput = document.getElementById('timeout-default-dur');
  if (defDurInput && document.activeElement !== defDurInput) {
    defDurInput.value = state.timeoutSettings?.defaultDuration || 30;
  }

  // Configuración de Patrocinadores
  const chkTimeout = document.getElementById('sp-show-timeout');
  if (chkTimeout && document.activeElement !== chkTimeout) {
    chkTimeout.checked = Boolean(state.sponsorSettings?.showDuringTimeout);
  }

  const chkGame = document.getElementById('sp-show-game');
  if (chkGame && document.activeElement !== chkGame) {
    chkGame.checked = Boolean(state.sponsorSettings?.showDuringGame);
  }

  const spDelayInput = document.getElementById('sp-delay-input');
  if (spDelayInput && document.activeElement !== spDelayInput) {
    spDelayInput.value = state.sponsorSettings?.rotationDelay || 5;
  }

  // Lista de Patrocinadores
  renderSponsorsList(state.sponsors || [], state.sponsorSettings?.currentSponsorIndex || 0);

  // Metadatos
  const metaTourn = document.getElementById('meta-tournament');
  if (document.activeElement !== metaTourn) metaTourn.value = state.tournament || '';

  const metaStage = document.getElementById('meta-stage');
  if (document.activeElement !== metaStage) metaStage.value = state.stage || '';

  document.getElementById('current-set-display').textContent = state.currentSet || 1;

  const maxSets = document.getElementById('meta-max-sets');
  if (document.activeElement !== maxSets) maxSets.value = state.maxSets || 3;

  const overlayPos = document.getElementById('meta-overlay-pos');
  if (document.activeElement !== overlayPos) overlayPos.value = state.overlayPosition || 'pos-top-center';

  // Temporizador
  document.getElementById('admin-timer-display').textContent = formatTimer(state.timer ? state.timer.seconds : 0);
  const timerToggleBtn = document.getElementById('timer-toggle-btn');
  if (state.timer && state.timer.running) {
    timerToggleBtn.textContent = 'Pausar';
    timerToggleBtn.className = 'btn btn-warning';
  } else {
    timerToggleBtn.textContent = 'Iniciar';
    timerToggleBtn.className = 'btn btn-primary';
  }

  // Campos personalizados
  renderCustomFieldsAdmin(state.customFields || []);
}

function renderSponsorsList(sponsors, activeIndex) {
  const container = document.getElementById('sponsors-list');
  const countBadge = document.getElementById('sponsors-count');
  if (!container) return;

  if (countBadge) countBadge.textContent = (sponsors || []).length;
  container.innerHTML = '';

  if (!sponsors || sponsors.length === 0) {
    container.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; padding: 10px 0;">No hay patrocinadores registrados. Añade uno con el formulario a la derecha.</p>';
    return;
  }

  sponsors.forEach(sp => {
    const item = document.createElement('div');
    item.className = 'sponsor-item-card';

    const left = document.createElement('div');
    left.className = 'sponsor-item-left';

    if (sp.image) {
      const img = document.createElement('img');
      img.className = 'sponsor-logo-thumb';
      img.src = sp.image;
      img.alt = sp.name || 'Logo';
      left.appendChild(img);
    } else {
      const noLogo = document.createElement('div');
      noLogo.className = 'sponsor-logo-thumb';
      noLogo.style.display = 'flex';
      noLogo.style.alignItems = 'center';
      noLogo.style.justifyContent = 'center';
      noLogo.style.color = '#64748b';
      noLogo.style.fontSize = '0.7rem';
      noLogo.style.fontWeight = '700';
      noLogo.textContent = 'TEXTO';
      left.appendChild(noLogo);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'sponsor-item-name';
    nameSpan.textContent = sp.name || '(Sin nombre)';
    left.appendChild(nameSpan);

    item.appendChild(left);

    const actions = document.createElement('div');
    actions.className = 'sponsor-item-actions';

    const btnVis = document.createElement('button');
    btnVis.className = `btn btn-sm ${sp.visible ? 'btn-outline' : 'btn-secondary'}`;
    btnVis.textContent = sp.visible ? '👁 Visible' : '👁‍🗨 Oculto';
    btnVis.onclick = () => sendAction('TOGGLE_SPONSOR', { id: sp.id });
    actions.appendChild(btnVis);

    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-sm btn-danger';
    btnDel.textContent = '✕';
    btnDel.title = 'Eliminar patrocinador';
    btnDel.onclick = () => {
      if (confirm(`¿Eliminar el patrocinador "${sp.name}"?`)) {
        sendAction('REMOVE_SPONSOR', { id: sp.id });
      }
    };
    actions.appendChild(btnDel);

    item.appendChild(actions);
    container.appendChild(item);
  });
}

function renderCustomFieldsAdmin(fields) {
  const container = document.getElementById('custom-fields-list');
  if (!container) return;

  // Evitar sobreescribir inputs de texto si el usuario está escribiendo
  const activeId = document.activeElement ? document.activeElement.getAttribute('data-field-id') : null;
  if (activeId) return;

  container.innerHTML = '';

  if (fields.length === 0) {
    container.innerHTML = '<p style="color: #64748b; font-size: 0.85rem; grid-column: 1/-1;">No hay campos personalizados activos. Puedes crear uno abajo (ej: Faltas, Tarjetas, Sponsors).</p>';
    return;
  }

  fields.forEach(field => {
    const card = document.createElement('div');
    card.className = 'field-item-card';

    // Header del campo
    const header = document.createElement('div');
    header.className = 'field-item-header';

    const label = document.createElement('span');
    label.className = 'field-label';
    label.textContent = field.label;
    header.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'field-item-actions';

    // Botón de visibilidad (Ojo)
    const btnVis = document.createElement('button');
    btnVis.className = `btn btn-sm ${field.visible ? 'btn-outline' : 'btn-secondary'}`;
    btnVis.textContent = field.visible ? '👁 Visible' : '👁‍🗨 Oculto';
    btnVis.onclick = () => sendAction('TOGGLE_CUSTOM_FIELD', { id: field.id });
    actions.appendChild(btnVis);

    // Botón eliminar
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-sm btn-danger';
    btnDel.textContent = '✕';
    btnDel.title = 'Eliminar campo';
    btnDel.onclick = () => {
      if (confirm(`¿Eliminar el campo "${field.label}"?`)) {
        sendAction('REMOVE_CUSTOM_FIELD', { id: field.id });
      }
    };
    actions.appendChild(btnDel);

    header.appendChild(actions);
    card.appendChild(header);

    // Controles según el tipo
    const controls = document.createElement('div');
    controls.className = 'field-controls-row';

    if (field.type === 'teamCounter') {
      // Contador Local
      const c1 = document.createElement('div');
      c1.className = 'team-cf-control';
      c1.innerHTML = `
        <span style="color: #60a5fa;">L:</span>
        <button class="btn btn-sm btn-outline btn-cf-t1-minus">-</button>
        <span style="color: #f8fafc; font-size: 1rem;">${field.team1Value ?? 0}</span>
        <button class="btn btn-sm btn-outline btn-cf-t1-plus">+</button>
      `;
      c1.querySelector('.btn-cf-t1-minus').onclick = () => sendAction('UPDATE_CUSTOM_FIELD', { id: field.id, team: 1, delta: -1 });
      c1.querySelector('.btn-cf-t1-plus').onclick = () => sendAction('UPDATE_CUSTOM_FIELD', { id: field.id, team: 1, delta: 1 });

      // Contador Visitante
      const c2 = document.createElement('div');
      c2.className = 'team-cf-control';
      c2.innerHTML = `
        <span style="color: #f87171;">V:</span>
        <button class="btn btn-sm btn-outline btn-cf-t2-minus">-</button>
        <span style="color: #f8fafc; font-size: 1rem;">${field.team2Value ?? 0}</span>
        <button class="btn btn-sm btn-outline btn-cf-t2-plus">+</button>
      `;
      c2.querySelector('.btn-cf-t2-minus').onclick = () => sendAction('UPDATE_CUSTOM_FIELD', { id: field.id, team: 2, delta: -1 });
      c2.querySelector('.btn-cf-t2-plus').onclick = () => sendAction('UPDATE_CUSTOM_FIELD', { id: field.id, team: 2, delta: 1 });

      controls.appendChild(c1);
      controls.appendChild(c2);
    } else if (field.type === 'globalCounter') {
      const gc = document.createElement('div');
      gc.className = 'team-cf-control';
      gc.innerHTML = `
        <button class="btn btn-sm btn-outline btn-gc-minus">-</button>
        <span style="color: #38bdf8; font-size: 1.1rem;">${field.value ?? 0}</span>
        <button class="btn btn-sm btn-outline btn-gc-plus">+</button>
      `;
      gc.querySelector('.btn-gc-minus').onclick = () => sendAction('UPDATE_CUSTOM_FIELD', { id: field.id, delta: -1 });
      gc.querySelector('.btn-gc-plus').onclick = () => sendAction('UPDATE_CUSTOM_FIELD', { id: field.id, delta: 1 });
      controls.appendChild(gc);
    } else {
      // Texto global o textos
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'form-input';
      inp.style.width = '100%';
      inp.value = field.value || '';
      inp.placeholder = 'Texto a mostrar en overlay...';
      inp.setAttribute('data-field-id', field.id);
      inp.onchange = (e) => sendAction('UPDATE_CUSTOM_FIELD', { id: field.id, value: e.target.value });
      controls.appendChild(inp);
    }

    card.appendChild(controls);
    container.appendChild(card);
  });
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
  // --- EQUIPO 1 ---
  document.getElementById('t1-plus-1').onclick = () => sendAction('UPDATE_SCORE', { team: 1, delta: 1 });
  document.getElementById('t1-minus-1').onclick = () => sendAction('UPDATE_SCORE', { team: 1, delta: -1 });
  document.getElementById('t1-plus-2').onclick = () => sendAction('UPDATE_SCORE', { team: 1, delta: 2 });
  document.getElementById('t1-plus-3').onclick = () => sendAction('UPDATE_SCORE', { team: 1, delta: 3 });
  document.getElementById('t1-set-plus').onclick = () => sendAction('UPDATE_SETS', { team: 1, delta: 1 });
  document.getElementById('t1-set-minus').onclick = () => sendAction('UPDATE_SETS', { team: 1, delta: -1 });
  document.getElementById('t1-timeout-use').onclick = () => sendAction('UPDATE_TIMEOUT', { team: 1, delta: 1 });
  document.getElementById('t1-timeout-restore').onclick = () => sendAction('UPDATE_TIMEOUT', { team: 1, delta: -1 });
  document.getElementById('t1-serve-btn').onclick = () => {
    const newServing = (currentState && currentState.serving === 1) ? 0 : 1;
    sendAction('SET_SERVING', { serving: newServing });
  };
  document.getElementById('t1-name').onchange = (e) => sendAction('UPDATE_TEAM', { team: 1, name: e.target.value });
  document.getElementById('t1-color').onchange = (e) => sendAction('UPDATE_TEAM', { team: 1, color: e.target.value });

  // --- EQUIPO 2 ---
  document.getElementById('t2-plus-1').onclick = () => sendAction('UPDATE_SCORE', { team: 2, delta: 1 });
  document.getElementById('t2-minus-1').onclick = () => sendAction('UPDATE_SCORE', { team: 2, delta: -1 });
  document.getElementById('t2-plus-2').onclick = () => sendAction('UPDATE_SCORE', { team: 2, delta: 2 });
  document.getElementById('t2-plus-3').onclick = () => sendAction('UPDATE_SCORE', { team: 2, delta: 3 });
  document.getElementById('t2-set-plus').onclick = () => sendAction('UPDATE_SETS', { team: 2, delta: 1 });
  document.getElementById('t2-set-minus').onclick = () => sendAction('UPDATE_SETS', { team: 2, delta: -1 });
  document.getElementById('t2-timeout-use').onclick = () => sendAction('UPDATE_TIMEOUT', { team: 2, delta: 1 });
  document.getElementById('t2-timeout-restore').onclick = () => sendAction('UPDATE_TIMEOUT', { team: 2, delta: -1 });
  document.getElementById('t2-serve-btn').onclick = () => {
    const newServing = (currentState && currentState.serving === 2) ? 0 : 2;
    sendAction('SET_SERVING', { serving: newServing });
  };
  document.getElementById('t2-name').onchange = (e) => sendAction('UPDATE_TEAM', { team: 2, name: e.target.value });
  document.getElementById('t2-color').onchange = (e) => sendAction('UPDATE_TEAM', { team: 2, color: e.target.value });

  // --- METADATOS ---
  document.getElementById('meta-tournament').onchange = (e) => sendAction('UPDATE_META', { tournament: e.target.value });
  document.getElementById('meta-stage').onchange = (e) => sendAction('UPDATE_META', { stage: e.target.value });
  document.getElementById('meta-max-sets').onchange = (e) => sendAction('UPDATE_META', { maxSets: parseInt(e.target.value, 10) });
  document.getElementById('meta-overlay-pos').onchange = (e) => sendAction('UPDATE_META', { overlayPosition: e.target.value });
  
  document.getElementById('set-plus').onclick = () => {
    const current = currentState ? currentState.currentSet : 1;
    sendAction('SET_CURRENT_SET', { currentSet: current + 1 });
  };
  document.getElementById('set-minus').onclick = () => {
    const current = currentState ? currentState.currentSet : 1;
    sendAction('SET_CURRENT_SET', { currentSet: Math.max(1, current - 1) });
  };

  // --- TEMPORIZADOR ---
  document.getElementById('timer-toggle-btn').onclick = () => {
    const isRunning = currentState && currentState.timer && currentState.timer.running;
    sendAction('TIMER_ACTION', { action: isRunning ? 'pause' : 'start' });
  };
  document.getElementById('timer-reset-btn').onclick = () => {
    sendAction('TIMER_ACTION', { action: 'reset' });
  };

  // --- ACCIONES GLOBALES ---
  document.getElementById('btn-swap-teams').onclick = () => sendAction('SWAP_TEAMS');
  
  document.getElementById('btn-new-set').onclick = () => {
    if (confirm('¿Iniciar nuevo set? Se reiniciarán los puntos a 0 y se avanzará el número de set.')) {
      sendAction('RESET_SCORE');
      const current = currentState ? currentState.currentSet : 1;
      sendAction('SET_CURRENT_SET', { currentSet: current + 1 });
    }
  };

  document.getElementById('btn-reset-points').onclick = () => {
    if (confirm('¿Reiniciar puntos del set actual a 0?')) {
      sendAction('RESET_SCORE');
    }
  };

  document.getElementById('btn-reset-all').onclick = () => {
    if (confirm('⚠ ¿REINICIAR TODO EL PARTIDO? Esto pondrá en 0 los sets, puntos y tiempos fuera.')) {
      sendAction('RESET_MATCH');
    }
  };

  document.getElementById('btn-undo').onclick = () => sendAction('UNDO');
  document.getElementById('btn-redo').onclick = () => sendAction('REDO');

  // Deporte Preset
  document.getElementById('preset-select').onchange = (e) => {
    const sport = e.target.value;
    if (confirm(`¿Cambiar al perfil de ${e.target.options[e.target.selectedIndex].text}? Esto cargará los campos y reglas predeterminadas.`)) {
      sendAction('APPLY_PRESET', { sport });
    } else {
      if (currentState) e.target.value = currentState.sport;
    }
  };

  // Copiar link OBS
  document.getElementById('btn-copy-url').onclick = () => {
    const overlayUrl = `${window.location.protocol}//${window.location.host}/overlay`;
    navigator.clipboard.writeText(overlayUrl).then(() => {
      alert(`¡Enlace copiado al portapapeles!\n\n${overlayUrl}\n\nPégalo en OBS Studio como "Fuente del Navegador" (Browser Source) con tamaño 1920x1080.`);
    }).catch(() => {
      prompt('Copia este enlace para OBS Studio:', overlayUrl);
    });
  };

  // Botón para cerrar tiempo fuera desde el modal
  const btnCloseTimeout = document.getElementById('btn-close-timeout');
  if (btnCloseTimeout) {
    btnCloseTimeout.onclick = () => sendAction('DISMISS_TIMEOUT');
  }

  // Botón para cerrar tiempo fuera desde la barra de estado
  const btnBarCancel = document.getElementById('btn-bar-cancel-timeout');
  if (btnBarCancel) {
    btnBarCancel.onclick = () => sendAction('DISMISS_TIMEOUT');
  }

  // Ajustes de cronómetro de tiempo fuera en el modal
  const btnAdjMinus10 = document.getElementById('btn-adj-minus-10');
  if (btnAdjMinus10) btnAdjMinus10.onclick = () => sendAction('ADJUST_ACTIVE_TIMEOUT', { delta: -10 });

  const btnAdjMinus5 = document.getElementById('btn-adj-minus-5');
  if (btnAdjMinus5) btnAdjMinus5.onclick = () => sendAction('ADJUST_ACTIVE_TIMEOUT', { delta: -5 });

  const btnAdjPlus5 = document.getElementById('btn-adj-plus-5');
  if (btnAdjPlus5) btnAdjPlus5.onclick = () => sendAction('ADJUST_ACTIVE_TIMEOUT', { delta: 5 });

  const btnAdjPlus10 = document.getElementById('btn-adj-plus-10');
  if (btnAdjPlus10) btnAdjPlus10.onclick = () => sendAction('ADJUST_ACTIVE_TIMEOUT', { delta: 10 });

  // Configuración de Duración Predeterminada de Tiempo Fuera
  const btnDurMinus = document.getElementById('btn-timeout-dur-minus');
  if (btnDurMinus) {
    btnDurMinus.onclick = () => {
      const cur = currentState?.timeoutSettings?.defaultDuration || 30;
      sendAction('SET_TIMEOUT_DURATION', { duration: Math.max(5, cur - 5) });
    };
  }

  const btnDurPlus = document.getElementById('btn-timeout-dur-plus');
  if (btnDurPlus) {
    btnDurPlus.onclick = () => {
      const cur = currentState?.timeoutSettings?.defaultDuration || 30;
      sendAction('SET_TIMEOUT_DURATION', { duration: cur + 5 });
    };
  }

  const durInput = document.getElementById('timeout-default-dur');
  if (durInput) {
    durInput.onchange = (e) => {
      sendAction('SET_TIMEOUT_DURATION', { duration: parseInt(e.target.value, 10) || 30 });
    };
  }

  // Controles de Patrocinadores
  const spShowTimeout = document.getElementById('sp-show-timeout');
  if (spShowTimeout) {
    spShowTimeout.onchange = (e) => {
      sendAction('UPDATE_SPONSOR_SETTINGS', { showDuringTimeout: e.target.checked });
    };
  }

  const spShowGame = document.getElementById('sp-show-game');
  if (spShowGame) {
    spShowGame.onchange = (e) => {
      sendAction('UPDATE_SPONSOR_SETTINGS', { showDuringGame: e.target.checked });
    };
  }

  const spDelayInput = document.getElementById('sp-delay-input');
  if (spDelayInput) {
    spDelayInput.onchange = (e) => {
      sendAction('UPDATE_SPONSOR_SETTINGS', { rotationDelay: parseInt(e.target.value, 10) || 5 });
    };
  }

  // Manejo de carga de imágenes para Patrocinadores (URL o Archivo Local)
  let uploadedSponsorImage = '';
  const sponsorFileInput = document.getElementById('new-sponsor-file');
  const fileChosenText = document.getElementById('file-chosen-text');
  const sponsorPreviewWrapper = document.getElementById('sponsor-preview-wrapper');
  const sponsorPreviewImg = document.getElementById('new-sponsor-preview-img');
  const sponsorUrlInput = document.getElementById('new-sponsor-img-url');

  if (sponsorFileInput) {
    sponsorFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        fileChosenText.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          uploadedSponsorImage = loadEvent.target.result;
          sponsorPreviewImg.src = uploadedSponsorImage;
          sponsorPreviewWrapper.classList.remove('hidden');
          sponsorUrlInput.value = '';
        };
        reader.readAsDataURL(file);
      }
    };
  }

  if (sponsorUrlInput) {
    sponsorUrlInput.oninput = (e) => {
      const url = e.target.value.trim();
      if (url) {
        uploadedSponsorImage = '';
        sponsorPreviewImg.src = url;
        sponsorPreviewWrapper.classList.remove('hidden');
        if (fileChosenText) fileChosenText.textContent = 'Ningún archivo';
        if (sponsorFileInput) sponsorFileInput.value = '';
      } else {
        if (!uploadedSponsorImage && sponsorPreviewWrapper) {
          sponsorPreviewWrapper.classList.add('hidden');
        }
      }
    };
  }

  // Formulario Agregar Patrocinador
  const formAddSponsor = document.getElementById('form-add-sponsor');
  if (formAddSponsor) {
    formAddSponsor.onsubmit = (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('new-sponsor-name');
      const name = nameInput.value.trim();
      const image = uploadedSponsorImage || (sponsorUrlInput ? sponsorUrlInput.value.trim() : '');

      if (!name && !image) return;

      sendAction('ADD_SPONSOR', { name, image });

      nameInput.value = '';
      if (sponsorUrlInput) sponsorUrlInput.value = '';
      if (sponsorFileInput) sponsorFileInput.value = '';
      uploadedSponsorImage = '';
      if (fileChosenText) fileChosenText.textContent = 'Ningún archivo';
      if (sponsorPreviewWrapper) sponsorPreviewWrapper.classList.add('hidden');
    };
  }

  // Agregar nuevo campo personalizado
  document.getElementById('form-add-field').onsubmit = (e) => {
    e.preventDefault();
    const labelInput = document.getElementById('new-field-label');
    const typeSelect = document.getElementById('new-field-type');

    const label = labelInput.value.trim();
    const type = typeSelect.value;

    if (!label) return;

    sendAction('ADD_CUSTOM_FIELD', {
      label,
      type,
      team1Value: type === 'teamCounter' ? 0 : '',
      team2Value: type === 'teamCounter' ? 0 : '',
      value: type === 'globalCounter' ? 0 : ''
    });

    labelInput.value = '';
  };

  // Atajos de Teclado
  window.addEventListener('keydown', (e) => {
    // Si el usuario está escribiendo en un input, ignorar atajos
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Deshacer / Rehacer
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) sendAction('REDO');
      else sendAction('UNDO');
      return;
    }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      sendAction('REDO');
      return;
    }

    const key = e.key.toLowerCase();
    if (key === 'q' || key === '1') {
      sendAction('UPDATE_SCORE', { team: 1, delta: 1 });
    } else if (key === 'w') {
      sendAction('UPDATE_SCORE', { team: 1, delta: -1 });
    } else if (key === 'p' || key === '0') {
      sendAction('UPDATE_SCORE', { team: 2, delta: 1 });
    } else if (key === 'o') {
      sendAction('UPDATE_SCORE', { team: 2, delta: -1 });
    } else if (key === 's') {
      // Alternar saque
      const current = currentState ? currentState.serving : 0;
      const next = current === 1 ? 2 : (current === 2 ? 0 : 1);
      sendAction('SET_SERVING', { serving: next });
    } else if (key === 'x') {
      sendAction('SWAP_TEAMS');
    }
  });
}

// Iniciar aplicación
setupEventListeners();
connectWebSocket();
