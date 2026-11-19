const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const StateManager = require('./src/stateManager');
const presets = require('./src/presets');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const stateManager = new StateManager();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast to all connected WebSocket clients
function broadcastState(state) {
  const message = JSON.stringify({
    type: 'STATE_UPDATE',
    payload: state
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Hook broadcast to state manager
stateManager.onStateChange = (state) => {
  broadcastState(state);
};

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Send current state immediately on connect
  ws.send(JSON.stringify({
    type: 'STATE_UPDATE',
    payload: stateManager.getState()
  }));

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      if (data.type === 'ACTION' && data.action) {
        stateManager.dispatch(data.action);
      }
    } catch (err) {
      console.error('Error procesando mensaje WebSocket:', err.message);
    }
  });

  ws.on('error', (err) => {
    console.error('Error en WebSocket client:', err.message);
  });
});

// REST Endpoints
app.get('/api/state', (req, res) => {
  res.json(stateManager.getState());
});

app.post('/api/action', (req, res) => {
  const action = req.body;
  if (!action || !action.type) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  const newState = stateManager.dispatch(action);
  res.json({ success: true, state: newState });
});

app.get('/api/presets', (req, res) => {
  res.json(presets);
});

// Friendly routes
app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` MARCADO DEPORTIVO PARA TRANSMISIONES EN VIVO (OBS/TWITCH)`);
  console.log(`=======================================================`);
  console.log(` Servidor activo en: http://localhost:${PORT}`);
  console.log(` Panel de Control (Admin):  http://localhost:${PORT}/admin`);
  console.log(` Marcador OBS (Overlay):     http://localhost:${PORT}/overlay`);
  console.log(`=======================================================`);
});
