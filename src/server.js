'use strict';

const { createApp } = require('./app');
const { KanbanBoard } = require('./board');

const PORT = Number(process.env.PORT) || 3000;

// Datos de ejemplo para que el tablero desplegado no aparezca vacío.
function seed(board) {
  const a = board.createCard({ title: 'Definir el flujo de trabajo del equipo', assignee: 'Adrián' });
  const b = board.createCard({ title: 'Configurar pipeline CI/CD en GitHub Actions', assignee: 'Adrián' });
  const c = board.createCard({ title: 'Escribir pruebas de límites WIP', assignee: 'Adrián' });
  board.createCard({ title: 'Preparar presentación del taller de Kanban' });
  board.moveCard(a.id, 'doing');
  board.moveCard(a.id, 'review');
  board.moveCard(a.id, 'done');
  board.moveCard(b.id, 'doing');
  board.moveCard(c.id, 'doing');
}

const board = new KanbanBoard();
if (process.env.SEED_DATA !== 'false') {
  seed(board);
}

createApp(board).listen(PORT, () => {
  console.log(`Kanban API escuchando en el puerto ${PORT}`);
});
