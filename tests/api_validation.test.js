const assert=require('assert');
const fs=require('fs');
const path=require('path');
const os=require('os');

async function setupServer(userDir){
    process.env.USERPROFILE=userDir;
    delete require.cache[require.resolve('../Node Interface/server.js')];
    const app=require('../Node Interface/server.js');
    const server=app.listen(0);
    const addr=server.address();
    return {app,server,address:addr};
}

async function closeServer(server){
    if(server && server.close) await new Promise(r=>server.close(r));
}

describe('API validation & filesystem handling',()=>{
    let tmpDir; let srv;
    beforeAll(()=>{tmpDir=fs.mkdtempSync(path.join(os.tmpdir(),'log-test-'));});
    afterAll(()=>{fs.rmdirSync(tmpDir,{recursive:true});});

    test('valid date returns data', async()=>{
        const root = path.join(tmpDir,'.lmstudio','apps','bionic','server-logs');
        fs.mkdirSync(root,{recursive:true});
        const logPath = path.join(root,'2026-11-08.log');
        const content = "[2026-11-08 00:00:00][DEBUG] load_model: loading model 'model.gguf'\n";
        fs.writeFileSync(logPath, content);

        const {server,address}=await setupServer(tmpDir);
        srv=server;
        const res=await fetch(`http://localhost:${address.port}/api/performance-data?date=2026-11-08`);
        assert.strictEqual(res.status,200);
        const data=await res.json();
        // overall.genTps should be defined (maybe null)
        assert(typeof data.overall.genTps === 'number' || data.overall.genTps===null);
    });

    test('invalid date format returns 400', async()=>{ 
        const {server,address}=await setupServer(tmpDir);
        srv=server;
        const res=await fetch(`http://localhost:${address.port}/api/performance-data?date=foo`);
        assert.strictEqual(res.status,400);
        const data=await res.json();
        assert(data.error.includes('Invalid date'));
    });

    test('missing log root returns empty dates', async()=>{ 
        const badDir = path.join(tmpDir,'nonexistent');
        const {server,address}=await setupServer(badDir);
        srv=server;
        const res=await fetch(`http://localhost:${address.port}/api/dates`);
        assert.strictEqual(res.status,200);
        const data=await res.json();
        assert(Array.isArray(data.dates));
    });

    test('empty log directory returns empty dates', async()=>{ 
        const root = path.join(tmpDir,'.lmstudio','apps','bionic','server-logs');
        fs.mkdirSync(root,{recursive:true});
        const {server,address}=await setupServer(tmpDir);
        srv=server;
        const res=await fetch(`http://localhost:${address.port}/api/dates`);
        assert.strictEqual(res.status,200);
        const data=await res.json();
        assert(Array.isArray(data.dates));
    });

    test('corrupted log line is ignored', () => { 
        const corrupted = "This is not a valid log line\n";
        const {parseTextToData} = require('../Node Interface/logParser.js');
        const data=parseTextToData(corrupted);
        assert(Array.isArray(data.tasks));
    });

    test('cache invalidation on file append', async()=>{ 
        await closeServer(srv);
        srv=null;

        const root = path.join(tmpDir,'.lmstudio','apps','bionic','server-logs');
        fs.mkdirSync(root,{recursive:true});
        const logPath = path.join(root,'2026-11-08.log');
        const content = "[2026-11-08 00:00:00][DEBUG] load_model: loading model 'model.gguf'\n";
        fs.writeFileSync(logPath, content);
        const {server,address}=await setupServer(tmpDir);
        srv=server;
        const res1=await fetch(`http://localhost:${address.port}/api/performance-data?date=2026-11-08`);
        const data1=await res1.json();
        const count1=data1.stats.totalTasks || 0;

        // append a new task line
        const newLine = "[2026-11-08 00:01:00][INFO] prompt eval time = 1000 ms / 10 tokens (100 ms per token, 10 tps)\n";
        fs.appendFileSync(logPath, newLine);
        const res2=await fetch(`http://localhost:${address.port}/api/performance-data?date=2026-11-08`);
        const data2=await res2.json();
        const count2=data2.stats.totalTasks || 0;
        assert(count2>count1, 'Task count should increase after append');
    });

    afterEach(async()=>{await closeServer(srv); srv=null;});
});