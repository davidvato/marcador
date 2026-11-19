// Presets preconfigurados para distintos deportes
module.exports = {
  volleyball: {
    name: 'Voleibol',
    defaultTournament: 'Torneo de Voleibol',
    stage: 'Fase Regular',
    currentSet: 1,
    maxSets: 5,
    serving: 1,
    team1: {
      name: 'Equipo Local',
      color: '#2563eb', // Azul
      textColor: '#ffffff',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 2,
      timeoutsUsed: 0
    },
    team2: {
      name: 'Equipo Visitante',
      color: '#dc2626', // Rojo
      textColor: '#ffffff',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 2,
      timeoutsUsed: 0
    },
    customFields: [
      {
        id: 'sustituciones',
        label: 'Cambios',
        type: 'teamCounter',
        team1Value: 0,
        team2Value: 0,
        visible: false
      }
    ]
  },

  basketball: {
    name: 'Baloncesto',
    defaultTournament: 'Liga de Baloncesto',
    stage: 'Q1',
    currentSet: 1,
    maxSets: 4,
    serving: 1,
    team1: {
      name: 'Local',
      color: '#ea580c', // Naranja
      textColor: '#ffffff',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 5,
      timeoutsUsed: 0
    },
    team2: {
      name: 'Visitante',
      color: '#1e293b', // Gris oscuro
      textColor: '#ffffff',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 5,
      timeoutsUsed: 0
    },
    customFields: [
      {
        id: 'faltas',
        label: 'Faltas',
        type: 'teamCounter',
        team1Value: 0,
        team2Value: 0,
        visible: true
      },
      {
        id: 'periodo',
        label: 'Periodo',
        type: 'globalText',
        value: 'Cuarto 1',
        visible: true
      }
    ]
  },

  soccer: {
    name: 'Fútbol / Futsal',
    defaultTournament: 'Copa de Campeones',
    stage: '1er Tiempo',
    currentSet: 1,
    maxSets: 2,
    serving: 0,
    team1: {
      name: 'Equipo A',
      color: '#16a34a', // Verde
      textColor: '#ffffff',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 1,
      timeoutsUsed: 0
    },
    team2: {
      name: 'Equipo B',
      color: '#9333ea', // Morado
      textColor: '#ffffff',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 1,
      timeoutsUsed: 0
    },
    customFields: [
      {
        id: 'amarillas',
        label: 'Tarjetas Amarillas',
        type: 'teamCounter',
        team1Value: 0,
        team2Value: 0,
        visible: true
      },
      {
        id: 'rojas',
        label: 'Tarjetas Rojas',
        type: 'teamCounter',
        team1Value: 0,
        team2Value: 0,
        visible: false
      }
    ]
  },

  padel: {
    name: 'Pádel / Tenis',
    defaultTournament: 'Open de Pádel',
    stage: 'Set 1',
    currentSet: 1,
    maxSets: 3,
    serving: 1,
    team1: {
      name: 'Pareja 1',
      color: '#0284c7', // Cyan / Azul
      textColor: '#ffffff',
      score: 0, // 0, 15, 30, 40
      setsWon: 0,
      timeoutsTotal: 0,
      timeoutsUsed: 0
    },
    team2: {
      name: 'Pareja 2',
      color: '#eab308', // Amarillo
      textColor: '#1e293b',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 0,
      timeoutsUsed: 0
    },
    customFields: [
      {
        id: 'games',
        label: 'Juegos',
        type: 'teamCounter',
        team1Value: 0,
        team2Value: 0,
        visible: true
      }
    ]
  },

  custom: {
    name: 'Personalizado',
    defaultTournament: 'Torneo Deportivo',
    stage: 'En Vivo',
    currentSet: 1,
    maxSets: 3,
    serving: 0,
    team1: {
      name: 'Jugador 1',
      color: '#3b82f6',
      textColor: '#ffffff',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 2,
      timeoutsUsed: 0
    },
    team2: {
      name: 'Jugador 2',
      color: '#ef4444',
      textColor: '#ffffff',
      score: 0,
      setsWon: 0,
      timeoutsTotal: 2,
      timeoutsUsed: 0
    },
    customFields: []
  }
};
