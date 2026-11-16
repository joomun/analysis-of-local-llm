import { getDates, getPerformanceData } from './api.js';
import { initHistoricalCharts, updateHistoricalCharts, genChart as historicalGenChart, promptChart as historicalPromptChart } from './charts/historical.js';
import { initLiveChart, connectLive, disconnectLive, toggleLive } from './charts/live.js';
import { applyTheme, toggleTheme, setIconElements } from './ui/theme.js';
import { setConnectionState } from './ui/status.js';
import { fmt, round } from './utils/formatting.js';

// --- DOM references -------------------------------------------------------
const refreshBtn        = document.getElementById('refreshBtn');
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const autoRefreshLabel  = document.getElementById('autoRefreshLabel');
const themeToggle       = document.getElementById('themeToggle');
// theme toggle element may be missing on landing page
setIconElements(themeToggle);
const themeLabel        = document.getElementById('themeLabel');
const lastUpdatedEl     = document.getElementById('lastUpdated');
const loadingEl         = document.getElementById('loading');
const errorEl           = document.getElementById('error');
const errorMessageEl    = document.getElementById('errorMessage');
const connStatus        = document.getElementById('connStatus');
const statusText        = document.getElementById('statusText');
const dateFilterEl      = document.getElementById('dateFilter');
const liveToggleBtn     = document.getElementById('liveToggle');
const liveToggleLabel   = document.getElementById('liveToggleLabel');

// --- State ----------------------------------------------------------------
let isAutoRefreshing = false;
let autoRefreshInterval = null;
let lastModels = [];
const AUTO_REFRESH_MS = 5000;

// --- Helpers --------------------------------------------------------------
function showLoading(show) {
    if (!loadingEl) return;
    loadingEl.classList.toggle('hidden', !show);
}
function hideError() { if (errorEl) errorEl.classList.add('hidden'); }
function showError(message){ if(errorMessageEl){errorMessageEl.textContent=message;} if(errorEl){errorEl.classList.remove('hidden');} clearTimeout(showError._timer); showError._timer=setTimeout(()=>{if(errorEl)errorEl.classList.add('hidden');},6000);} 

// --- Data (historical, optionally date‑scoped) ----------------------------
async function fetchData({loading=true}={}) {
    const date = dateFilterEl ? dateFilterEl.value : '';
    setConnectionState('busy');
    hideError();
    if(loading) showLoading(true);
    try{
        const data=await getPerformanceData(date||null);
        updateDashboard(data);
        setConnectionState('online');
    }catch(err){
        console.error('Fetch error:',err);
        showError(`Failed to fetch data: ${err.message}`);
        setConnectionState('offline');
    }
    if(loading) showLoading(false);
}

function updateDashboard(data){
    const now = new Date();
    if(lastUpdatedEl) lastUpdatedEl.textContent=`updated ${now.toLocaleTimeString()}`;
    lastModels=Array.isArray(data.models)?data.models:[];
    const overall=data.overall||{}; const stats=data.stats||{}; const health=data.health||{};
    const setNum=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=(val==null? 'N/A':Number(val).toFixed(2));}
    setNum('overallGen', overall.genTps);
    setNum('overallPrompt', overall.promptTps);
    const setText=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=val==null? '0':val;};
    setText('totalTasks', stats.totalTasks);
    setText('totalGenTokens', stats.totalGenTokens);
    setText('modelsDetected', stats.modelsDetected);
    setText('warnCount', health.warnings);
    setText('errCount', health.errors);

    const scope = data.scope=== 'all' || !data.scope ? 'all dates' : data.scope;
    const scopeHintEl=document.getElementById('scopeHint'); if(scopeHintEl) scopeHintEl.textContent=scope;
    const rootEl=document.getElementById('sourceRoot'); if(rootEl) rootEl.textContent=data.logRoot || '—';
    const fileCountEl=document.getElementById('sourceFileCount'); if(fileCountEl) fileCountEl.textContent=`${stats.totalLogFiles||0}`;
    const rangeEl=document.getElementById('sourceRange'); if(rangeEl){rangeEl.textContent= stats.dateRange && stats.dateRange.from?`${stats.dateRange.from} → ${stats.dateRange.to}`:'—';}
    updateSourceFiles(stats.files||[]);

    document.getElementById('modelCount').textContent=`${lastModels.length} model${lastModels.length===1?'':'s'}`;
    updateModelTable(lastModels);
    initHistoricalCharts(lastModels); // create charts on first load
    updateHistoricalCharts(lastModels); // update data
    updateSessionTable(Array.isArray(data.sessions)?data.sessions:[]);
    updateEvents(health.recent||[], health.warnings||0, health.errors||0);
}

function updateSourceFiles(files){
    const list=document.getElementById('sourceFiles'); if(!list) return; list.innerHTML='';
    if(!files.length){const li=document.createElement('li'); li.className='empty'; li.textContent='No log files found for this scope'; list.appendChild(li);return;}
    const frag=document.createDocumentFragment(); files.forEach(f=>{const li=document.createElement('li'); const name=document.createElement('span');name.className='file-name';name.textContent=f.name;name.title=f.name;const count=document.createElement('span');count.className='file-count';const n=f.tasks||0;count.textContent=`${n} task${n===1?'':'s'}`;li.append(name,count);frag.appendChild(li);});list.appendChild(frag);
}



function updateModelTable(models){
    const tbody=document.getElementById('modelTableBody'); if(!tbody) return;
    tbody.innerHTML='';
    if(!models||!models.length){tbody.innerHTML='<tr><td colspan="8">No model data available</td></tr>';return;}
    const sorted=[...models].sort((a,b)=> (b.genTps??0)-(a.genTps??0));
    const frag=document.createDocumentFragment();
    sorted.forEach(m=>{const row=document.createElement('tr');const nameCell=document.createElement('td');const nameSpan=document.createElement('span');nameSpan.className='model-name';nameSpan.textContent=m.name;nameSpan.title=m.name;nameCell.appendChild(nameSpan);row.appendChild(nameCell);
        const cells=[fmt(m.genTps),fmt(m.promptTps),String(m.tasks||0), m.genTokens?m.genTokens.toLocaleString():'—', m.draft?`${(m.draft.acceptance*100).toFixed(0)}%`:'—', m.avgLoadSeconds!==null?`${m.avgLoadSeconds}s`:'—'];
        cells.forEach(text=>{const td=document.createElement('td');td.className='num';td.textContent=text;row.appendChild(td);});
        const visionCell=document.createElement('td'); if(m.vision){const badge=document.createElement('span');badge.className='badge badge-vision';badge.textContent='vision';badge.title='Multimodal projection (mmproj) loaded';visionCell.appendChild(badge);}else{visionCell.textContent='—'};row.appendChild(visionCell);
        frag.appendChild(row);});
    tbody.appendChild(frag);
}

function updateSessionTable(sessions){const tbody=document.getElementById('sessionTableBody'); const countEl=document.getElementById('sessionCount'); if(!tbody)return;tbody.innerHTML='';if(countEl)countEl.textContent=`${sessions.length} session${sessions.length===1?'':'s'}`;
    if(!sessions||!sessions.length){tbody.innerHTML='<tr><td colspan="8">No sessions found for this scope</td></tr>';return;}const sorted=[...sessions].reverse();const frag=document.createDocumentFragment();sorted.forEach(s=>{const row=document.createElement('tr'); const startedCell=document.createElement('td');startedCell.className='mono';startedCell.textContent=s.startTs?String(s.startTs).slice(5):'—';row.appendChild(startedCell);const nameCell=document.createElement('td');const nameSpan=document.createElement('span');nameSpan.className='model-name';nameSpan.textContent=s.model||'—';nameSpan.title=s.model||'';nameCell.appendChild(nameSpan);row.appendChild(nameCell);
        const cells=[s.loadSeconds!==null?`${s.loadSeconds}s`:'—', s.ctx?s.ctx.toLocaleString():'—', s.slots??'—', s.threads??'—', s.port??'—'];
        cells.forEach(text=>{const td=document.createElement('td');td.className='num';td.textContent=String(text);row.appendChild(td);});
        const visionCell=document.createElement('td'); if(s.vision){const badge=document.createElement('span');badge.className='badge badge-vision';badge.textContent='vision';visionCell.appendChild(badge);}else{visionCell.textContent='—'};row.appendChild(visionCell);
        frag.appendChild(row);});tbody.appendChild(frag);
}

function updateEvents(events,warnCount,errCount){const list=document.getElementById('eventsList'); const hint=document.getElementById('healthHint'); if(hint)hint.textContent= events.length?`${warnCount} warning${warnCount===1?'':'s'} · ${errCount} error${errCount===1?'':'s'} · showing ${events.length}`:'all clear';
    if(!list){list.innerHTML='';return;}
    list.innerHTML='';if(!events||!events.length){const empty=document.createElement('div');empty.className='events-empty';empty.textContent='No warnings or errors in this scope';list.appendChild(empty);return;}
    const frag=document.createDocumentFragment(); events.forEach(e=>{const item=document.createElement('div');item.className=`event event-${e.level}`;const time=document.createElement('span');time.className='event-time';time.textContent=e.ts?String(e.ts).slice(5):'—';const tag=document.createElement('span');tag.className='event-tag';tag.textContent=e.level==='error'?'ERR':'WARN';const msg=document.createElement('span');msg.className='event-msg';msg.textContent=e.message||'';msg.title=e.message||'';item.append(time,tag,msg);frag.appendChild(item);});list.appendChild(frag);
}

async function loadDates(){if(!dateFilterEl)return;try{const payload=await getDates(); const dates=Array.isArray(payload.dates)?payload.dates:[];const current=dateFilterEl.value; dateFilterEl.innerHTML='';const all=document.createElement('option');all.value='';all.textContent='All dates';dateFilterEl.appendChild(all);dates.forEach(d=>{const opt=document.createElement('option');opt.value=d;opt.textContent=d;dateFilterEl.appendChild(opt);});dateFilterEl.value=current;}catch(err){console.warn('Could not load dates:',err.message);} }

function toggleAutoRefresh(){isAutoRefreshing=!isAutoRefreshing;if(isAutoRefreshing){autoRefreshToggle.classList.add('is-on');autoRefreshToggle.setAttribute('aria-pressed','true');autoRefreshLabel.textContent='Auto-refresh: on';autoRefreshInterval=setInterval(()=>fetchData({loading:false}),AUTO_REFRESH_MS);}else{autoRefreshToggle.classList.remove('is-on');autoRefreshToggle.setAttribute('aria-pressed','false');autoRefreshLabel.textContent='Auto-refresh: off';clearInterval(autoRefreshInterval);}}

// --- Init -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded',()=>{
    if(refreshBtn) refreshBtn.addEventListener('click',()=>fetchData({loading:true}));
    if(autoRefreshToggle) autoRefreshToggle.addEventListener('click',toggleAutoRefresh);
    if(themeToggle) themeToggle.addEventListener('click',toggleTheme);
    if(dateFilterEl) dateFilterEl.addEventListener('change',()=>fetchData({loading:true}));
    if(liveToggleBtn) liveToggleBtn.addEventListener('click',toggleLive);

    applyTheme(document.documentElement.getAttribute('data-theme')||'dark');

    initLiveChart();
    loadDates();
    connectLive();

    setConnectionState('busy');
    fetchData({loading:true});
});

window.addEventListener('resize',()=>{if(historicalGenChart) historicalGenChart.resize(); if(historicalPromptChart) historicalPromptChart.resize(); });
