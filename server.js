const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const StateManager = require('./src/stateManager');
const presets = require('./src/presets');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on('error', (err) => {
  // Manejado en server.on('error')
});

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

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] El puerto ${PORT} ya está en uso.`);
    console.error(`Cierra la otra aplicación o define otro puerto con: set PORT=3001 && npm start\n`);
    process.exit(1);
  } else {
    console.error('[ERROR] Error en el servidor:', err);
  }
});

server.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log(`=======================================================`);
  console.log(` MARCADOR DEPORTIVO PARA TRANSMISIONES EN VIVO (OBS/TWITCH)`);
  console.log(`=======================================================`);
  console.log(` Servidor local:            http://localhost:${PORT}`);
  console.log(` Panel de Control (Admin):  http://localhost:${PORT}/admin`);
  console.log(` Marcador OBS (Overlay):    http://localhost:${PORT}/overlay`);
  if (localIp) {
    console.log(` Red Local (Tablet/Movil):  http://${localIp}:${PORT}/admin`);
  }
  console.log(`=======================================================`);
});

process.on('SIGINT', () => {
  stateManager.saveState();
  process.exit(0);
});
