(() => {
  // ../src/client/api.js
  async function getDates() {
    const resp = await fetch("/api/dates");
    if (!resp.ok) throw new Error(`Failed to load dates: ${resp.status}`);
    return resp.json();
  }
  async function getPerformanceData(date = null) {
    const url = "/api/performance-data" + (date ? `?date=${encodeURIComponent(date)}` : "");
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load performance data: ${resp.status}`);
    return resp.json();
  }

  // ../src/client/charts/historical.js
  var genChart = null;
  var promptChart = null;
  function initHistoricalCharts(models) {
  }
  function updateHistoricalCharts(models) {
  }

  // ../src/client/charts/live.js
  var liveSource = null;
  function initLiveChart() {
  }
  function connectLive() {
    liveSource = null;
  }
  function toggleLive() {
  }

  // ../src/client/utils/formatting.js
  var fmt = (v, digits = 2, suffix = "") => {
    return v === null || v === void 0 ? "\u2014" : Number(v).toFixed(digits) + suffix;
  };

  // ../src/client/ui/theme.js
  var iconMoon = null;
  var iconSun = null;
  var themeLabel = document.getElementById("themeLabel");
  function setIconElements(toggleEl) {
    if (!toggleEl) return;
    iconMoon = toggleEl.querySelector(".icon-moon");
    iconSun = toggleEl.querySelector(".icon-sun");
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme !== "light";
    if (iconMoon) iconMoon.style.display = isDark ? "" : "none";
    if (iconSun) iconSun.style.display = isDark ? "none" : "";
    if (themeLabel) themeLabel.textContent = isDark ? "Light" : "Dark";
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    try {
      localStorage.setItem("dashboard-theme", next);
    } catch (e) {
    }
    applyTheme(next);
  }

  // ../src/client/ui/status.js
  function setConnectionState(state) {
    const connStatus2 = document.getElementById("connStatus");
    const statusText2 = document.getElementById("statusText");
    if (!connStatus2 || !statusText2) return;
    connStatus2.classList.remove("online", "busy", "offline");
    if (state === "online") {
      connStatus2.classList.add("online");
      statusText2.textContent = "online";
    }
    if (state === "busy") {
      connStatus2.classList.add("busy");
      statusText2.textContent = "busy";
    }
    if (state === "offline") {
      connStatus2.classList.add("offline");
      statusText2.textContent = "offline";
    }
  }

  // ../src/client/app.js
  var refreshBtn = document.getElementById("refreshBtn");
  var autoRefreshToggle = document.getElementById("autoRefreshToggle");
  var autoRefreshLabel = document.getElementById("autoRefreshLabel");
  var themeToggle = document.getElementById("themeToggle");
  setIconElements(themeToggle);
  var themeLabel2 = document.getElementById("themeLabel");
  var lastUpdatedEl = document.getElementById("lastUpdated");
  var loadingEl = document.getElementById("loading");
  var errorEl = document.getElementById("error");
  var errorMessageEl = document.getElementById("errorMessage");
  var connStatus = document.getElementById("connStatus");
  var statusText = document.getElementById("statusText");
  var dateFilterEl = document.getElementById("dateFilter");
  var liveToggleBtn = document.getElementById("liveToggle");
  var liveToggleLabel = document.getElementById("liveToggleLabel");
  var isAutoRefreshing = false;
  var autoRefreshInterval = null;
  var lastModels = [];
  var AUTO_REFRESH_MS = 5e3;
  function showLoading(show) {
    if (!loadingEl) return;
    loadingEl.classList.toggle("hidden", !show);
  }
  function hideError() {
    if (errorEl) errorEl.classList.add("hidden");
  }
  function showError(message) {
    if (errorMessageEl) {
      errorMessageEl.textContent = message;
    }
    if (errorEl) {
      errorEl.classList.remove("hidden");
    }
    clearTimeout(showError._timer);
    showError._timer = setTimeout(() => {
      if (errorEl) errorEl.classList.add("hidden");
    }, 6e3);
  }
  async function fetchData({ loading = true } = {}) {
    const date = dateFilterEl ? dateFilterEl.value : "";
    setConnectionState("busy");
    hideError();
    if (loading) showLoading(true);
    try {
      const data = await getPerformanceData(date || null);
      updateDashboard(data);
      setConnectionState("online");
    } catch (err) {
      console.error("Fetch error:", err);
      showError(`Failed to fetch data: ${err.message}`);
      setConnectionState("offline");
    }
    if (loading) showLoading(false);
  }
  function updateDashboard(data) {
    const now = /* @__PURE__ */ new Date();
    if (lastUpdatedEl) lastUpdatedEl.textContent = `updated ${now.toLocaleTimeString()}`;
    lastModels = Array.isArray(data.models) ? data.models : [];
    const overall = data.overall || {};
    const stats = data.stats || {};
    const health = data.health || {};
    const setNum = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val == null ? "N/A" : Number(val).toFixed(2);
    };
    setNum("overallGen", overall.genTps);
    setNum("overallPrompt", overall.promptTps);
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val == null ? "0" : val;
    };
    setText("totalTasks", stats.totalTasks);
    setText("totalGenTokens", stats.totalGenTokens);
    setText("modelsDetected", stats.modelsDetected);
    setText("warnCount", health.warnings);
    setText("errCount", health.errors);
    const scope = data.scope === "all" || !data.scope ? "all dates" : data.scope;
    const scopeHintEl = document.getElementById("scopeHint");
    if (scopeHintEl) scopeHintEl.textContent = scope;
    const rootEl = document.getElementById("sourceRoot");
    if (rootEl) rootEl.textContent = data.logRoot || "\u2014";
    const fileCountEl = document.getElementById("sourceFileCount");
    if (fileCountEl) fileCountEl.textContent = `${stats.totalLogFiles || 0}`;
    const rangeEl = document.getElementById("sourceRange");
    if (rangeEl) {
      rangeEl.textContent = stats.dateRange && stats.dateRange.from ? `${stats.dateRange.from} \u2192 ${stats.dateRange.to}` : "\u2014";
    }
    updateSourceFiles(stats.files || []);
    document.getElementById("modelCount").textContent = `${lastModels.length} model${lastModels.length === 1 ? "" : "s"}`;
    updateModelTable(lastModels);
    initHistoricalCharts(lastModels);
    updateHistoricalCharts(lastModels);
    updateSessionTable(Array.isArray(data.sessions) ? data.sessions : []);
    updateEvents(health.recent || [], health.warnings || 0, health.errors || 0);
  }
  function updateSourceFiles(files) {
    const list = document.getElementById("sourceFiles");
    if (!list) return;
    list.innerHTML = "";
    if (!files.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No log files found for this scope";
      list.appendChild(li);
      return;
    }
    const frag = document.createDocumentFragment();
    files.forEach((f) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = f.name;
      name.title = f.name;
      const count = document.createElement("span");
      count.className = "file-count";
      const n = f.tasks || 0;
      count.textContent = `${n} task${n === 1 ? "" : "s"}`;
      li.append(name, count);
      frag.appendChild(li);
    });
    list.appendChild(frag);
  }
  function updateModelTable(models) {
    const tbody = document.getElementById("modelTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!models || !models.length) {
      tbody.innerHTML = '<tr><td colspan="8">No model data available</td></tr>';
      return;
    }
    const sorted = [...models].sort((a, b) => (b.genTps ?? 0) - (a.genTps ?? 0));
    const frag = document.createDocumentFragment();
    sorted.forEach((m) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const nameSpan = document.createElement("span");
      nameSpan.className = "model-name";
      nameSpan.textContent = m.name;
      nameSpan.title = m.name;
      nameCell.appendChild(nameSpan);
      row.appendChild(nameCell);
      const cells = [fmt(m.genTps), fmt(m.promptTps), String(m.tasks || 0), m.genTokens ? m.genTokens.toLocaleString() : "\u2014", m.draft ? `${(m.draft.acceptance * 100).toFixed(0)}%` : "\u2014", m.avgLoadSeconds !== null ? `${m.avgLoadSeconds}s` : "\u2014"];
      cells.forEach((text) => {
        const td = document.createElement("td");
        td.className = "num";
        td.textContent = text;
        row.appendChild(td);
      });
      const visionCell = document.createElement("td");
      if (m.vision) {
        const badge = document.createElement("span");
        badge.className = "badge badge-vision";
        badge.textContent = "vision";
        badge.title = "Multimodal projection (mmproj) loaded";
        visionCell.appendChild(badge);
      } else {
        visionCell.textContent = "\u2014";
      }
      ;
      row.appendChild(visionCell);
      frag.appendChild(row);
    });
    tbody.appendChild(frag);
  }
  function updateSessionTable(sessions) {
    const tbody = document.getElementById("sessionTableBody");
    const countEl = document.getElementById("sessionCount");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (countEl) countEl.textContent = `${sessions.length} session${sessions.length === 1 ? "" : "s"}`;
    if (!sessions || !sessions.length) {
      tbody.innerHTML = '<tr><td colspan="8">No sessions found for this scope</td></tr>';
      return;
    }
    const sorted = [...sessions].reverse();
    const frag = document.createDocumentFragment();
    sorted.forEach((s) => {
      const row = document.createElement("tr");
      const startedCell = document.createElement("td");
      startedCell.className = "mono";
      startedCell.textContent = s.startTs ? String(s.startTs).slice(5) : "\u2014";
      row.appendChild(startedCell);
      const nameCell = document.createElement("td");
      const nameSpan = document.createElement("span");
      nameSpan.className = "model-name";
      nameSpan.textContent = s.model || "\u2014";
      nameSpan.title = s.model || "";
      nameCell.appendChild(nameSpan);
      row.appendChild(nameCell);
      const cells = [s.loadSeconds !== null ? `${s.loadSeconds}s` : "\u2014", s.ctx ? s.ctx.toLocaleString() : "\u2014", s.slots ?? "\u2014", s.threads ?? "\u2014", s.port ?? "\u2014"];
      cells.forEach((text) => {
        const td = document.createElement("td");
        td.className = "num";
        td.textContent = String(text);
        row.appendChild(td);
      });
      const visionCell = document.createElement("td");
      if (s.vision) {
        const badge = document.createElement("span");
        badge.className = "badge badge-vision";
        badge.textContent = "vision";
        visionCell.appendChild(badge);
      } else {
        visionCell.textContent = "\u2014";
      }
      ;
      row.appendChild(visionCell);
      frag.appendChild(row);
    });
    tbody.appendChild(frag);
  }
  function updateEvents(events, warnCount, errCount) {
    const list = document.getElementById("eventsList");
    const hint = document.getElementById("healthHint");
    if (hint) hint.textContent = events.length ? `${warnCount} warning${warnCount === 1 ? "" : "s"} \xB7 ${errCount} error${errCount === 1 ? "" : "s"} \xB7 showing ${events.length}` : "all clear";
    if (!list) {
      list.innerHTML = "";
      return;
    }
    list.innerHTML = "";
    if (!events || !events.length) {
      const empty = document.createElement("div");
      empty.className = "events-empty";
      empty.textContent = "No warnings or errors in this scope";
      list.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    events.forEach((e) => {
      const item = document.createElement("div");
      item.className = `event event-${e.level}`;
      const time = document.createElement("span");
      time.className = "event-time";
      time.textContent = e.ts ? String(e.ts).slice(5) : "\u2014";
      const tag = document.createElement("span");
      tag.className = "event-tag";
      tag.textContent = e.level === "error" ? "ERR" : "WARN";
      const msg = document.createElement("span");
      msg.className = "event-msg";
      msg.textContent = e.message || "";
      msg.title = e.message || "";
      item.append(time, tag, msg);
      frag.appendChild(item);
    });
    list.appendChild(frag);
  }
  async function loadDates() {
    if (!dateFilterEl) return;
    try {
      const payload = await getDates();
      const dates = Array.isArray(payload.dates) ? payload.dates : [];
      const current = dateFilterEl.value;
      dateFilterEl.innerHTML = "";
      const all = document.createElement("option");
      all.value = "";
      all.textContent = "All dates";
      dateFilterEl.appendChild(all);
      dates.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        dateFilterEl.appendChild(opt);
      });
      dateFilterEl.value = current;
    } catch (err) {
      console.warn("Could not load dates:", err.message);
    }
  }
  function toggleAutoRefresh() {
    isAutoRefreshing = !isAutoRefreshing;
    if (isAutoRefreshing) {
      autoRefreshToggle.classList.add("is-on");
      autoRefreshToggle.setAttribute("aria-pressed", "true");
      autoRefreshLabel.textContent = "Auto-refresh: on";
      autoRefreshInterval = setInterval(() => fetchData({ loading: false }), AUTO_REFRESH_MS);
    } else {
      autoRefreshToggle.classList.remove("is-on");
      autoRefreshToggle.setAttribute("aria-pressed", "false");
      autoRefreshLabel.textContent = "Auto-refresh: off";
      clearInterval(autoRefreshInterval);
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (refreshBtn) refreshBtn.addEventListener("click", () => fetchData({ loading: true }));
    if (autoRefreshToggle) autoRefreshToggle.addEventListener("click", toggleAutoRefresh);
    if (themeToggle) themeToggle.addEventListener("click", toggleTheme);
    if (dateFilterEl) dateFilterEl.addEventListener("change", () => fetchData({ loading: true }));
    if (liveToggleBtn) liveToggleBtn.addEventListener("click", toggleLive);
    applyTheme(document.documentElement.getAttribute("data-theme") || "dark");
    initLiveChart();
    loadDates();
    connectLive();
    setConnectionState("busy");
    fetchData({ loading: true });
  });
  window.addEventListener("resize", () => {
    if (genChart) genChart.resize();
    if (promptChart) promptChart.resize();
  });
})();
