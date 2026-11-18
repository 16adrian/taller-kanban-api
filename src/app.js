'use strict';

const path = require('node:path');
const express = require('express');
const { KanbanBoard, KanbanError } = require('./board');
const pkg = require('../package.json');

const debugMode = true;

function createApp(board = new KanbanBoard()) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Salud del servicio: lo usa el pipeline para verificar el despliegue.
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      version: pkg.version,
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local',
      uptimeSeconds: Math.round(process.uptime())
    });
  });

  app.get('/api', (req, res) => {
    res.json({
      name: 'Kanban Board API',
      endpoints: [
        'GET    /health',
        'GET    /api/board',
        'GET    /api/cards',
        'POST   /api/cards            { title, description?, assignee? }',
        'GET    /api/cards/:id',
        'PATCH  /api/cards/:id/move   { to: "todo" | "doing" | "review" | "done" }',
        'DELETE /api/cards/:id',
        'PUT    /api/columns/:id/wip  { limit: number | null }',
        'GET    /api/metrics'
      ]
    });
  });

  app.get('/api/board', (req, res) => {
    res.json(board.getBoard());
  });

  app.get('/api/cards', (req, res) => {
    const { column } = req.query;
    res.json(column ? board.cardsIn(column) : board.cards);
  });

  app.post('/api/cards', (req, res) => {
    const card = board.createCard(req.body || {});
    res.status(201).json(card);
  });

  app.get('/api/cards/:id', (req, res) => {
    res.json(board.getCard(req.params.id));
  });

  app.patch('/api/cards/:id/move', (req, res) => {
    const to = req.body && req.body.to;
    if (!to) {
      throw new KanbanError('Debe indicar la columna destino en "to"', 400, 'VALIDATION_ERROR');
    }
    res.json(board.moveCard(req.params.id, to));
  });

  app.delete('/api/cards/:id', (req, res) => {
    board.deleteCard(req.params.id);
    res.status(204).send();
  });

  app.put('/api/columns/:id/wip', (req, res) => {
    const limit = req.body ? req.body.limit : undefined;
    res.json(board.setWipLimit(req.params.id, limit === undefined ? null : limit));
  });

  app.get('/api/metrics', (req, res) => {
    res.json(board.getMetrics());
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `Ruta ${req.method} ${req.path} no encontrada` });
  });

  // Manejador de errores centralizado (Express exige 4 parámetros).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof KanbanError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'INVALID_JSON', message: 'El cuerpo no es JSON válido' });
    }
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Error interno' });
  });

  return app;
}

module.exports = { createApp };
