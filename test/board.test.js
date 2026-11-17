'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { KanbanBoard, KanbanError } = require('../src/board');

// Reloj controlado para que las métricas de tiempo sean deterministas.
function fakeClock(start = '2026-11-01T08:00:00.000Z') {
  let current = new Date(start).getTime();
  const now = () => new Date(current);
  now.advanceHours = (h) => {
    current += h * 36e5;
  };
  return now;
}

describe('Tablero Kanban - creación de tarjetas', () => {
  test('una tarjeta nueva entra a la primera columna', () => {
    const board = new KanbanBoard();
    const card = board.createCard({ title: 'Tarea 1' });
    assert.equal(card.id, 1);
    assert.equal(card.column, 'todo');
    assert.equal(card.startedAt, null);
  });

  test('rechaza tarjetas sin título', () => {
    const board = new KanbanBoard();
    assert.throws(() => board.createCard({ title: '   ' }), KanbanError);
    assert.throws(() => board.createCard({}), /obligatorio/);
  });

  test('rechaza títulos de más de 120 caracteres', () => {
    const board = new KanbanBoard();
    assert.throws(() => board.createCard({ title: 'x'.repeat(121) }), /120/);
  });
});

describe('Tablero Kanban - límites WIP', () => {
  test('no permite superar el límite WIP de "doing" (3)', () => {
    const board = new KanbanBoard();
    for (let i = 1; i <= 4; i++) {
      board.createCard({ title: `T${i}` });
    }
    board.moveCard(1, 'doing');
    board.moveCard(2, 'doing');
    board.moveCard(3, 'doing');
    assert.equal(board.isColumnFull('doing'), true);
    assert.throws(
      () => board.moveCard(4, 'doing'),
      (err) => err instanceof KanbanError && err.status === 409 && err.code === 'WIP_LIMIT_REACHED'
    );
    assert.equal(board.getCard(4).column, 'todo');
  });

  test('al terminar una tarjeta se libera capacidad (sistema pull)', () => {
    const board = new KanbanBoard();
    for (let i = 1; i <= 4; i++) {
      board.createCard({ title: `T${i}` });
    }
    ['doing', 'doing', 'doing'].forEach((col, i) => board.moveCard(i + 1, col));
    board.moveCard(1, 'review');
    const moved = board.moveCard(4, 'doing');
    assert.equal(moved.column, 'doing');
  });

  test('el límite WIP se puede ajustar y validar', () => {
    const board = new KanbanBoard();
    assert.equal(board.setWipLimit('review', 5).wipLimit, 5);
    assert.equal(board.setWipLimit('review', null).wipLimit, null);
    assert.throws(() => board.setWipLimit('review', 0), /entero/);
    assert.throws(() => board.setWipLimit('review', 1.5), /entero/);
  });

  test('mover a una columna inexistente devuelve 404', () => {
    const board = new KanbanBoard();
    board.createCard({ title: 'T' });
    assert.throws(() => board.moveCard(1, 'qa'), (err) => err.status === 404);
  });
});

describe('Tablero Kanban - métricas de flujo', () => {
  test('calcula throughput, lead time y cycle time', () => {
    const clock = fakeClock();
    const board = new KanbanBoard({ now: clock });
    board.createCard({ title: 'A' }); // creada t=0
    clock.advanceHours(2);
    board.moveCard(1, 'doing'); // empieza t=2
    clock.advanceHours(3);
    board.moveCard(1, 'review');
    clock.advanceHours(1);
    board.moveCard(1, 'done'); // termina t=6

    const metrics = board.getMetrics();
    assert.equal(metrics.throughput, 1);
    assert.equal(metrics.averageLeadTimeHours, 6);
    assert.equal(metrics.averageCycleTimeHours, 4);
    assert.deepEqual(metrics.wip.doing, { count: 0, limit: 3 });
  });

  test('sin tarjetas terminadas las métricas de tiempo son null', () => {
    const board = new KanbanBoard();
    board.createCard({ title: 'A' });
    const metrics = board.getMetrics();
    assert.equal(metrics.throughput, 0);
    assert.equal(metrics.averageLeadTimeHours, null);
  });

  test('regresar una tarjeta desde "done" la vuelve a abrir', () => {
    const board = new KanbanBoard();
    board.createCard({ title: 'A' });
    board.moveCard(1, 'done');
    assert.notEqual(board.getCard(1).finishedAt, null);
    board.moveCard(1, 'review');
    assert.equal(board.getCard(1).finishedAt, null);
    assert.equal(board.getCard(1).history.length, 3);
  });
});
