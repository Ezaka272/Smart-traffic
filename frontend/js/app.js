document.addEventListener("DOMContentLoaded", () => {
  const engine = new TrafficEngine(DEFAULT_CONFIG);
  let running = true;
  let autoAi = true;
  let loading = false;
  let decision = null;
  let lastCall = 0;

  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d");

  const btnToggle = document.getElementById("btn-toggle");
  const btnReset = document.getElementById("btn-reset");
  const btnInject = document.getElementById("btn-inject");
  const btnAnalyze = document.getElementById("btn-analyze");

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  const phaseDot = document.getElementById("phase-dot");
  const phaseLabel = document.getElementById("phase-label");

  const statPassed = document.getElementById("stat-passed");
  const statRing = document.getElementById("stat-ring");
  const statAvgWait = document.getElementById("stat-avgwait");
  const statMaxWait = document.getElementById("stat-maxwait");

  const inputSpawn = document.getElementById("spawnRate");
  const inputThreshold = document.getElementById("threshold");
  const inputSpeed = document.getElementById("speed");
  const inputAutoAi = document.getElementById("autoAi");

  const spawnRateVal = document.getElementById("spawn-rate-val");
  const thresholdVal = document.getElementById("threshold-val");
  const thresholdValText = document.getElementById("threshold-val-text");
  const speedVal = document.getElementById("speed-val");

  const aiPanel = document.getElementById("ai-panel");
  const aiSource = document.getElementById("ai-source");
  const aiContent = document.getElementById("ai-content");

  const resizeCanvas = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const size = Math.min(parent.clientWidth, 720);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render(ctx, engine, size);
  };

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function showToast(title, desc, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<strong>${title}</strong>${desc ? `<div style="font-size:0.75rem;margin-top:2px;">${desc}</div>` : ""}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function updateUI() {
    const snap = engine.snapshot();

    statPassed.textContent = snap.passed;
    statRing.textContent = snap.ringCount;
    statAvgWait.textContent = `${snap.avgWait.toFixed(1)} s`;
    statMaxWait.textContent = `${snap.maxWait.toFixed(1)} s`;

    const isAmber = snap.phaseLabel.includes("orange");
    phaseDot.className = `dot ${isAmber ? "amber" : "green"}`;
    phaseLabel.textContent = `${snap.phaseLabel} · ${snap.phaseRemaining.toFixed(1)} s`;

    const maxCount = Math.max(engine.config.threshold, ...DIRECTIONS.map(d => snap.counts[d]));
    DIRECTIONS.forEach(dir => {
      const row = document.querySelector(`.queue-item[data-dir="${dir}"]`);
      if (!row) return;

      const lightState = snap.lights[dir].color;
      const count = snap.counts[dir];
      const isCongested = count >= engine.config.threshold;
      const isPriority = decision?.priority === dir;

      const lightDot = row.querySelector(".light-dot");
      lightDot.className = `dot light-dot ${lightState}`;

      const countEl = row.querySelector(".queue-count");
      countEl.textContent = count;
      countEl.className = `queue-count ${isCongested ? "text-red" : ""}`;

      const pTag = row.querySelector(".priority-tag");
      if (isPriority) pTag.classList.remove("hidden");
      else pTag.classList.add("hidden");

      const fill = row.querySelector(".progress-fill");
      fill.style.width = `${Math.min(100, (count / Math.max(1, maxCount)) * 100)}%`;
      if (isCongested) fill.classList.add("congested");
      else fill.classList.remove("congested");
    });

    if (autoAi && running && !loading && snap.congested.length > 0 && (Date.now() - lastCall > 12000)) {
      runAnalysis(true);
    }
  }

  async function runAnalysis(automatic = false) {
    if (loading) return;
    loading = true;
    lastCall = Date.now();

    aiPanel.classList.add("glow-ring");
    aiSource.textContent = "ANALYSE...";
    btnAnalyze.disabled = true;
    btnAnalyze.textContent = "Analyse en cours...";

    try {
      const s = engine.snapshot();
      const payload = {
        counts: s.counts,
        ringCount: s.ringCount,
        avgWait: Math.round(s.avgWait * 10) / 10,
        maxWait: Math.round(s.maxWait * 10) / 10,
        threshold: engine.config.threshold,
        currentGreen: s.activeGroup,
      };

      const res = await fetch("http://localhost:3000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Erreur API Server: ${res.statusText}`);

      const result = await res.json();
      decision = result;

      engine.applyDecision(result.priority, result.greenDuration);

      aiSource.textContent = result.source === "gemini" ? "GEMINI" : "FALLBACK";
      
      let weatherHtml = "";
      if (result.weather) {
        weatherHtml = `
          <div class="ai-chips">
            <span class="chip">${result.weather.temperature}°C</span>
            <span class="chip">${result.weather.precipitation} mm</span>
            <span class="chip">${result.weather.windSpeed} km/h</span>
            <span class="chip">${result.weather.humidity}%</span>
          </div>
        `;
      }

      aiContent.innerHTML = `
        <div class="ai-grid">
          <div class="stat-card">
            <div class="stat-label">Priorité</div>
            <div class="stat-value accent">${DIRECTION_LABEL[result.priority]}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Vert</div>
            <div class="stat-value accent">${result.greenDuration} s</div>
          </div>
        </div>
        <p class="ai-reason">${result.reason}</p>
        ${weatherHtml}
      `;

      showToast(
        `${result.source === "gemini" ? "Gemini" : "Règle locale"} : priorité ${DIRECTION_LABEL[result.priority]} pendant ${result.greenDuration}s`,
        automatic ? "Déclenché par la congestion" : undefined,
        "success"
      );

    } catch (err) {
      showToast("Analyse impossible", err.message, "error");
    } finally {
      loading = false;
      aiPanel.classList.remove("glow-ring");
      btnAnalyze.disabled = false;
      btnAnalyze.textContent = "🤖 Analyser maintenant";
    }
  }

  btnToggle.addEventListener("click", () => {
    running = !running;
    btnToggle.textContent = running ? "⏸ Pause" : "▶ Démarrer";
    statusDot.className = `dot ${running ? "live-dot green" : "muted"}`;
    statusText.textContent = running ? "Simulation active" : "En pause";
  });

  btnReset.addEventListener("click", () => {
    engine.reset();
    decision = null;
    aiSource.textContent = "VEILLE";
    aiContent.innerHTML = `<p class="ai-idle-text">Surveillance du trafic. L'IA intervient dès qu'une branche dépasse le seuil de congestion.</p>`;
    updateUI();
  });

  btnInject.addEventListener("click", () => {
    DIRECTIONS.forEach(d => {
      for (let i = 0; i < 4; i++) engine.spawnCar(d);
    });
  });

  btnAnalyze.addEventListener("click", () => runAnalysis(false));

  inputSpawn.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    engine.config.spawnRate = val;
    spawnRateVal.textContent = `${val} véh/min`;
  });

  inputThreshold.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    engine.config.threshold = val;
    thresholdVal.textContent = `${val} véh`;
    thresholdValText.textContent = val;
  });

  inputSpeed.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    engine.config.speedFactor = val;
    speedVal.textContent = `${val.toFixed(2)}×`;
  });

  inputAutoAi.addEventListener("change", (e) => {
    autoAi = e.target.checked;
  });

  let lastTime = performance.now();
  let accUi = 0;

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (running) {
      engine.step(dt * engine.config.speedFactor);
      accUi += dt;
      if (accUi > 0.2) {
        accUi = 0;
        updateUI();
      }
    }

    const size = parseFloat(canvas.style.width || "0");
    if (size) render(ctx, engine, size);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});