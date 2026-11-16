const assert=require('assert');
const path=require('path');
const app=require('../Node Interface/server.js');
// Node's built-in test runner uses async functions inside describe/it.

describe('API endpoints',()=>{
    let server;
    let port;
    beforeAll(async () => {
        server = app.listen(0); // random available port
        const addr = server.address();
        port = addr.port;
    });
    afterAll(() => { if (server) server.close(); });

    it('GET /api/health returns ok and logRoot', async () => {
        const res = await fetch(`http://localhost:${port}/api/health`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.ok, true);
        assert(typeof data.logRoot === 'string');
    });

    it('GET /api/live returns event-stream', async () => {
        // Use AbortController to stop after 1s
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 1000);
        try {
            const res = await fetch(`http://localhost:${port}/api/live`, { signal: controller.signal });
            assert.strictEqual(res.status, 200);
            const ct = res.headers.get('content-type');
            assert(ct && ct.includes('event-stream'));
        } catch (err) {
            // Abort error expected
            if (err.name === 'AbortError') return;
            throw err;
        }
    });

    it('GET /api/dates returns dates array', async () => {
        const res = await fetch(`http://localhost:${port}/api/dates`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert(Array.isArray(data.dates));
    });

    it('GET /api/performance-data returns payload', async () => {
        const res = await fetch(`http://localhost:${port}/api/performance-data`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert(data && typeof data === 'object');
    });
}
);
