# 🏆 Marcador Deportivo para Transmisiones en Vivo (OBS / Twitch / Facebook)

Un sistema completo, modular y en tiempo real para superponer marcadores deportivos profesionales en transmisiones en vivo (Twitch, Facebook Live, YouTube, Kick). Diseñado con arquitectura desacoplada para sincronización instantánea sin latencia.

---

## 📐 1. Lógica y Arquitectura del Proyecto

El sistema se divide en tres componentes esenciales:

```
┌─────────────────────────────────┐
│     Panel de Control (Admin)    │  (Operador en laptop, tablet o móvil)
│      http://localhost:3000      │
└────────────────┬────────────────┘
                 │ WebSocket (Bidireccional / Latencia < 5ms)
                 ▼
┌─────────────────────────────────┐
│       Servidor Node.js          │  (Control de Estado, Historial Undo/Redo,
│   (Express + ws + Presets)      │   Persistencia en match_state.json)
└────────────────┬────────────────┘
                 │ WebSocket Broadcast
                 ▼
┌─────────────────────────────────┐
│     Overlay Gráfico para OBS    │  (Fuente de Navegador transparente,
│  http://localhost:3000/overlay  │   animaciones CSS, tipografía broadcast)
└─────────────────────────────────┘
```

1. **Servidor Central (`server.js` y `src/stateManager.js`)**:
   - Administra el estado global del partido (equipos, colores, puntos, sets, tiempos fuera, posesión/saque, temporizador y campos personalizados).
   - **Persistencia automática**: Guarda el estado en `match_state.json` para que, en caso de fallo eléctrico o reinicio de OBS, no se pierdan los datos del partido.
   - **Historial Undo/Redo**: Permite deshacer clics accidentales del operador de inmediato con `Ctrl+Z` o el botón "Deshacer".
   - **Difusión en tiempo real (WebSockets)**: Actualiza todos los overlays conectados de forma instantánea.

2. **Panel de Operación (`/admin`)**:
   - Interfaz ergonómica de control rápido, adaptada para operar con pantalla táctil, mouse o atajos de teclado rápidos.
   - Selector de deporte (Voleibol, Baloncesto, Pádel / Tenis, Fútbol / Futsal, Personalizado).
   - Botón de **Intercambiar Lados**: vital para voleibol o pádel cuando los equipos cambian de cancha al terminar un set.

3. **Overlay para OBS Studio (`/overlay`)**:
   - Diseñado específicamente como **Fuente de Navegador (Browser Source)** con fondo 100% transparente.
   - Estética de transmisión de televisión internacional (gradientes sutiles, efectos glassmorphism, franjas dinámicas de color por equipo, números tabulares sin saltos y animaciones suaves al sumar puntos).

---

## 🚀 2. Instalación y Puesta en Marcha

### Requisitos
- Node.js instalado (v16 o superior).

### Pasos rápidos:
1. Abre la carpeta del proyecto en una terminal:
   ```bash
   cd c:\Users\DVargas\Documents\marcador
   ```
2. Inicia el servidor ejecutando:
   ```bash
   npm start
   ```
   *(En Windows también puedes simplemente hacer doble clic en `iniciar.bat`)*

3. Se abrirán dos URLs en tu red local:
   - **Panel de Control:** `http://localhost:3000/admin`
   - **Overlay de OBS:** `http://localhost:3000/overlay`

---

## 📺 3. Cómo configurarlo en OBS Studio / Streamlabs

1. Abre **OBS Studio**.
2. En la sección **Fuentes** (Sources), haz clic en el botón `+` y selecciona **Navegador** (Browser).
3. Nómbralo (por ejemplo: `Marcador`).
4. Configura los parámetros:
   - **URL:** `http://localhost:3000/overlay`
   - **Ancho (Width):** `1920` (o la resolución de tu lienzo)
   - **Alto (Height):** `1080`
   - Marca la casilla: **Actualizar el navegador cuando la escena se active**.
5. Haz clic en **Aceptar**. ¡El marcador aparecerá en pantalla con fondo transparente listo para tu transmisión!

---

## ⚽ 4. Deportes y Reglas Preconfiguradas

Puedes cambiar de deporte con 1 clic en el menú desplegable superior:

| Deporte | Características Principales |
| :--- | :--- |
| **🏐 Voleibol** | Sets al mejor de 5, 2 Tiempos Fuera por equipo, indicador de Saque, contador de puntos por set. |
| **🏀 Baloncesto** | Marcador acumulativo (+1, +2, +3), 5 Tiempos Fuera, indicador de posesión, control de Cuartos (Q1-Q4) y Faltas por equipo. |
| **🎾 Pádel / Tenis** | Contador de Juegos, Sets ganados e indicador de Saque para cada pareja. |
| **⚽ Fútbol / Futsal** | Goles, 1T / 2T, Tarjetas Amarillas y Rojas por equipo, Faltas acumuladas. |
| **🎯 Personalizado** | Totalmente libre para cualquier competencia deportiva o torneo de eSports. |

---

## ➕ 5. Extensibilidad: Cómo Añadir Más Campos

El sistema permite añadir **cualquier campo necesario** en tiempo real sin reiniciar el servidor ni recargar OBS:

1. Ve a la sección **"Añadir Nuevo Campo al Marcador"** en el panel de administración.
2. Ingresa el nombre (ej. *Faltas*, *Sustituciones*, *Patrocinador*, *Tiros de Esquina*, *Árbitro*).
3. Selecciona el tipo:
   - **Contador por Equipo**: Muestra valores independientes para Local y Visitante (ej. Faltas: 2 - 4).
   - **Texto por Equipo**: Textos diferenciados para cada equipo o jugador.
   - **Texto Global**: Texto visible para toda la transmisión (ej. "Copa Verano 2026 - Patrocinado por Monster").
   - **Contador Global**: Contador único (ej. Ronda, Minuto, etc.).
4. Haz clic en **+ Crear Campo**. Se sincronizará inmediatamente tanto en tu panel como en la pantalla del streaming.

---

## ⌨ 6. Atajos de Teclado (Hotkeys de Operación Rápida)

Para operar el marcador sin desviar la mirada de la jugada:

- `Q` o `1` : **+1 Punto Equipo Local**
- `W` : **-1 Punto Equipo Local**
- `P` o `0` : **+1 Punto Equipo Visitante**
- `O` : **-1 Punto Equipo Visitante**
- `S` : **Alternar Saque / Posesión**
- `X` : **Intercambiar Lados** (Swap Teams)
- `Ctrl + Z` : **Deshacer última acción**
- `Ctrl + Y` : **Rehacer acción**
