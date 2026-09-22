// Lignes de bus. Convention : le DERNIER arrêt de la liste est le pôle universitaire
// (le "bout de ligne campus"), le premier est l'extrémité résidentielle.
//  - dailyDemand : nombre d'étudiants qui veulent utiliser la ligne sur une journée
//  - fleet       : nombre de bus affectés et capacité de chaque bus

export const lines = [
  {
    id: 'L1',
    name: 'Calavi → ENEAM → UAC',
    color: '#0d6efd',
    stopIds: ['calavi', 'togba', 'eneam', 'uac'],
    dailyDemand: 2500,
    fleet: { count: 3, capacity: 60 },
  },
  {
    id: 'L2',
    name: 'Akpakpa → Godomey → UAC',
    color: '#dc3545',
    stopIds: ['akpakpa', 'ganhi', 'jericho', 'zogbo', 'godomey', 'eneam', 'uac'],
    dailyDemand: 2000,
    fleet: { count: 6, capacity: 60 },
  },
  {
    id: 'L3',
    name: 'Fidjrossè → Godomey → UAC',
    color: '#198754',
    stopIds: ['fidjrosse', 'cadjehoun', 'stade', 'godomey', 'uac'],
    dailyDemand: 1500,
    fleet: { count: 4, capacity: 60 },
  },
  {
    id: 'L4',
    name: 'Dantokpa → Cadjèhoun → Campus Cotonou',
    color: '#fd7e14',
    stopIds: ['dantokpa', 'etoile-rouge', 'cadjehoun', 'campus-cotonou'],
    dailyDemand: 1300,
    fleet: { count: 3, capacity: 60 },
  },
  {
    id: 'L5',
    name: 'Agla → Campus Cotonou',
    color: '#6f42c1',
    stopIds: ['agla', 'cadjehoun', 'campus-cotonou'],
    dailyDemand: 220,
    fleet: { count: 1, capacity: 30 },
  },
  {
    id: 'L6',
    name: 'Calavi → Cadjèhoun → Campus Cotonou',
    color: '#20c997',
    stopIds: ['calavi', 'godomey', 'stade', 'cadjehoun', 'campus-cotonou'],
    dailyDemand: 1000,
    fleet: { count: 3, capacity: 60 },
  },
];
