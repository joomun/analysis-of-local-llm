const assert=require('assert');
const path=require('path');
const logParser=require('../Node Interface/logParser.js');

describe('logParser',()=>{
    it('parseTextToData should extract task metrics', () => {
        const sample=`[2026-11-08 03:05:45][DEBUG] load_model: loading model 'C:/path/model.gguf'
[2026-11-08 03:05:50][INFO] prompt eval time = 15420.59 ms / 6592 tokens (2.34 ms per token, 427.48 tokens per second)
[2026-11-08 03:06:00][INFO] eval time = 8145.54 ms / 64 tokens (129.29 ms per token, 7.73 tokens per second)
[2026-11-08 03:06:05][WARN] draft acceptance = 0.57971 (40 accepted / 69 generated), mean len = 2.74`; 
        const data=logParser.parseTextToData(sample);
        assert(Array.isArray(data.tasks));
        assert.strictEqual(data.tasks.length,1);
        const t=data.tasks[0];
        assert.strictEqual(t.promptTps,427.48);
        assert.strictEqual(t.genTps,7.73);
    });

    it('aggregate should compute overall metrics', () => {
        const sample=`[2026-11-08 03:05:45][DEBUG] load_model: loading model 'C:/path/model.gguf'
[2026-11-08 03:05:50][INFO] prompt eval time = 15420.59 ms / 6592 tokens (2.34 ms per token, 427.48 tokens per second)
[2026-11-08 03:06:00][INFO] eval time = 8145.54 ms / 64 tokens (129.29 ms per token, 7.73 tokens per second)`;
        const data=logParser.parseTextToData(sample);
        const agg=logParser.aggregate(data,1); // fileCount
        assert.strictEqual(agg.overall.genTps>0,true);
        assert.strictEqual(Array.isArray(agg.models),true);
    });
});
