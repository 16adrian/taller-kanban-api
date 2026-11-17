'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { KanbanBoard } = require('../src/board');

// Pruebas de integración: levantan la API en un puerto libre y la consumen por HTTP.
let server;
let baseUrl;

before(async () => {
  server = createApp(new KanbanBoard()).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

describe('API REST Kanban', () => {
  test('GET /health responde ok', async () => {
    const res = await call('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.version);
  });

  test('GET /api/board devuelve las 4 columnas', async () => {
    const res = await call('GET', '/api/board');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((c) => c.id),
      ['todo', 'doing', 'review', 'done']
    );
  });

  test('POST /api/cards crea una tarjeta (201)', async () => {
    const res = await call('POST', '/api/cards', { title: 'Nueva tarea', assignee: 'Adrián' });
    assert.equal(res.status, 201);
    assert.equal(res.body.column, 'todo');
    assert.equal(res.body.assignee, 'Adrián');
  });

  test('POST /api/cards sin título devuelve 400', async () => {
    const res = await call('POST', '/api/cards', {});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'VALIDATION_ERROR');
  });

  test('PATCH /api/cards/:id/move respeta el límite WIP (409)', async () => {
    const ids = [];
    for (let i = 0; i < 4; i++) {
      ids.push((await call('POST', '/api/cards', { title: `WIP ${i}` })).body.id);
    }
    for (const id of ids.slice(0, 3)) {
      assert.equal((await call('PATCH', `/api/cards/${id}/move`, { to: 'doing' })).status, 200);
    }
    const blocked = await call('PATCH', `/api/cards/${ids[3]}/move`, { to: 'doing' });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error, 'WIP_LIMIT_REACHED');
  });

  test('PATCH sin columna destino devuelve 400', async () => {
    const res = await call('PATCH', '/api/cards/1/move', {});
    assert.equal(res.status, 400);
  });

  test('GET /api/cards/:id inexistente devuelve 404', async () => {
    const res = await call('GET', '/api/cards/9999');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'CARD_NOT_FOUND');
  });

  test('PUT /api/columns/:id/wip ajusta el límite', async () => {
    const res = await call('PUT', '/api/columns/review/wip', { limit: 4 });
    assert.equal(res.status, 200);
    assert.equal(res.body.wipLimit, 4);
  });

  test('GET /api/metrics devuelve métricas de flujo', async () => {
    const res = await call('GET', '/api/metrics');
    assert.equal(res.status, 200);
    assert.ok('throughput' in res.body);
    assert.ok('averageLeadTimeHours' in res.body);
    assert.equal(res.body.wip.doing.limit, 3);
  });

  test('DELETE /api/cards/:id elimina (204)', async () => {
    const id = (await call('POST', '/api/cards', { title: 'Borrar' })).body.id;
    assert.equal((await call('DELETE', `/api/cards/${id}`)).status, 204);
    assert.equal((await call('GET', `/api/cards/${id}`)).status, 404);
  });

  test('ruta desconocida devuelve 404 JSON', async () => {
    const res = await call('GET', '/api/no-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'NOT_FOUND');
  });
});
