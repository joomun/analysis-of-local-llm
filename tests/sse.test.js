const assert = require('assert');
const app = require('../Node Interface/server.js');

// Helper to wait for a given number of milliseconds
function delay(ms){return new Promise(r=>setTimeout(r,ms));}

describe('SSE lifecycle',()=>{
    let server;
    let port;
    beforeAll(async () => {
        server = app.listen(0); // random available port
        const addr = server.address();
        port = addr.port;
    });
    afterAll(()=>{ if(server) server.close(); });

    it('client registers and disconnects correctly', async () => {
        assert.strictEqual(app.getLiveClientCount(),0);
        const controller = new AbortController();
        // start SSE connection
        fetch(`http://localhost:${port}/api/live`, { signal: controller.signal })
            .then(async res=>{
                if(res.status!==200) throw new Error('non-200');
                for await (const _ of res.body){ /* consume */}
            })
            .catch(()=>{ /* ignore abort errors */});
        // allow connection to establish
        await delay(300);
        assert.strictEqual(app.getLiveClientCount(),1);
        controller.abort();
        // wait for closure
        await delay(200);
        assert.strictEqual(app.getLiveClientCount(),0);
    });

    it('handles multiple simultaneous clients', async () => {
        const ctrl1 = new AbortController();
        const ctrl2 = new AbortController();
        fetch(`http://localhost:${port}/api/live`, { signal: ctrl1.signal })
            .then(async res=>{ for await(const _ of res.body){} })
            .catch(()=>{});
        fetch(`http://localhost:${port}/api/live`, { signal: ctrl2.signal })
            .then(async res=>{ for await(const _ of res.body){} })
            .catch(()=>{});
        await delay(300);
        assert.strictEqual(app.getLiveClientCount(),2);
        ctrl1.abort();
        ctrl2.abort();
        await delay(200);
        assert.strictEqual(app.getLiveClientCount(),0);
    });
});
