'use strict';

/**
 * Lógica de dominio de un tablero Kanban.
 *
 * Aplica las prácticas centrales de Kanban:
 *  - Visualizar el flujo (columnas ordenadas).
 *  - Limitar el trabajo en curso (WIP): una columna llena rechaza tarjetas nuevas.
 *  - Gestionar el flujo: se registran tiempos para calcular lead time, cycle time y throughput.
 *  - Políticas explícitas: las reglas de cada columna se exponen por la API.
 */

const DEFAULT_COLUMNS = [
  { id: 'todo', name: 'Por hacer', wipLimit: null, policy: 'Tarjetas priorizadas y listas para empezar.' },
  { id: 'doing', name: 'En progreso', wipLimit: 3, policy: 'Máximo 3 tarjetas. Terminar antes de empezar otra.' },
  { id: 'review', name: 'En revisión', wipLimit: 2, policy: 'Máximo 2 tarjetas. Requiere revisión de un compañero.' },
  { id: 'done', name: 'Terminado', wipLimit: null, policy: 'Cumple la definición de terminado y pasó el pipeline.' }
];

class KanbanError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'KanbanError';
    this.status = status;
    this.code = code;
  }
}

class KanbanBoard {
  constructor({ columns = DEFAULT_COLUMNS, now = () => new Date() } = {}) {
    this.columns = columns.map((c) => ({ ...c }));
    this.cards = [];
    this.nextId = 1;
    this.now = now;
  }

  getColumn(columnId) {
    const column = this.columns.find((c) => c.id === columnId);
    if (!column) {
      throw new KanbanError(`La columna "${columnId}" no existe`, 404, 'COLUMN_NOT_FOUND');
    }
    return column;
  }

  cardsIn(columnId) {
    return this.cards.filter((card) => card.column === columnId);
  }

  isColumnFull(columnId) {
    const column = this.getColumn(columnId);
    if (column.wipLimit === null || column.wipLimit === undefined) {
      return false;
    }
    return this.cardsIn(columnId).length >= column.wipLimit;
  }

  createCard({ title, description = '', assignee = null } = {}) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new KanbanError('El título es obligatorio', 400, 'VALIDATION_ERROR');
    }
    if (title.trim().length > 120) {
      throw new KanbanError('El título no puede superar 120 caracteres', 400, 'VALIDATION_ERROR');
    }
    const firstColumn = this.columns[0].id;
    if (this.isColumnFull(firstColumn)) {
      throw new KanbanError(`Límite WIP alcanzado en "${firstColumn}"`, 409, 'WIP_LIMIT_REACHED');
    }
    const timestamp = this.now().toISOString();
    const card = {
      id: this.nextId++,
      title: title.trim(),
      description: String(description),
      assignee,
      column: firstColumn,
      createdAt: timestamp,
      startedAt: null,
      finishedAt: null,
      history: [{ column: firstColumn, at: timestamp }]
    };
    this.cards.push(card);
    return card;
  }

  getCard(id) {
    const card = this.cards.find((c) => c.id === Number(id));
    if (!card) {
      throw new KanbanError(`La tarjeta ${id} no existe`, 404, 'CARD_NOT_FOUND');
    }
    return card;
  }

  moveCard(id, toColumnId) {
    const card = this.getCard(id);
    this.getColumn(toColumnId);
    if (card.column === toColumnId) {
      return card;
    }
    if (this.isColumnFull(toColumnId)) {
      throw new KanbanError(
        `Límite WIP alcanzado en "${toColumnId}": termina una tarjeta antes de empezar otra`,
        409,
        'WIP_LIMIT_REACHED'
      );
    }
    const timestamp = this.now().toISOString();
    const lastId = this.columns[this.columns.length - 1].id;
    card.column = toColumnId;
    card.history.push({ column: toColumnId, at: timestamp });
    if (toColumnId !== this.columns[0].id && card.startedAt === null) {
      card.startedAt = timestamp;
    }
    card.finishedAt = toColumnId === lastId ? timestamp : null;
    return card;
  }

  deleteCard(id) {
    const card = this.getCard(id);
    this.cards = this.cards.filter((c) => c !== card);
    return card;
  }

  setWipLimit(columnId, limit) {
    const column = this.getColumn(columnId);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      throw new KanbanError('El límite WIP debe ser un entero mayor o igual a 1, o null', 400, 'VALIDATION_ERROR');
    }
    column.wipLimit = limit;
    return column;
  }

  getBoard() {
    return this.columns.map((column) => {
      const cards = this.cardsIn(column.id);
      return {
        ...column,
        count: cards.length,
        full: this.isColumnFull(column.id),
        cards
      };
    });
  }

  getMetrics() {
    const lastId = this.columns[this.columns.length - 1].id;
    const finished = this.cards.filter((c) => c.column === lastId && c.finishedAt);
    const hours = (from, to) => (new Date(to) - new Date(from)) / 36e5;
    const average = (values) =>
      values.length === 0 ? null : Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));

    const wip = {};
    for (const column of this.columns) {
      wip[column.id] = { count: this.cardsIn(column.id).length, limit: column.wipLimit };
    }

    return {
      totalCards: this.cards.length,
      throughput: finished.length,
      averageLeadTimeHours: average(finished.map((c) => hours(c.createdAt, c.finishedAt))),
      averageCycleTimeHours: average(
        finished.filter((c) => c.startedAt).map((c) => hours(c.startedAt, c.finishedAt))
      ),
      wip
    };
  }
}

module.exports = { KanbanBoard, KanbanError, DEFAULT_COLUMNS };
