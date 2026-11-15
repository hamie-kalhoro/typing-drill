(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
  };
  // ---------- goals (user-editable) ----------
  const DEFAULT_GOALS = { wpm: 60, acc: 95, daily: 99 };
  const GOAL_LIMITS = { wpm: [10, 150], acc: [80, 100], daily: [90, 100] };
  const clampGoal = (k, v) => {
    const [lo, hi] = GOAL_LIMITS[k];
    v = Math.round(Number(v));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : DEFAULT_GOALS[k];
  };
  function loadGoals() {
    const g = { ...DEFAULT_GOALS, ...store.get("goals", {}) };
    Object.keys(DEFAULT_GOALS).forEach((k) => { g[k] = clampGoal(k, g[k]); });
    return g;
  }
  let goals = loadGoals();

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const splitWords = (t) => t.trim().split(/\s+/);
  const stripPunct = (w) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "").replace(/^'+|'+$/g, "");
  const cleanWord = (w) => stripPunct(w).toLowerCase();
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---------- elements ----------
  const textBox = $("#textBox");
  const input = $("#typeInput");
  const textPick = $("#textPick");
  const durationSel = $("#duration");

  // ---------- theme ----------
  const darkMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function applyTheme(pref) {
    const resolved = pref === "system" ? (darkMQ && darkMQ.matches ? "dark" : "light") : pref;
    document.documentElement.dataset.theme = resolved;
    document.querySelectorAll("#themeSwitch button").forEach((b) => {
      const on = b.dataset.themeV === pref;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on);
    });
  }
  let themePref = store.get("theme", "system");
  if (!["light", "dark", "system"].includes(themePref)) themePref = "system";
  applyTheme(themePref);
  if (darkMQ) darkMQ.addEventListener("change", () => { if (themePref === "system") applyTheme("system"); });
  document.querySelectorAll("#themeSwitch button").forEach((b) => b.addEventListener("click", () => {
    themePref = b.dataset.themeV;
    store.set("theme", themePref);
    applyTheme(themePref);
    if (mode === "stats") renderStatsPanel();
  }));

  // ---------- session (typing engine) ----------
  let mode = "stories";
  let session = null;
  let lastStart = null; // function to restart the same exercise

  function startSession(words, opts) {
    stopTimer();
    session = {
      words,
      title: opts.title,
      duration: opts.duration || 0,  // seconds, 0 = full text
      blind: !!opts.blind,
      daily: opts.daily || null,     // {set, step}
      plan: opts.plan || null,       // plan task this run counts towards
      idx: 0,
      typed: [],
      correct: [],
      mistakes: [],
      started: false,
      finished: false,
      startTime: 0,
      timerId: null,
      reveal: true,
      revealTimer: null,
      chars: { match: 0, total: 0, netChars: 0, grossChars: 0 }
    };
    lastStart = () => startSession(opts.regen ? opts.regen() : words, opts);
    $("#textTitle").textContent = opts.title;
    input.value = "";
    input.disabled = false;
    renderAll();
    updateStats();
    scheduleMask();
    input.focus();
  }

  function renderWordHTML(i) {
    const s = session, w = s.words[i];
    if (i < s.idx) {
      return `<span class="word done ${s.correct[i] ? "ok" : "bad"}" id="w${i}">${esc(w)}</span>`;
    }
    if (i === s.idx) {
      const v = input.value;
      if (s.blind && !s.reveal) {
        const shown = esc(v) + "_".repeat(Math.max(0, w.length - v.length));
        return `<span class="word current masked" id="w${i}">${shown}</span>`;
      }
      let html = "";
      const n = Math.max(w.length, v.length);
      for (let k = 0; k < n; k++) {
        if (k < v.length) {
          if (k >= w.length) html += `<span class="l-extra">${esc(v[k])}</span>`;
          else html += `<span class="${v[k] === w[k] ? "l-ok" : "l-bad"}">${esc(w[k])}</span>`;
        } else {
          html += `<span class="l-todo">${esc(w[k])}</span>`;
        }
      }
      return `<span class="word current" id="w${i}">${html}</span>`;
    }
    if (s.blind) return `<span class="word masked" id="w${i}">${"·".repeat(w.length)}</span>`;
    return `<span class="word" id="w${i}">${esc(w)}</span>`;
  }

  function renderAll() {
    const parts = [];
    for (let i = 0; i < session.words.length; i++) parts.push(renderWordHTML(i));
    textBox.innerHTML = parts.join(" ");
    textBox.scrollTop = 0;
    scrollToCurrent();
  }

  function rerender(i) {
    const el = document.getElementById("w" + i);
    if (!el) return;
    const tmp = document.createElement("span");
    tmp.innerHTML = renderWordHTML(i);
    el.replaceWith(tmp.firstChild);
  }

  function scrollToCurrent() {
    const el = document.getElementById("w" + session.idx);
    if (!el) return;
    const lineH = parseFloat(getComputedStyle(textBox).lineHeight) || 38;
    const target = el.offsetTop - lineH - 14;
    textBox.scrollTop = Math.max(0, target);
  }

  // In blind mode: show the current word for 1.5s, then hide it.
  function scheduleMask() {
    if (!session.blind) return;
    clearTimeout(session.revealTimer);
    session.reveal = true;
    rerender(session.idx);
    session.revealTimer = setTimeout(maskNow, 1500);
  }
  function maskNow() {
    if (!session || !session.blind || !session.reveal) return;
    session.reveal = false;
    clearTimeout(session.revealTimer);
    rerender(session.idx);
  }

  function beginTimer() {
    session.started = true;
    session.startTime = performance.now();
    session.timerId = setInterval(tick, 200);
  }
  function stopTimer() {
    if (session) { clearInterval(session.timerId); clearTimeout(session.revealTimer); }
  }
  function elapsed() {
    if (!session || !session.started) return 0;
    return ((session.endTime || performance.now()) - session.startTime) / 1000;
  }
  function tick() {
    if (session.duration && elapsed() >= session.duration) { finish(); return; }
    updateStats();
  }

  function submitWord() {
    const s = session;
    const w = s.words[s.idx];
    const v = input.value;
    const ok = v === w;
    s.typed[s.idx] = v;
    s.correct[s.idx] = ok;
    let match = 0;
    for (let k = 0; k < Math.min(w.length, v.length); k++) if (w[k] === v[k]) match++;
    s.chars.match += match + 1;               // +1 for the space
    s.chars.total += Math.max(w.length, v.length) + 1;
    s.chars.grossChars += v.length + 1;
    if (ok) s.chars.netChars += w.length + 1;
    else s.mistakes.push({ expected: w, typed: v });

    const prev = s.idx;
    s.idx++;
    input.value = "";
    rerender(prev);
    if (s.idx >= s.words.length) { finish(); return; }
    rerender(s.idx);
    scrollToCurrent();
    scheduleMask();
    updateStats();
  }

  function liveNumbers() {
    const s = session;
    const t = Math.max(elapsed(), 0.001);
    const mins = t / 60;
    const net = s.started ? Math.round((s.chars.netChars / 5) / mins) : 0;
    const gross = s.started ? Math.round(((s.chars.grossChars + input.value.length) / 5) / mins) : 0;
    const acc = s.chars.total ? (s.chars.match / s.chars.total) * 100 : 100;
    return { net, gross, acc, t };
  }

  function updateStats() {
    if (!session) return;
    const { net, acc, t } = liveNumbers();
    const timeShown = session.duration ? Math.max(0, session.duration - t) : t;
    $("#sTime").textContent = fmtTime(session.started ? timeShown : (session.duration || 0));
    $("#sWpm").textContent = net;
    $("#sAcc").textContent = acc.toFixed(acc === 100 ? 0 : 1) + "%";
    $("#sErr").textContent = session.mistakes.length;
    $("#sProg").textContent = `${session.idx}/${session.words.length}`;
    $("#progFill").style.width = `${(session.idx / session.words.length) * 100}%`;
  }

  // Sidebar goal card: best qualifying result (accuracy at/above goal) vs the WPM goal.
  function updateGoal() {
    $("#goalWpmLabel").textContent = `${goals.wpm} WPM`;
    $("#goalAccLabel").textContent = `at ${goals.acc}% accuracy`;
    const hist = store.get("history", []);
    const qualifying = hist.filter((h) => h.acc >= goals.acc);
    const best = qualifying.reduce((m, h) => Math.max(m, h.wpm), 0);
    $("#goalFill").style.width = `${Math.min(100, (best / goals.wpm) * 100)}%`;
    let text;
    if (!hist.length) text = "No tests yet";
    else if (!qualifying.length) text = `No test at ${goals.acc}%+ accuracy yet`;
    else if (best >= goals.wpm) text = `Best ${best} WPM · goal reached 🎉`;
    else text = `Best ${best} WPM · ${goals.wpm - best} to go`;
    $("#goalText").textContent = text;
  }

  function finish() {
    const s = session;
    if (s.finished) return;
    s.finished = true;
    s.endTime = performance.now();
    stopTimer();
    input.disabled = true;
    updateStats();
    if (!s.started || s.idx === 0) return; // nothing typed

    const { net, gross, acc, t } = liveNumbers();
    const wrong = s.mistakes.length;
    const right = s.idx - wrong;

    // history
    const hist = store.get("history", []);
    hist.unshift({ date: new Date().toISOString(), title: s.title, wpm: net, acc: +acc.toFixed(1), wrong, secs: Math.round(t) });
    store.set("history", hist.slice(0, 20));
    updateGoal();

    // missed words
    const missed = store.get("missed", {});
    s.mistakes.forEach((m) => { const k = cleanWord(m.expected); if (k) missed[k] = (missed[k] || 0) + 1; });
    store.set("missed", missed);

    // daily progress
    let dailyMsg = "";
    if (s.daily && s.daily.step === "blind") {
      const d = getDaily();
      d.best[s.daily.set] = Math.max(d.best[s.daily.set] || 0, +acc.toFixed(1));
      if (acc >= goals.daily) {
        if (d.unlocked <= s.daily.set && s.daily.set < DAILY_SETS.length - 1) d.unlocked = s.daily.set + 1;
        dailyMsg = s.daily.set < DAILY_SETS.length - 1
          ? `Shabash! ${acc.toFixed(1)}% bina dekhe. Agla set unlock ho gaya.`
          : `Shabash! ${acc.toFixed(1)}% bina dekhe. Aap ne saare sets complete kar liye!`;
      } else {
        dailyMsg = `Bina dekhe accuracy ${acc.toFixed(1)}%. Agle set ke liye ${goals.daily}% chahiye. Dobara try karo.`;
      }
      store.set("daily", d);
      renderDaily();
    } else if (s.daily && s.daily.step === "look") {
      dailyMsg = "Step 1 done. Ab Step 2: bina dekhe likho.";
    }

    // WPM plan progress
    if (s.plan) {
      const rec = store.get("plan", {});
      const prev = rec[s.plan.id];
      if (!prev || net > prev.wpm) rec[s.plan.id] = { wpm: net, acc: +acc.toFixed(1), date: new Date().toISOString() };
      store.set("plan", rec);
      let msg = "Plan task complete ✔";
      if (s.plan.checkpoint) {
        const wk = PLAN_WEEKS[s.plan.week];
        msg = net >= wk.target && acc >= wk.acc
          ? `Checkpoint passed! ${net} WPM at ${acc.toFixed(1)}%. You're ready for the next week.`
          : `Checkpoint target is ${wk.target} WPM at ${wk.acc}%. You got ${net} WPM at ${acc.toFixed(1)}%. Repeat this week's days, then try again.`;
      }
      dailyMsg = dailyMsg ? `${dailyMsg} ${msg}` : msg;
    }

    showResults({ net, gross, acc, t, wrong, right, dailyMsg });
  }

  // ---------- input handling ----------
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); restart(); return; }
    if (!session || session.finished) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (input.value.length) {
        if (!session.started) beginTimer();
        submitWord();
      }
      return;
    }
    if (e.key === "Backspace" && input.value.length === 0) {
      e.preventDefault();
      input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake");
      toast("Pichle word pe wapas nahi ja sakte!");
    }
  });

  input.addEventListener("input", () => {
    if (!session || session.finished) return;
    const v = input.value;
    if (/\s/.test(v)) {               // mobile keyboards / IME spaces
      const first = v.split(/\s+/)[0];
      input.value = first;
      if (first) { if (!session.started) beginTimer(); submitWord(); }
      return;
    }
    if (!session.started && v.length) beginTimer();
    if (session.blind && session.reveal && v.length) { session.reveal = false; clearTimeout(session.revealTimer); }
    rerender(session.idx);
    // last word typed correctly finishes immediately
    if (session.idx === session.words.length - 1 && v === session.words[session.idx]) submitWord();
  });

  input.addEventListener("paste", (e) => { e.preventDefault(); toast("Inko copy mat karo! Paste allowed nahi hai."); });
  input.addEventListener("drop", (e) => e.preventDefault());
  textBox.addEventListener("click", () => input.focus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.activeElement !== input) {
      if (!$("#goalModal").classList.contains("hidden")) closeGoals();
      else if (!$("#modal").classList.contains("hidden")) closeModal();
      else if (mode !== "stats") restart();
    }
  });

  // ---------- content builders ----------
  function drillWords(group, duration) {
    const g = WORD_GROUPS[group];
    const rounds = duration ? 30 : 3;
    const out = [];
    for (let r = 0; r < rounds; r++) {
      if (group === "confusing") shuffle(g.pairs).forEach((p) => out.push(...shuffle(p)));
      else out.push(...shuffle(g.words));
    }
    return out;
  }
  function allDrillWords(duration) {
    const rounds = duration ? 8 : 1;
    const out = [];
    for (let r = 0; r < rounds; r++) {
      const units = [
        ...WORD_GROUPS.long.words.map((w) => [w]),
        ...WORD_GROUPS.double.words.map((w) => [w]),
        ...WORD_GROUPS.hard.words.map((w) => [w]),
        ...WORD_GROUPS.confusing.pairs
      ];
      shuffle(units).forEach((u) => out.push(...u));
    }
    return out;
  }
  function repeatDrill(words, times) {
    const out = [];
    for (let r = 0; r < times; r++) out.push(...shuffle(words));
    return out;
  }

  // ---------- modes ----------
  function fillTextPick() {
    textPick.innerHTML = "";
    let opts = [];
    const label = (s) => `${s.title}  ·  ${splitWords(s.text).length} words`;
    if (mode === "stories") {
      // Grouped list: exam passages, classic stories, punctuation pro.
      const groups = {};
      STORIES.forEach((s, i) => { (groups[s.group] = groups[s.group] || []).push([`S:${i}`, label(s)]); });
      groups["Punctuation Pro (quotes, ! ? ; :)"] = PUNCT_STORIES.map((s, i) => [`P:${i}`, label(s)]);
      Object.entries(groups).forEach(([name, items]) => {
        const og = document.createElement("optgroup");
        og.label = name;
        items.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; og.appendChild(o); });
        textPick.appendChild(og);
      });
      return;
    }
    if (mode === "tough") opts = TOUGH_STORIES.map((s, i) => [i, label(s)]);
    if (mode === "drill") {
      opts = Object.entries(WORD_GROUPS).map(([k, g]) => [k, `${g.name} - ${g.hint}`]);
      opts.push(["all", "All 40 words (mixed)"]);
    }
    opts.forEach(([v, label]) => { const o = document.createElement("option"); o.value = v; o.textContent = label; textPick.appendChild(o); });
  }

  function restart() {
    closeModal();
    const duration = +durationSel.value;
    if (mode === "stories") {
      const [src, i] = (textPick.value || "S:0").split(":");
      const st = storyRef(src, +i);
      startSession(splitWords(st.text), { title: st.title, duration });
    } else if (mode === "tough") {
      const st = TOUGH_STORIES[+textPick.value] || TOUGH_STORIES[0];
      startSession(splitWords(st.text), { title: st.title, duration });
    } else if (mode === "drill") {
      const g = textPick.value;
      const words = g === "all" ? allDrillWords(duration) : drillWords(g, duration);
      const title = g === "all" ? "Drill: All 40 words" : `Drill: ${WORD_GROUPS[g].name}`;
      const regen = () => (g === "all" ? allDrillWords(duration) : drillWords(g, duration));
      startSession(words, { title, duration, regen });
    } else if (mode === "daily") {
      if (lastStart && session && session.daily) lastStart();
      else startDaily("look");
    } else if (lastStart) {
      lastStart();
    }
  }

  const PAGE_HEADS = {
    stories: ["Practice", "Stories", "Classic short stories and everyday paragraphs."],
    tough: ["Practice", "Tough-Word Stories", "Stories packed with the words that slow most typists down."],
    drill: ["Practice", "Word Drill", "Focused repetition of one word group at a time."],
    daily: ["Practice", "Daily 10", () => `Ten words a day: type them while looking, then without looking. Score ${goals.daily}% to unlock the next set.`],
    plan: ["Practice", "60 WPM Plan", "A focused 2-week, 14-day routine: 50 WPM by day 7, 60 WPM by day 14. About 25–30 minutes a day."],
    stats: ["Insights", "Performance", "Your speed trend, accuracy and most-missed words."]
  };

  function setMode(m) {
    mode = m;
    const [eyebrow, title, sub] = PAGE_HEADS[m];
    $("#pageEyebrow").textContent = eyebrow;
    $("#pageTitle").textContent = title;
    $("#pageSub").textContent = typeof sub === "function" ? sub() : sub;
    $("#restartBtn").classList.toggle("hidden", m === "stats" || m === "plan");
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    const isStats = m === "stats";
    const isPlan = m === "plan";
    $("#practice").classList.toggle("hidden", isStats || isPlan);
    $("#statsPanel").classList.toggle("hidden", !isStats);
    $("#planPanel").classList.toggle("hidden", !isPlan);
    $("#planBanner").classList.add("hidden");
    $("#controls").classList.remove("hidden");
    if (isPlan) { if (session) { stopTimer(); session.finished = true; } renderPlan(); return; }
    $("#dailyPanel").classList.toggle("hidden", m !== "daily");
    $("#textPickWrap").classList.toggle("hidden", m === "daily");
    $("#durationWrap").classList.toggle("hidden", m === "daily");
    if (isStats) { if (session) { stopTimer(); session.finished = true; } renderStatsPanel(); return; }
    if (m === "daily") { renderDaily(); startDaily("look"); return; }
    fillTextPick();
    restart();
  }

  document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  textPick.addEventListener("change", restart);
  durationSel.addEventListener("change", restart);
  document.querySelectorAll("#durSeg button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#durSeg button").forEach((x) => x.classList.toggle("on", x === b));
    durationSel.value = b.dataset.v;
    restart();
  }));
  $("#restartBtn").addEventListener("click", restart);

  // ---------- Daily 10 ----------
  function getDaily() {
    const d = store.get("daily", { unlocked: 0, current: 0, best: {} });
    d.best = d.best || {};
    return d;
  }
  function renderDaily() {
    const d = getDaily();
    const set = DAILY_SETS[d.current];
    $("#dTitle").textContent = `Set ${d.current + 1} of ${DAILY_SETS.length}: ${set.name}`;
    $("#dWords").innerHTML = set.words.map((w) => `<span class="chip">${esc(w)}</span>`).join("");
    $("#dPrev").disabled = d.current === 0;
    $("#dNext").disabled = d.current >= d.unlocked;
    $("#dDots").innerHTML = DAILY_SETS.map((_, i) =>
      `<i class="${i === d.current ? "current" : (d.best[i] >= goals.daily ? "passed" : "")}"></i>`).join("");
    const best = d.best[d.current];
    const st = $("#dStatus");
    st.textContent = best != null
      ? `Best blind accuracy ${best}% · ${best >= goals.daily ? "Passed ✔" : `${goals.daily}% needed`}`
      : "Not attempted yet";
    st.className = "badge" + (best != null ? (best >= goals.daily ? " pass" : " fail") : "");
    $("#dRule").textContent = `Roz 10 words lo. ${goals.daily}% bina dekhe sahi ho jaye to agle 10 pe jao.`;
  }
  function moveDaily(delta) {
    const d = getDaily();
    const next = d.current + delta;
    if (next < 0 || next > d.unlocked || next >= DAILY_SETS.length) return;
    d.current = next;
    store.set("daily", d);
    renderDaily();
    startDaily("look");
  }
  function startDaily(step, extra) {
    const d = getDaily();
    const set = DAILY_SETS[d.current];
    const regen = () => step === "look"
      ? set.words.flatMap((w) => [w, w, w, w, w])
      : repeatDrill(set.words, 2);
    const opts = {
      ...(extra || {}),
      title: step === "look" ? `Daily ${d.current + 1} - Step 1: Dekh ke likho` : `Daily ${d.current + 1} - Step 2: Bina dekhe likho (word 1.5 sec dikhega)`,
      duration: 0,
      blind: step === "blind",
      daily: { set: d.current, step },
      regen
    };
    startSession(regen(), opts);
  }
  $("#dPrev").addEventListener("click", () => moveDaily(-1));
  $("#dNext").addEventListener("click", () => moveDaily(1));
  $("#dLook").addEventListener("click", () => startDaily("look"));
  $("#dBlind").addEventListener("click", () => startDaily("blind"));

  // ---------- results ----------
  function showResults(r) {
    $("#rWpm").textContent = r.net;
    $("#rAcc").textContent = r.acc.toFixed(1) + "%";
    $("#rGross").textContent = r.gross;
    const tgt = $("#rTarget");
    const speedOk = r.net >= goals.wpm, accOk = r.acc >= goals.acc;
    if (speedOk && accOk) { tgt.textContent = `✔ Goal reached (${goals.wpm} WPM · ${goals.acc}%)`; tgt.className = "badge pass"; }
    else if (!speedOk) { tgt.textContent = `${goals.wpm - r.net} WPM below goal`; tgt.className = "badge fail"; }
    else { tgt.textContent = `Speed ✔ · accuracy below ${goals.acc}%`; tgt.className = "badge fail"; }
    $("#rDetail").textContent = `${r.right} correct words, ${r.wrong} wrong, time ${fmtTime(r.t)}.`;
    const dm = $("#rDaily");
    dm.textContent = r.dailyMsg;
    dm.classList.toggle("hidden", !r.dailyMsg);
    const tbody = $("#rMistakes tbody");
    tbody.innerHTML = session.mistakes.map((m) => `<tr><td>${esc(m.expected)}</td><td>${esc(m.typed)}</td></tr>`).join("");
    $("#rMistakesWrap").classList.toggle("hidden", !session.mistakes.length);
    $("#rPractice").classList.toggle("hidden", !session.mistakes.length);
    $("#modal").classList.remove("hidden");
    $("#rAgain").focus();
  }
  function closeModal() { $("#modal").classList.add("hidden"); }

  $("#rAgain").addEventListener("click", () => { closeModal(); if (lastStart) lastStart(); });
  $("#rClose").addEventListener("click", () => { closeModal(); });
  $("#rPractice").addEventListener("click", () => {
    const words = [...new Set(session.mistakes.map((m) => stripPunct(m.expected)).filter(Boolean))];
    closeModal();
    practiceWords(words, "Drill: My mistakes");
  });

  function practiceWords(words, title) {
    if (!words.length) { toast("Koi words nahi hain."); return; }
    if (mode !== "drill" && mode !== "stories" && mode !== "tough") setMode("drill");
    const times = Math.max(5, Math.ceil(40 / words.length));
    const regen = () => repeatDrill(words, times);
    startSession(regen(), { title, duration: 0, regen });
  }

  // ---------- stats panel ----------
  function renderStatsPanel() {
    const missed = store.get("missed", {});
    const top = Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 15);
    $("#hardList").innerHTML = top.length
      ? top.map(([w, c]) => `<span class="chip">${esc(w)}<b>×${c}</b></span>`).join("")
      : `<span class="muted">No mistakes recorded yet.</span>`;
    $("#hardDrillBtn").disabled = !top.length;
    const hist = store.get("history", []);
    const fmtDate = (d) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    $("#historyTable tbody").innerHTML = hist.length
      ? hist.map((h) => `<tr><td>${fmtDate(h.date)}</td><td>${esc(h.title)}</td><td class="num strong">${h.wpm}</td><td class="num">${h.acc}%</td><td class="num">${h.wrong}</td><td class="num">${fmtTime(h.secs)}</td></tr>`).join("")
      : `<tr><td colspan="6" class="muted">No results yet.</td></tr>`;

    const n = hist.length;
    const avg = (f) => (n ? hist.reduce((s, h) => s + h[f], 0) / n : 0);
    $("#kTests").textContent = n;
    $("#kBest").textContent = hist.reduce((m, h) => Math.max(m, h.wpm), 0);
    $("#kAvg").textContent = Math.round(avg("wpm"));
    $("#kAcc").textContent = n ? avg("acc").toFixed(1) + "%" : "0%";
    renderChart(hist.slice().reverse(), fmtDate);
  }

  // ---------- WPM trend chart (single series, inline SVG) ----------
  function renderChart(data, fmtDate) {
    $("#chartSub").textContent = `Last 20 tests, oldest to newest. Dashed line = ${goals.wpm} WPM goal.`;
    const box = $("#chart");
    const tip = $("#chartTip");
    if (data.length < 2) {
      box.innerHTML = `<div class="chart-empty">Complete at least 2 tests to see your trend.</div>`;
      return;
    }
    const W = box.clientWidth || 600, H = box.clientHeight || 240;
    const m = { t: 12, r: 16, b: 26, l: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const rawMax = Math.max(60, goals.wpm + 10, Math.max(...data.map((d) => d.wpm)) + 5);
    const step = rawMax <= 60 ? 15 : rawMax <= 120 ? 20 : 40;
    const maxV = Math.ceil(rawMax / step) * step;
    const x = (i) => m.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const y = (v) => m.t + ih - (v / maxV) * ih;

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net WPM over the last ${data.length} tests">`;
    for (let v = 0; v <= maxV; v += step) {
      svg += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
      svg += `<text class="axis-text" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    }
    svg += `<line class="goal" x1="${m.l}" x2="${W - m.r}" y1="${y(goals.wpm)}" y2="${y(goals.wpm)}"/>`;
    svg += `<text class="goal-text" x="${m.l + 6}" y="${y(goals.wpm) - 6}" text-anchor="start">Goal ${goals.wpm}</text>`;
    const pts = data.map((d, i) => `${x(i)},${y(d.wpm)}`);
    svg += `<path class="area" d="M${x(0)},${y(0)} L${pts.join(" L")} L${x(data.length - 1)},${y(0)} Z"/>`;
    svg += `<path class="line" d="M${pts.join(" L")}"/>`;
    svg += `<line class="cross" id="chartCross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
    data.forEach((d, i) => { svg += `<circle class="dot" id="cd${i}" cx="${x(i)}" cy="${y(d.wpm)}" r="4"/>`; });
    const slot = iw / Math.max(1, data.length - 1);
    data.forEach((d, i) => {
      svg += `<rect class="hit" data-i="${i}" x="${x(i) - slot / 2}" y="${m.t}" width="${slot}" height="${ih}"/>`;
    });
    svg += `</svg>`;
    box.innerHTML = svg;

    const cross = box.querySelector("#chartCross");
    box.querySelectorAll(".hit").forEach((r) => {
      r.addEventListener("mouseenter", () => {
        const i = +r.dataset.i, d = data[i];
        box.querySelectorAll(".dot").forEach((c) => c.classList.remove("hover"));
        box.querySelector("#cd" + i).classList.add("hover");
        cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
        tip.innerHTML = `<strong>${d.wpm} WPM</strong><span>${d.acc}% accuracy</span><span>${esc(d.title)}</span><span>${fmtDate(d.date)}</span>`;
        tip.classList.remove("hidden");
      });
      r.addEventListener("mousemove", (e) => {
        const tw = tip.offsetWidth;
        const left = e.clientX + 14 + tw > window.innerWidth ? e.clientX - tw - 14 : e.clientX + 14;
        tip.style.left = left + "px";
        tip.style.top = e.clientY + 14 + "px";
      });
    });
    box.querySelector("svg").addEventListener("mouseleave", () => {
      tip.classList.add("hidden");
      cross.setAttribute("visibility", "hidden");
      box.querySelectorAll(".dot").forEach((c) => c.classList.remove("hover"));
    });
  }
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (mode === "stats") renderStatsPanel(); }, 150);
  });
  $("#hardDrillBtn").addEventListener("click", () => {
    const missed = store.get("missed", {});
    const top = Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
    practiceWords(top, "Drill: My hardest words");
  });
  $("#resetStatsBtn").addEventListener("click", () => {
    if (!confirm("Saare results, mistakes aur Daily 10 progress delete ho jayenge. Sure?")) return;
    ["history", "missed", "daily"].forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
    renderStatsPanel();
    toast("Stats reset.");
  });

  // ---------- goal settings dialog ----------
  const goalModal = $("#goalModal");
  const GOAL_INPUTS = { wpm: ["#gWpm", "#gWpmNum"], acc: ["#gAcc", "#gAccNum"], daily: ["#gDaily", "#gDailyNum"] };

  function setGoalInputs(g) {
    Object.entries(GOAL_INPUTS).forEach(([k, [range, num]]) => { $(range).value = g[k]; $(num).value = g[k]; });
    markPreset();
  }
  function markPreset() {
    const v = +$("#gWpm").value;
    document.querySelectorAll("#wpmPresets button").forEach((b) => b.classList.toggle("on", +b.dataset.v === v));
  }
  Object.entries(GOAL_INPUTS).forEach(([k, [range, num]]) => {
    $(range).addEventListener("input", () => { $(num).value = $(range).value; markPreset(); });
    $(num).addEventListener("input", () => {
      if ($(num).value === "") return;
      $(range).value = clampGoal(k, $(num).value);
      markPreset();
    });
    $(num).addEventListener("change", () => { $(num).value = clampGoal(k, $(num).value); $(range).value = $(num).value; markPreset(); });
  });
  document.querySelectorAll("#wpmPresets button").forEach((b) => b.addEventListener("click", () => {
    $("#gWpm").value = b.dataset.v; $("#gWpmNum").value = b.dataset.v; markPreset();
  }));

  function openGoals() {
    setGoalInputs(goals);
    goalModal.classList.remove("hidden");
    $("#gWpmNum").focus();
    $("#gWpmNum").select();
  }
  function closeGoals() {
    goalModal.classList.add("hidden");
    if (mode !== "stats" && session && !session.finished) input.focus();
  }
  function saveGoals() {
    const next = {};
    Object.entries(GOAL_INPUTS).forEach(([k, [, num]]) => { next[k] = clampGoal(k, $(num).value); });
    goals = next;
    store.set("goals", goals);
    updateGoal();
    renderDaily();
    if (PAGE_HEADS[mode]) {
      const sub = PAGE_HEADS[mode][2];
      $("#pageSub").textContent = typeof sub === "function" ? sub() : sub;
    }
    if (mode === "stats") renderStatsPanel();
    closeGoals();
    toast(`Goals saved: ${goals.wpm} WPM at ${goals.acc}% accuracy`);
  }

  $("#goalEditBtn").addEventListener("click", openGoals);
  $("#gCancel").addEventListener("click", closeGoals);
  $("#gSave").addEventListener("click", saveGoals);
  $("#gReset").addEventListener("click", () => setGoalInputs(DEFAULT_GOALS));
  goalModal.addEventListener("click", (e) => { if (e.target === goalModal) closeGoals(); });
  goalModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeGoals(); }
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); saveGoals(); }
  });

  // ---------- 60 WPM plan ----------
  function storyRef(src, i) {
    const list = { S: STORIES, P: PUNCT_STORIES, T: TOUGH_STORIES }[src] || STORIES;
    return list[i] || list[0];
  }

  const CLASSIC_IDX = STORIES.map((s, i) => (s.group === "Classic Stories" ? i : -1)).filter((i) => i >= 0);
  const EXAM_IDX = STORIES.map((s, i) => (s.group !== "Classic Stories" ? i : -1)).filter((i) => i > 0); // 0 = 10-min test
  // Two-week plan. Each day picks its own warm-up group and passage; day 7 is a checkpoint.
  const PLAN_WEEKS = [
    { name: "Speed Through Punctuation", target: 50, acc: 96, secs: 180, cpSecs: 300,
      warm: ["long", "double", "long", "double", "confusing", "double"],
      pool: [["S", CLASSIC_IDX[0]], ["P", 0], ["S", CLASSIC_IDX[1]], ["P", 1], ["P", 3], ["P", 2]],
      focus: "Push past 45 WPM without losing control: quotation marks, exclamations and double letters at full speed. Never look at the keyboard." },
    { name: "Expert Speed & Stamina", target: 60, acc: 97, secs: 300, cpSecs: 600,
      warm: ["confusing", "hard", "all", "confusing", "hard", "all"],
      pool: [["T", 0], ["S", EXAM_IDX[0]], ["T", 4], ["P", 4], ["S", EXAM_IDX[2]], ["T", 5]],
      focus: "Expert pace on long, confusing and exam-favourite words. Read two words ahead, type in bursts, and hold 60 WPM for the full 10 minutes." }
  ];

  function buildPlan() {
    const days = [];
    PLAN_WEEKS.forEach((wk, w) => {
      for (let d = 0; d < 7; d++) {
        const id = (t) => `p2w${w}d${d}t${t}`;
        const g = wk.warm[Math.min(d, wk.warm.length - 1)];
        const warm = { id: id(0), kind: "drill", group: g, secs: 60,
          label: `Warm-up: ${g === "all" ? "All 40 tough words" : WORD_GROUPS[g].name}`, meta: "1 min drill" };
        let tasks;
        if (d < 6) {
          const [src, i] = wk.pool[d];
          tasks = [
            warm,
            { id: id(1), kind: "story", src, i, secs: wk.secs, label: storyRef(src, i).title, meta: `${wk.secs / 60} min timed passage` },
            { id: id(2), kind: "daily", label: "Daily 10: bina dekhe", meta: "Accuracy drill, words hidden" }
          ];
        } else {
          const secs = wk.cpSecs;
          tasks = [
            warm,
            { id: id(1), kind: "story", src: "S", i: 0, secs, checkpoint: true,
              label: `Checkpoint: ${secs / 60}-min test`, meta: `Target ${wk.target} WPM at ${wk.acc}%` },
            { id: id(2), kind: "review", label: "Review: my hardest words", meta: "Mistake-focused drill" }
          ];
        }
        days.push({ w, d, n: w * 7 + d, tasks });
      }
    });
    return days;
  }
  const PLAN = buildPlan();
  let planSel = null;

  function planRecords() { return store.get("plan", {}); }
  function currentPlanDay(rec) {
    const i = PLAN.findIndex((day) => day.tasks.some((t) => !rec[t.id]));
    return i === -1 ? PLAN.length - 1 : i;
  }

  function renderPlan() {
    const rec = planRecords();
    const cur = currentPlanDay(rec);
    if (planSel == null) planSel = cur;
    const day = PLAN[planSel];
    const wk = PLAN_WEEKS[day.w];

    $("#planDayLabel").textContent = `Week ${day.w + 1} · Day ${day.d + 1}${planSel === cur ? " · Today" : ""}`;
    $("#planDayTitle").textContent = day.d === 6
      ? `Day ${day.n + 1} of ${PLAN.length}: Checkpoint day`
      : `Day ${day.n + 1} of ${PLAN.length}: ${wk.name}`;
    $("#planDayFocus").textContent = wk.focus;
    $("#planTasks").innerHTML = day.tasks.map((t, k) => {
      const r = rec[t.id];
      const pass = t.checkpoint && r ? (r.wpm >= wk.target && r.acc >= wk.acc) : null;
      const result = r ? `<span class="task-result ${pass === false ? "fail" : "pass"}">${r.wpm} WPM · ${r.acc}%</span>` : "";
      return `<div class="task ${r ? "done" : ""} ${t.checkpoint ? "checkpoint" : ""}">
        <span class="task-n">${r ? "✓" : k + 1}</span>
        <div class="task-body"><strong>${esc(t.label)}</strong><span>${esc(t.meta)}</span></div>
        ${result}
        <button class="btn ${r ? "btn-ghost" : "btn-primary"} btn-sm" data-task="${t.id}">${r ? "Redo" : "Start"}</button>
      </div>`;
    }).join("");
    $("#planTasks").querySelectorAll("[data-task]").forEach((b) =>
      b.addEventListener("click", () => startPlanTask(day, day.tasks.find((t) => t.id === b.dataset.task))));

    // overall
    const total = PLAN.length * 3;
    const done = PLAN.reduce((s, dd) => s + dd.tasks.filter((t) => rec[t.id]).length, 0);
    const pct = Math.round((done / total) * 100);
    $("#planPct").textContent = pct + "%";
    $("#planFill").style.width = pct + "%";
    $("#planCount").textContent = `${done} of ${total} tasks done`;
    const curWk = PLAN_WEEKS[PLAN[cur].w];
    $("#planTarget").textContent = `${curWk.target} WPM · ${curWk.acc}%`;
    const cps = PLAN.filter((dd) => dd.d === 6).map((dd) => rec[dd.tasks[1].id]).filter(Boolean);
    $("#planBest").textContent = cps.length ? `${Math.max(...cps.map((r) => r.wpm))} WPM` : "—";

    // week cards
    $("#planWeeks").innerHTML = PLAN_WEEKS.map((w, wi) => {
      const days = PLAN.filter((dd) => dd.w === wi);
      const wDone = days.reduce((s, dd) => s + dd.tasks.filter((t) => rec[t.id]).length, 0);
      const cp = rec[days[6].tasks[1].id];
      const cpPass = cp && cp.wpm >= w.target && cp.acc >= w.acc;
      const pills = days.map((dd) => {
        const n = dd.tasks.filter((t) => rec[t.id]).length;
        const cls = [n === 3 ? "full" : n ? "part" : "", dd.n === cur ? "cur" : "", dd.n === planSel ? "sel" : "", dd.d === 6 ? "cp" : ""].join(" ");
        return `<button class="day-pill ${cls}" data-day="${dd.n}" title="Day ${dd.n + 1}: ${n}/3 tasks">${dd.d === 6 ? "★" : dd.d + 1}</button>`;
      }).join("");
      return `<div class="card week ${PLAN[cur].w === wi ? "week-cur" : ""}">
        <div class="week-head">
          <div><p class="eyebrow">Week ${wi + 1}</p><h3>${esc(w.name)}</h3></div>
          <span class="badge ${cpPass ? "pass" : ""}">${cpPass ? "✔ " : ""}${w.target} WPM</span>
        </div>
        <div class="day-pills">${pills}</div>
        <div class="bar"><div class="bar-fill" style="width:${(wDone / 21) * 100}%"></div></div>
        <span class="muted small">${wDone}/21 tasks${cp ? ` · checkpoint ${cp.wpm} WPM` : ""}</span>
      </div>`;
    }).join("");
    $("#planWeeks").querySelectorAll("[data-day]").forEach((b) =>
      b.addEventListener("click", () => { planSel = +b.dataset.day; renderPlan(); }));
  }

  function startPlanTask(day, t) {
    const wk = PLAN_WEEKS[day.w];
    const plan = { id: t.id, week: day.w, checkpoint: !!t.checkpoint };
    $("#planPanel").classList.add("hidden");
    $("#practice").classList.remove("hidden");
    $("#controls").classList.add("hidden");
    $("#dailyPanel").classList.add("hidden");
    $("#restartBtn").classList.remove("hidden");
    $("#planBanner").classList.remove("hidden");
    $("#planBannerTitle").textContent = `Week ${day.w + 1} · Day ${day.d + 1}: ${t.label}`;
    $("#planBannerMeta").textContent = `${t.meta} · Week target ${wk.target} WPM at ${wk.acc}%`;

    if (t.kind === "drill") {
      const regen = () => (t.group === "all" ? allDrillWords(t.secs) : drillWords(t.group, t.secs));
      startSession(regen(), { title: t.label, duration: t.secs, regen, plan });
    } else if (t.kind === "story") {
      const st = storyRef(t.src, t.i);
      // Repeat the passage so a fast typist never runs out of text before the timer ends (room for ~80 WPM).
      const base = splitWords(st.text);
      const need = Math.ceil((t.secs / 60) * 80);
      const words = [];
      while (words.length < need) words.push(...base);
      startSession(words, { title: t.checkpoint ? `${t.label}: ${st.title}` : st.title, duration: t.secs, plan });
    } else if (t.kind === "daily") {
      startDaily("blind", { plan });
    } else {
      const missed = Object.entries(store.get("missed", {})).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
      const words = missed.length >= 3 ? missed : WORD_GROUPS.hard.words;
      const regen = () => repeatDrill(words, Math.max(4, Math.ceil(40 / words.length)));
      startSession(regen(), { title: t.label, duration: 0, regen, plan });
    }
  }

  $("#planBack").addEventListener("click", () => {
    closeModal();
    const rec = planRecords();
    if (planSel != null && PLAN[planSel].tasks.every((t) => rec[t.id])) planSel = null; // day finished: jump to the next one
    setMode("plan");
  });
  $("#planReset").addEventListener("click", () => {
    if (!confirm("Reset all 60 WPM plan progress? Your test history is kept.")) return;
    try { localStorage.removeItem("plan"); } catch { /* ignore */ }
    planSel = null;
    renderPlan();
    toast("Plan reset.");
  });

  // ---------- text size ----------
  const typingCard = $("#typingCard");
  function applySize(sz) {
    typingCard.dataset.size = sz;
    document.querySelectorAll("#sizeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.size === sz));
    if (session) requestAnimationFrame(() => setTimeout(scrollToCurrent, 170));
  }
  let textSize = store.get("textSize", "l");
  if (!["s", "m", "l", "xl"].includes(textSize)) textSize = "l";
  applySize(textSize);
  document.querySelectorAll("#sizeSeg button").forEach((b) => b.addEventListener("click", () => {
    textSize = b.dataset.size;
    store.set("textSize", textSize);
    applySize(textSize);
    input.focus();
  }));

  // ---------- typing font ----------
  function applyFont(f) {
    typingCard.dataset.font = f;
    document.querySelectorAll("#fontSeg button").forEach((b) => b.classList.toggle("on", b.dataset.font === f));
    if (session) requestAnimationFrame(() => setTimeout(scrollToCurrent, 50));
  }
  let textFont = store.get("textFont", "plex");
  if (!["plex", "exam", "serif", "mono"].includes(textFont)) textFont = "plex";
  applyFont(textFont);
  document.querySelectorAll("#fontSeg button").forEach((b) => b.addEventListener("click", () => {
    textFont = b.dataset.font;
    store.set("textFont", textFont);
    applyFont(textFont);
    input.focus();
  }));
  // Webfonts can finish loading after the first render; keep the current word in view.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (session) scrollToCurrent(); });

  // ---------- live logo + tab title ----------
  const logo = $("#logoMark");
  const BASE_TITLE = "typingDrill by HAMiD";
  let pressT, typingT;
  input.addEventListener("keydown", (e) => {
    if (e.key.length !== 1 && e.key !== "Backspace") return;
    logo.classList.add("press", "typing");
    clearTimeout(pressT); clearTimeout(typingT);
    pressT = setTimeout(() => logo.classList.remove("press"), 90);
    typingT = setTimeout(() => logo.classList.remove("typing"), 1200);
  });
  // Tab title shows live speed while a test runs, and the final score after.
  setInterval(() => {
    if (!session || !session.started) { document.title = BASE_TITLE; return; }
    const { net } = liveNumbers();
    document.title = session.finished ? `✔ ${net} WPM · ${BASE_TITLE}` : `${net} WPM · ${BASE_TITLE}`;
  }, 1000);

  // ---------- boot ----------
  updateGoal();
  setMode("stories");
})();
