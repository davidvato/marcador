const fs = require('fs');
const path = require('path');
const presets = require('./presets');

const STATE_FILE = path.join(__dirname, '..', 'match_state.json');
const MAX_HISTORY = 50;

class StateManager {
  constructor() {
    this.history = [];
    this.redoStack = [];
    this.timerInterval = null;
    this.onStateChange = null; // Callback for server broadcast

    this.state = this.loadState();
    this.setupTimer();
  }

  getDefaultState() {
    const preset = presets.volleyball;
    return {
      sport: 'volleyball',
      tournament: preset.defaultTournament,
      stage: preset.stage,
      currentSet: preset.currentSet,
      maxSets: preset.maxSets,
      serving: preset.serving,
      overlayPosition: 'pos-top-center', // 'pos-top-center', 'pos-top-left', 'pos-top-right', 'pos-bottom-center'
      topTeam: 1, // 1: team1 en posición superior / arriba, 2: team2 en posición superior / arriba
      activeTimeout: null, // { team: 1, teamName: 'Equipo Local', color: '#2563eb', secondsLeft: 30 }
      timeoutSettings: {
        defaultDuration: 30
      },
      sponsors: [], // [ { id: 'sp_1', name: 'Gatorade', image: 'data:...', visible: true } ]
      sponsorSettings: {
        showDuringTimeout: true,
        showDuringGame: false,
        rotationDelay: 5,
        currentSponsorIndex: 0
      },
      timer: {
        seconds: 0,
        running: false,
        direction: 'up' // 'up' or 'down'
      },
      team1: { ...preset.team1 },
      team2: { ...preset.team2 },
      customFields: JSON.parse(JSON.stringify(preset.customFields || []))
    };
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = fs.readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        // Ensure timer is not running on load
        if (parsed.timer) parsed.timer.running = false;
        parsed.activeTimeout = null;
        if (!parsed.topTeam) parsed.topTeam = 1;
        if (!parsed.timeoutSettings) parsed.timeoutSettings = { defaultDuration: 30 };
        if (!parsed.sponsors) parsed.sponsors = [];
        if (!parsed.sponsorSettings) {
          parsed.sponsorSettings = {
            showDuringTimeout: true,
            showDuringGame: false,
            rotationDelay: 5,
            currentSponsorIndex: 0
          };
        }
        return parsed;
      }
    } catch (err) {
      console.error('Error al cargar match_state.json, usando valores predeterminados:', err.message);
    }
    return this.getDefaultState();
  }

  saveState() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error al guardar match_state.json:', err.message);
    }
  }

  pushHistory() {
    const snapshot = JSON.stringify(this.state);
    this.history.push(snapshot);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
  }

  broadcast() {
    this.saveState();
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }

  getState() {
    return {
      ...this.state,
      canUndo: this.history.length > 0,
      canRedo: this.redoStack.length > 0
    };
  }

  // --- TIMER LOGIC ---
  setupTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      let stateChanged = false;

      if (this.state.timer && this.state.timer.running) {
        if (this.state.timer.direction === 'down') {
          if (this.state.timer.seconds > 0) {
            this.state.timer.seconds -= 1;
          } else {
            this.state.timer.running = false;
          }
        } else {
          this.state.timer.seconds += 1;
        }
        stateChanged = true;
      }

      if (this.state.activeTimeout) {
        if (this.state.activeTimeout.secondsLeft > 0) {
          this.state.activeTimeout.secondsLeft -= 1;
          stateChanged = true;
        } else {
          this.state.activeTimeout = null;
          stateChanged = true;
        }
      }

      // Rotación de Patrocinadores (consecutiva con delay)
      const shouldRotateSponsors = (this.state.sponsorSettings?.showDuringGame || (this.state.activeTimeout && this.state.sponsorSettings?.showDuringTimeout));
      const activeSponsors = (this.state.sponsors || []).filter(s => s.visible !== false);
      if (shouldRotateSponsors && activeSponsors.length > 1) {
        this._sponsorCounter = (this._sponsorCounter || 0) + 1;
        const delay = this.state.sponsorSettings?.rotationDelay || 5;
        if (this._sponsorCounter >= delay) {
          this._sponsorCounter = 0;
          const curIdx = this.state.sponsorSettings?.currentSponsorIndex || 0;
          this.state.sponsorSettings.currentSponsorIndex = (curIdx + 1) % activeSponsors.length;
          stateChanged = true;
        }
      }

      if (stateChanged && typeof this.onStateChange === 'function') {
        this.onStateChange(this.getState());
      }
    }, 1000);
  }

  // --- ACTIONS DISPATCHER ---
  dispatch(action) {
    const { type, payload } = action;

    // Timer tick actions don't push history
    if (type === 'TIMER_TICK') return;

    if (type === 'UNDO') {
      return this.undo();
    }
    if (type === 'REDO') {
      return this.redo();
    }

    // Save previous state before mutating
    this.pushHistory();

    switch (type) {
      case 'UPDATE_SCORE': {
        const { team, delta, value } = payload;
        const targetTeam = team === 1 ? this.state.team1 : this.state.team2;
        if (value !== undefined) {
          const oldVal = targetTeam.score;
          targetTeam.score = Math.max(0, parseInt(value, 10) || 0);
          if (targetTeam.score > oldVal) {
            this.state.topTeam = team;
          } else if (targetTeam.score < oldVal) {
            this.state.topTeam = team === 1 ? 2 : 1;
          }
        } else if (delta !== undefined) {
          const d = parseInt(delta, 10);
          targetTeam.score = Math.max(0, targetTeam.score + d);
          if (d > 0) {
            // Al sumar un punto, mover a la posición de arriba al equipo correspondiente
            this.state.topTeam = team;
          } else if (d < 0) {
            // Al restar un punto, moverlo a la posición inferior
            this.state.topTeam = team === 1 ? 2 : 1;
          }
        }
        break;
      }

      case 'UPDATE_SETS': {
        const { team, delta, value } = payload;
        const targetTeam = team === 1 ? this.state.team1 : this.state.team2;
        if (value !== undefined) {
          targetTeam.setsWon = Math.max(0, parseInt(value, 10) || 0);
        } else if (delta !== undefined) {
          targetTeam.setsWon = Math.max(0, targetTeam.setsWon + parseInt(delta, 10));
        }
        break;
      }

      case 'SET_CURRENT_SET': {
        const { currentSet } = payload;
        this.state.currentSet = Math.max(1, parseInt(currentSet, 10) || 1);
        break;
      }

      case 'UPDATE_TIMEOUT': {
        const { team, delta, used, duration } = payload;
        const targetTeam = team === 1 ? this.state.team1 : this.state.team2;
        if (used !== undefined) {
          targetTeam.timeoutsUsed = Math.min(targetTeam.timeoutsTotal, Math.max(0, parseInt(used, 10)));
        } else if (delta !== undefined) {
          const d = parseInt(delta, 10);
          targetTeam.timeoutsUsed = Math.min(
            targetTeam.timeoutsTotal,
            Math.max(0, targetTeam.timeoutsUsed + d)
          );
          if (d > 0) {
            const defaultDur = this.state.timeoutSettings?.defaultDuration || 30;
            const timeoutSeconds = duration !== undefined ? Math.max(1, parseInt(duration, 10)) : defaultDur;
            this.state.activeTimeout = {
              team,
              teamName: targetTeam.name,
              color: targetTeam.color,
              secondsLeft: timeoutSeconds
            };
            if (this.state.sponsorSettings) {
              this.state.sponsorSettings.currentSponsorIndex = 0;
            }
            this._sponsorCounter = 0;
          }
        }
        break;
      }

      case 'SET_TIMEOUT_DURATION': {
        const { duration } = payload;
        if (!this.state.timeoutSettings) this.state.timeoutSettings = {};
        this.state.timeoutSettings.defaultDuration = Math.max(5, parseInt(duration, 10) || 30);
        break;
      }

      case 'ADJUST_ACTIVE_TIMEOUT': {
        const { delta, secondsLeft } = payload;
        if (this.state.activeTimeout) {
          if (secondsLeft !== undefined) {
            this.state.activeTimeout.secondsLeft = Math.max(1, parseInt(secondsLeft, 10) || 1);
          } else if (delta !== undefined) {
            this.state.activeTimeout.secondsLeft = Math.max(1, this.state.activeTimeout.secondsLeft + parseInt(delta, 10));
          }
        }
        break;
      }

      case 'DISMISS_TIMEOUT': {
        this.state.activeTimeout = null;
        break;
      }

      // --- PATROCINADORES / SPONSORS ---
      case 'ADD_SPONSOR': {
        const { name, image } = payload;
        if (!this.state.sponsors) this.state.sponsors = [];
        const newSponsor = {
          id: 'sp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: (name || '').trim(),
          image: (image || '').trim(),
          visible: true
        };
        this.state.sponsors.push(newSponsor);
        break;
      }

      case 'REMOVE_SPONSOR': {
        const { id } = payload;
        this.state.sponsors = (this.state.sponsors || []).filter(s => s.id !== id);
        if (this.state.sponsorSettings) {
          this.state.sponsorSettings.currentSponsorIndex = 0;
        }
        break;
      }

      case 'TOGGLE_SPONSOR': {
        const { id } = payload;
        const sp = (this.state.sponsors || []).find(s => s.id === id);
        if (sp) {
          sp.visible = !sp.visible;
        }
        break;
      }

      case 'UPDATE_SPONSOR_SETTINGS': {
        if (!this.state.sponsorSettings) {
          this.state.sponsorSettings = { showDuringTimeout: true, showDuringGame: false, rotationDelay: 5, currentSponsorIndex: 0 };
        }
        if (payload.showDuringTimeout !== undefined) this.state.sponsorSettings.showDuringTimeout = Boolean(payload.showDuringTimeout);
        if (payload.showDuringGame !== undefined) this.state.sponsorSettings.showDuringGame = Boolean(payload.showDuringGame);
        if (payload.rotationDelay !== undefined) this.state.sponsorSettings.rotationDelay = Math.max(1, parseInt(payload.rotationDelay, 10) || 5);
        break;
      }

      case 'SET_SERVING': {
        const { serving } = payload; // 0: none, 1: team1, 2: team2
        this.state.serving = [0, 1, 2].includes(serving) ? serving : 0;
        break;
      }

      case 'SWAP_TEAMS': {
        // Swap names, colors, scores, sets, timeouts
        const tempTeam1 = { ...this.state.team1 };
        this.state.team1 = { ...this.state.team2 };
        this.state.team2 = tempTeam1;

        // Invert serving if active
        if (this.state.serving === 1) this.state.serving = 2;
        else if (this.state.serving === 2) this.state.serving = 1;

        this.state.topTeam = this.state.topTeam === 1 ? 2 : 1;

        if (this.state.activeTimeout) {
          this.state.activeTimeout.team = this.state.activeTimeout.team === 1 ? 2 : 1;
          this.state.activeTimeout.teamName = this.state.activeTimeout.team === 1 ? this.state.team1.name : this.state.team2.name;
        }

        // Swap team-specific custom fields
        this.state.customFields.forEach(field => {
          if (field.type === 'teamCounter' || field.type === 'teamText') {
            const tempVal = field.team1Value;
            field.team1Value = field.team2Value;
            field.team2Value = tempVal;
          }
        });
        break;
      }

      case 'RESET_SCORE': {
        // Reset points for the new set, but keep sets won
        this.state.team1.score = 0;
        this.state.team2.score = 0;
        // Reset timeouts used for volleyball/tennis sets
        this.state.team1.timeoutsUsed = 0;
        this.state.team2.timeoutsUsed = 0;
        break;
      }

      case 'RESET_MATCH': {
        this.state.team1.score = 0;
        this.state.team1.setsWon = 0;
        this.state.team1.timeoutsUsed = 0;
        this.state.team2.score = 0;
        this.state.team2.setsWon = 0;
        this.state.team2.timeoutsUsed = 0;
        this.state.currentSet = 1;
        this.state.topTeam = 1;
        this.state.activeTimeout = null;
        this.state.timer.seconds = 0;
        this.state.timer.running = false;
        this.state.customFields.forEach(f => {
          if (f.type === 'teamCounter') {
            f.team1Value = 0;
            f.team2Value = 0;
          }
        });
        break;
      }

      case 'UPDATE_META': {
        if (payload.tournament !== undefined) this.state.tournament = payload.tournament;
        if (payload.stage !== undefined) this.state.stage = payload.stage;
        if (payload.currentSet !== undefined) this.state.currentSet = parseInt(payload.currentSet, 10) || 1;
        if (payload.maxSets !== undefined) this.state.maxSets = parseInt(payload.maxSets, 10) || 3;
        if (payload.overlayPosition !== undefined) this.state.overlayPosition = payload.overlayPosition;
        break;
      }

      case 'UPDATE_TEAM': {
        const { team, name, color, textColor, timeoutsTotal } = payload;
        const target = team === 1 ? this.state.team1 : this.state.team2;
        if (name !== undefined) target.name = name;
        if (color !== undefined) target.color = color;
        if (textColor !== undefined) target.textColor = textColor;
        if (timeoutsTotal !== undefined) {
          target.timeoutsTotal = Math.max(0, parseInt(timeoutsTotal, 10));
          if (target.timeoutsUsed > target.timeoutsTotal) {
            target.timeoutsUsed = target.timeoutsTotal;
          }
        }
        break;
      }

      case 'ADD_CUSTOM_FIELD': {
        const { label, type, team1Value, team2Value, value } = payload;
        const id = 'field_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newField = {
          id,
          label: label || 'Nuevo Campo',
          type: type || 'teamCounter', // 'teamCounter', 'teamText', 'globalText', 'globalCounter'
          team1Value: team1Value !== undefined ? team1Value : 0,
          team2Value: team2Value !== undefined ? team2Value : 0,
          value: value !== undefined ? value : '',
          visible: true
        };
        this.state.customFields.push(newField);
        break;
      }

      case 'UPDATE_CUSTOM_FIELD': {
        const { id, team, delta, value, team1Value, team2Value } = payload;
        const field = this.state.customFields.find(f => f.id === id);
        if (field) {
          if (field.type === 'teamCounter') {
            if (team === 1) {
              if (delta !== undefined) field.team1Value = Math.max(0, field.team1Value + delta);
              if (value !== undefined) field.team1Value = Math.max(0, parseInt(value, 10) || 0);
            } else if (team === 2) {
              if (delta !== undefined) field.team2Value = Math.max(0, field.team2Value + delta);
              if (value !== undefined) field.team2Value = Math.max(0, parseInt(value, 10) || 0);
            }
          } else if (field.type === 'teamText') {
            if (team1Value !== undefined) field.team1Value = team1Value;
            if (team2Value !== undefined) field.team2Value = team2Value;
          } else if (field.type === 'globalCounter') {
            if (delta !== undefined) field.value = Math.max(0, (parseInt(field.value, 10) || 0) + delta);
            if (value !== undefined) field.value = Math.max(0, parseInt(value, 10) || 0);
          } else if (field.type === 'globalText') {
            if (value !== undefined) field.value = value;
          }
        }
        break;
      }

      case 'TOGGLE_CUSTOM_FIELD': {
        const { id } = payload;
        const field = this.state.customFields.find(f => f.id === id);
        if (field) field.visible = !field.visible;
        break;
      }

      case 'REMOVE_CUSTOM_FIELD': {
        const { id } = payload;
        this.state.customFields = this.state.customFields.filter(f => f.id !== id);
        break;
      }

      case 'APPLY_PRESET': {
        const { sport } = payload;
        const preset = presets[sport];
        if (preset) {
          this.state.sport = sport;
          this.state.tournament = preset.defaultTournament;
          this.state.stage = preset.stage;
          this.state.currentSet = preset.currentSet;
          this.state.maxSets = preset.maxSets;
          this.state.serving = preset.serving;
          this.state.topTeam = 1;
          this.state.activeTimeout = null;
          this.state.team1 = { ...preset.team1 };
          this.state.team2 = { ...preset.team2 };
          this.state.customFields = JSON.parse(JSON.stringify(preset.customFields || []));
          this.state.timer.seconds = 0;
          this.state.timer.running = false;
        }
        break;
      }

      case 'TIMER_ACTION': {
        const { action, seconds, direction } = payload;
        if (action === 'start') {
          this.state.timer.running = true;
        } else if (action === 'pause') {
          this.state.timer.running = false;
        } else if (action === 'reset') {
          this.state.timer.running = false;
          this.state.timer.seconds = 0;
        } else if (action === 'set') {
          if (seconds !== undefined) this.state.timer.seconds = Math.max(0, parseInt(seconds, 10) || 0);
          if (direction) this.state.timer.direction = direction;
        }
        break;
      }

      default:
        console.warn('Acción desconocida:', type);
        break;
    }

    this.broadcast();
    return this.getState();
  }

  undo() {
    if (this.history.length === 0) return this.getState();
    const current = JSON.stringify(this.state);
    this.redoStack.push(current);
    const previous = this.history.pop();
    this.state = JSON.parse(previous);
    this.broadcast();
    return this.getState();
  }

  redo() {
    if (this.redoStack.length === 0) return this.getState();
    const current = JSON.stringify(this.state);
    this.history.push(current);
    const next = this.redoStack.pop();
    this.state = JSON.parse(next);
    this.broadcast();
    return this.getState();
  }
}

module.exports = StateManager;
