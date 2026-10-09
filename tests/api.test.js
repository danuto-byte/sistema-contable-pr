const test = require('node:test');
const assert = require('node:assert/strict');

const { startServer, stopServer } = require('../server/index.js');

test('health endpoint works', async () => {
  const { server, port } = await startServer({ port: 0 });

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.service, 'sistema-contable');
  } finally {
    await stopServer(server);
  }
});
