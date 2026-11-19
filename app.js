(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (s) => document.querySelector(s);
  const USER_KEYS = ["history", "missed", "daily", "plan", "goals"];
  let currentUserId = null; // set after sign-in
  const store = {
    // Progress keys are stored per signed-in profile; theme/size/font are device-wide.
    key(k) { return USER_KEYS.includes(k) ? `u:${currentUserId || "anon"}:${k}` : k; },
    get(k, d) { try { const v = localStorage.getItem(this.key(k)); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(this.key(k), JSON.stringify(v)); } catch { /* ignore */ } },
    remove(k) { try { localStorage.removeItem(this.key(k)); } catch { /* ignore */ } }
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
    touchUser();
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
      else if (!document.body.classList.contains("locked") && !$("#practice").classList.contains("hidden")) restart();
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
    exam: ["Practice", "Exam Mode", "Real exam style: type the passage into a blank box with no live checking. Your text is analysed when the time ends."],
    plan: ["Practice", "60 WPM Plan", "A focused 2-week, 14-day routine: 50 WPM by day 7, 60 WPM by day 14. About 25–30 minutes a day."],
    stats: ["Insights", "Performance", "Your speed trend, accuracy and most-missed words."],
    admin: ["Admin", "All profiles", "Only you can see this page. Import progress files from other devices to track everyone in one place."]
  };

  function setMode(m) {
    // Admin-only pages: the dashboard and the 2-week plan.
    if ((m === "admin" || m === "plan") && !(currentUser && currentUser.role === "admin")) m = "stories";
    if (mode === "exam" && m !== "exam") stopExam();
    mode = m;
    $("#adminPanel").classList.toggle("hidden", m !== "admin");
    $("#examPanel").classList.toggle("hidden", m !== "exam");
    if (m === "exam") {
      const [eyebrow, title, sub] = PAGE_HEADS.exam;
      $("#pageEyebrow").textContent = eyebrow;
      $("#pageTitle").textContent = title;
      $("#pageSub").textContent = sub;
      $("#restartBtn").classList.add("hidden");
      document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
      ["#practice", "#statsPanel", "#planPanel"].forEach((s) => $(s).classList.add("hidden"));
      if (session) { stopTimer(); session.finished = true; }
      examReset();
      return;
    }
    if (m === "admin") {
      const [eyebrow, title, sub] = PAGE_HEADS.admin;
      $("#pageEyebrow").textContent = eyebrow;
      $("#pageTitle").textContent = title;
      $("#pageSub").textContent = sub;
      $("#restartBtn").classList.add("hidden");
      document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
      ["#practice", "#statsPanel", "#planPanel"].forEach((s) => $(s).classList.add("hidden"));
      if (session) { stopTimer(); session.finished = true; }
      renderAdmin();
      return;
    }
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

  document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => {
    if (mode === "exam" && b.dataset.mode !== "exam" && examUnsaved() && !confirm("An exam is running. Leave and lose it?")) return;
    setMode(b.dataset.mode);
  }));
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
  function renderChart(data, fmtDate, boxSel = "#chart", subSel = "#chartSub", goalWpm = goals.wpm) {
    if (subSel) $(subSel).textContent = `Last ${data.length} tests, oldest to newest. Dashed line = ${goalWpm} WPM goal.`;
    const box = $(boxSel);
    const tip = $("#chartTip");
    if (data.length < 2) {
      box.innerHTML = `<div class="chart-empty">Complete at least 2 tests to see your trend.</div>`;
      return;
    }
    const W = box.clientWidth || 600, H = box.clientHeight || 240;
    const m = { t: 12, r: 16, b: 26, l: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const rawMax = Math.max(60, goalWpm + 10, Math.max(...data.map((d) => d.wpm)) + 5);
    const step = rawMax <= 60 ? 15 : rawMax <= 120 ? 20 : 40;
    const maxV = Math.ceil(rawMax / step) * step;
    const x = (i) => m.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const y = (v) => m.t + ih - (v / maxV) * ih;

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net WPM over the last ${data.length} tests">`;
    for (let v = 0; v <= maxV; v += step) {
      svg += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
      svg += `<text class="axis-text" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    }
    svg += `<line class="goal" x1="${m.l}" x2="${W - m.r}" y1="${y(goalWpm)}" y2="${y(goalWpm)}"/>`;
    svg += `<text class="goal-text" x="${m.l + 6}" y="${y(goalWpm) - 6}" text-anchor="start">Goal ${goalWpm}</text>`;
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
    ["history", "missed", "daily"].forEach((k) => store.remove(k));
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
    store.remove("plan");
    planSel = null;
    renderPlan();
    toast("Plan reset.");
  });

  // =====================================================================
  // Exam Mode (High Court style): the typist copies from their own printed
  // paper into a blank box. Nothing is shown or checked while typing. When
  // the time ends they enter the original passage, and the typed text is
  // aligned against it word by word; every mistake counts against accuracy.
  // =====================================================================
  const examCard = $("#examCard");
  const examInput = $("#examInput");
  const examName = $("#examName");
  let exam = null;
  let examSecs = 300;

  const examRunning = () => !!(exam && exam.started && !exam.done);
  const examTitle = () => examName.value.trim() || "My paper";
  // Typed but not yet analysed (still running, or waiting for the original passage).
  const examUnsaved = () => !!(exam && exam.started && !exam.saved);

  function examReset() {
    if (exam) clearInterval(exam.timer);
    exam = { secs: examSecs, started: false, done: false, startTime: 0, timer: null };
    loadDict();
    $("#examTitle").textContent = examTitle();
    $("#examState").textContent = "Timer starts on your first key";
    $("#examTimer").textContent = fmtTime(examSecs);
    $("#examTimer").classList.remove("low");
    $("#examSubmit").disabled = true;
    examInput.value = "";
    examInput.disabled = false;
    examName.disabled = false;
    document.querySelectorAll("#examDur button").forEach((b) => { b.disabled = false; });
    $("#examLive").classList.remove("hidden");
    $("#examSetup").classList.remove("hidden");
    $("#examResult").classList.add("hidden");
    examInput.focus();
  }

  function examElapsed() { return exam && exam.started ? ((exam.endTime || performance.now()) - exam.startTime) / 1000 : 0; }

  function examTick() {
    const left = exam.secs - examElapsed();
    $("#examTimer").textContent = fmtTime(Math.max(0, Math.ceil(left)));
    $("#examTimer").classList.toggle("low", left <= 30);
    if (left <= 0) finishExam(true);
  }

  function examBegin() {
    exam.started = true;
    exam.startTime = performance.now();
    exam.timer = setInterval(examTick, 250);
    exam.title = examTitle();
    $("#examTitle").textContent = exam.title;
    examName.disabled = true;
    document.querySelectorAll("#examDur button").forEach((b) => { b.disabled = true; });
    $("#examSubmit").disabled = false;
    $("#examState").textContent = "Exam in progress";
  }

  // Letter edit distance where swapping two neighbouring letters ("teh") counts as one edit.
  function lev(a, b) {
    if (a === b) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // What kind of mistake is typing `t` where `e` was expected?
  function mistakeKind(e, t) {
    const ce = cleanWord(e), ct = cleanWord(t);
    if (ce && ce === ct) return "punct";                 // only punctuation or capital letters differ
    const a = e.toLowerCase(), b = t.toLowerCase();
    return 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.5 ? "spell" : "wrong";
  }

  // Align typed words with the passage (edit distance over words). Skipping a passage word,
  // adding an extra word and typing a different word each cost 1. The alignment may stop
  // anywhere in the passage, so the untyped rest of the passage is not counted.
  // Printed books use curly quotes and break words with hyphens at line ends ("de-motivated"),
  // so those differences are not mistakes.
  const wordKey = (w) => w.replace(/[‘’ʼ`]/g, "'").replace(/[“”]/g, '"').replace(/[-‐-—]/g, "");
  function alignExam(refWords, typWords) {
    // List bullets ("-", "•", "*") are not words: ignore them on both sides.
    const isWord = (w) => wordKey(w).replace(/[•*·]/g, "") !== "";
    refWords = refWords.filter(isWord);
    typWords = typWords.filter(isWord);
    const ref = refWords.map(wordKey), typ = typWords.map(wordKey);
    const n = typ.length;
    const m = ref.length;
    const W = m + 1;
    const D = new Uint16Array((n + 1) * W);   // row 0 stays 0: the typist may start anywhere in the paper
    for (let i = 1; i <= n; i++) {
      D[i * W] = i;
      for (let j = 1; j <= m; j++) {
        const diag = D[(i - 1) * W + j - 1] + (typ[i - 1] === ref[j - 1] ? 0 : 1);
        const up = D[(i - 1) * W + j] + 1;   // extra typed word
        const left = D[i * W + j - 1] + 1;   // skipped passage word
        D[i * W + j] = Math.min(diag, up, left);
      }
    }
    let j = 0;
    for (let k = 1; k <= m; k++) if (D[n * W + k] <= D[n * W + j]) j = k; // on a tie, pair the last typed word with a passage word
    const ops = [];
    let i = n;
    while (i > 0) {
      const c = D[i * W + j];
      if (i > 0 && j > 0 && c === D[(i - 1) * W + j - 1] + (typ[i - 1] === ref[j - 1] ? 0 : 1)) {
        ops.push({ op: typ[i - 1] === ref[j - 1] ? "ok" : "sub", e: refWords[j - 1], t: typWords[i - 1] });
        i--; j--;
      } else if (i > 0 && c === D[(i - 1) * W + j] + 1) {
        ops.push({ op: "extra", t: typWords[i - 1] }); i--;
      } else {
        ops.push({ op: "miss", e: refWords[j - 1] }); j--;
      }
    }
    return ops.reverse();
  }

  // ---------- dictionary (SCOWL word lists in words-en.js, loaded on first use) ----------
  let dict = null;          // Map: lowercase word -> frequency tier (10 = most common)
  let dictLoading = null;
  const coreWord = (w) => w.replace(/[‘’]/g, "'").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  const getMyWords = () => new Set(store.get("myWords", []));
  let myWords = getMyWords();

  function loadDict() {
    if (dict) return Promise.resolve(dict);
    if (dictLoading) return dictLoading;
    dictLoading = new Promise((resolve) => {
      const build = () => {
        const tiers = window.TD_WORDS;
        if (!tiers) { dictLoading = null; resolve(null); return; }
        const m = new Map();
        Object.keys(tiers).sort((a, b) => a - b).forEach((t) => {
          tiers[t].split(" ").forEach((w) => { w = w.toLowerCase(); if (w && !m.has(w)) m.set(w, +t); });
        });
        // Every word in the app's own passages is known too.
        [...STORIES, ...PUNCT_STORIES, ...TOUGH_STORIES].forEach((s) => splitWords(s.text).forEach((w) => {
          const c = coreWord(w).toLowerCase();
          if (c && !m.has(c)) m.set(c, 50);
        }));
        dict = m;
        resolve(m);
      };
      if (window.TD_WORDS) { build(); return; }
      const s = document.createElement("script");
      s.src = "words-en.js?v=4";
      s.onload = build;
      s.onerror = () => { dictLoading = null; resolve(null); };
      document.head.appendChild(s);
    });
    return dictLoading;
  }

  // Common abbreviations: known words, and their full stop does not end a sentence.
  const ABBR = new Set(["mr", "mrs", "ms", "dr", "prof", "st", "jr", "sr", "vs", "etc", "no", "nos", "sec", "secs", "art", "arts",
    "govt", "hon", "ltd", "co", "inc", "pvt", "viz", "cf", "ch", "para", "paras", "vol", "pp", "adv", "hon'ble", "honble", "dept", "sq"]);
  const endsSentence = (t) => {
    if (!/[.?!]["')\]]*$/.test(t)) return false;
    if (/[?!]["')\]]*$/.test(t)) return true;
    const c = coreWord(t);
    return !(ABBR.has(c.toLowerCase()) || /^([A-Za-z]\.)*[A-Za-z]$/.test(c));   // Mr. / e.g. / U.S. / A.
  };

  function isKnown(c) {
    if (!c || /\d/.test(c)) return true;                    // numbers, dates, section 302
    const l = c.toLowerCase();
    if (dict.has(l) || myWords.has(l)) return true;
    if (/^[A-Z]{2,}s?$/.test(c)) return true;                // acronyms: CPC, FIR, PPC
    if (/^([A-Za-z]\.)+[A-Za-z]?$/.test(c)) return true;     // abbreviations: e.g, U.S
    if (ABBR.has(l)) return true;                            // Mr, Dr, Govt, vs, etc
    if (/'s$/i.test(c)) return isKnown(c.slice(0, -2));      // possessive
    if (/^(can't|won't|shan't|ain't)$/.test(l)) return true;
    const ct = l.match(/^(.+?)(n't|'ll|'re|'ve|'d|'m)$/);     // contractions: don't, they'll, I'm
    if (ct) return dict.has(ct[1]);
    if (c.includes("-")) return c.split("-").every((p) => !p || isKnown(p));
    return false;
  }

  const ALPHA = "abcdefghijklmnopqrstuvwxyz";
  function edits1(w) {
    const out = new Set();
    for (let i = 0; i <= w.length; i++) {
      const a = w.slice(0, i), b = w.slice(i);
      if (b) out.add(a + b.slice(1));                                   // missing letter
      if (b.length > 1) out.add(a + b[1] + b[0] + b.slice(2));          // swapped letters
      for (const ch of ALPHA) { if (b) out.add(a + ch + b.slice(1)); out.add(a + ch + b); }
    }
    out.delete(w);
    return out;
  }
  const recase = (s, like) => (/^[A-Z]{2,}$/.test(like) ? s.toUpperCase() : /^[A-Z]/.test(like) ? s[0].toUpperCase() + s.slice(1) : s);

  // Up to 3 dictionary words close to `c`, most likely first. Returns [{w, d}] (d = letters changed).
  function suggest(c) {
    const w = c.toLowerCase();
    const found = new Map();
    const add = (x, d) => {
      const tier = dict.has(x) ? dict.get(x) : myWords.has(x) ? 40 : null;
      if (tier == null) return;
      const score = d * 100 + tier + (x[0] === w[0] ? 0 : 25);
      if (!found.has(x) || found.get(x).score > score) found.set(x, { w: x, d, score });
    };
    const e1 = edits1(w);
    e1.forEach((x) => add(x, 1));
    if (!found.size && w.length <= 12) e1.forEach((x) => edits1(x).forEach((y) => { if (y !== w) add(y, 2); }));
    // Two common words run together: "thegovernment" -> "the government"
    const hasClose = [...found.values()].some((f) => f.d === 1);
    for (let i = 1; i < w.length && !hasClose; i++) {
      const a = w.slice(0, i), b = w.slice(i);
      if ((a.length > 1 || a === "a") && b.length > 1 && dict.get(a) <= 35 && dict.get(b) <= 35) {
        const k = `${a} ${b}`;
        found.set(k, { w: k, d: 1, split: true, score: 140 + Math.max(dict.get(a), dict.get(b)) });
      }
    }
    return [...found.values()].sort((x, y) => x.score - y.score).slice(0, 3).map((s) => ({ w: recase(s.w, c), d: s.d, split: !!s.split }));
  }

  // Check the typed text on its own (no original needed): spelling with suggestions,
  // capitals, spaces around punctuation and repeated words.
  const REPEAT_OK = new Set(["had", "that", "is", "do", "very"]);
  function dictCheck(raw, byTimer) {
    const toks = splitWords(raw);
    const items = [];
    let sentenceStart = true;
    toks.forEach((t, i) => {
      const it = { t, issues: [] };
      items.push(it);
      const isLast = i === toks.length - 1;
      if (byTimer && isLast && !/\s$/.test(raw) && !isKnown(coreWord(t))) { it.cut = true; return; } // cut off by the timer
      if (/^[,.;:!?]+$/.test(t)) {
        if (i > 0) it.issues.push({ kind: "punct", hint: "No space before punctuation", fix: `${toks[i - 1]}${t}` });
        it.punctOnly = true;
        sentenceStart = /[.?!]$/.test(t);
        return;
      }
      const c = coreWord(t);
      if (c) {
        if (sentenceStart && /^[a-z]/.test(c)) it.issues.push({ kind: "punct", hint: "Start a sentence with a capital letter", fix: recase(c, "A") });
        else if (/^i($|')/.test(c)) it.issues.push({ kind: "punct", hint: "Write \"I\" as a capital letter", fix: "I" + c.slice(1) });
        if (/[A-Za-z]{2}[,;:!?][A-Za-z]|[a-z]{2}\.[A-Za-z]{2}/.test(c)) it.issues.push({ kind: "punct", hint: "Add a space after punctuation", fix: c.replace(/([,;:!?.])(?=[A-Za-z]{2})/g, "$1 ") });
        if (/([,;:!?])\1|[,;:][,.;:]/.test(t)) it.issues.push({ kind: "punct", hint: "Double punctuation", fix: t.replace(/([,.;:!?])[,.;:!?]+/g, "$1") });
        const prev = i > 0 ? toks[i - 1] : "";
        if (prev && !/[.?!,;:]$/.test(prev) && coreWord(prev).toLowerCase() === c.toLowerCase() && !REPEAT_OK.has(c.toLowerCase())) {
          it.issues.push({ kind: "repeat", hint: "Same word typed twice", fix: "remove one" });
        }
        // Spell-check each part (a missing space can glue two words with punctuation).
        c.split(/[,;:!?]|(?<=[a-z]{2})\.(?=[A-Za-z]{2})/).forEach((p) => {
          p = coreWord(p);
          if (!p || isKnown(p)) return;
          const sug = suggest(p);
          if (/^[A-Z]/.test(p) && !sentenceStart && !(sug.length && sug[0].d === 1 && !sug[0].split)) {
            it.issues.push({ kind: "name", hint: "Not in the dictionary. A name? Please check it", word: p });
          } else {
            it.issues.push({ kind: "spell", hint: sug.length ? "Did you mean" : "Not in the dictionary", fix: sug.map((s) => s.w).join(", "), word: p });
          }
        });
      }
      sentenceStart = endsSentence(t);
    });
    return items;
  }

  function finishExam(byTimer) {
    if (!exam || exam.done) return;
    exam.done = true;
    exam.endTime = exam.startTime + Math.min(exam.secs, examElapsed()) * 1000;
    clearInterval(exam.timer);
    examInput.disabled = true;
    exam.raw = examInput.value;
    exam.byTimer = byTimer;
    if (!exam.started || !exam.raw.trim()) { toast("Kuch type nahi kiya. Exam dobara start karo."); examReset(); return; }
    exam.id = newExamId();
    exam.date = new Date().toISOString();
    $("#examState").textContent = "Checking your typing…";
    // Never leave the typist without a result: if the dictionary is slow to load or a check
    // fails, fall back to a speed-only result.
    const giveUp = new Promise((r) => setTimeout(r, 4000));
    Promise.race([loadDict(), giveUp]).then(() => setTimeout(() => {
      try {
        const paper = matchPaper(exam.raw);
        if (paper) analyseByOriginal(paper); else analyseByDict();
      } catch (err) {
        console.error("Exam check failed:", err);
        showSpeedOnly();
      }
    }, 20));
  }

  function showSpeedOnly() {
    exam.saved = true;
    renderExamResult({
      source: "none", net: null, gross: grossOf(exam.raw), acc: null, typedWords: splitWords(exam.raw).length,
      tiles: [], review: esc(exam.raw), rows: [], practice: []
    });
  }

  // Which saved exam paper (exam-papers.js) was the typist copying? Compared by shared word pairs,
  // so the paper is found even with many mistakes. Returns null if none fits well enough.
  const pairKeys = (text) => {
    const w = splitWords(text).map((x) => cleanWord(wordKey(x))).filter(Boolean);
    const out = new Set();
    for (let i = 1; i < w.length; i++) out.add(w[i - 1] + " " + w[i]);
    return out;
  };
  function matchPaper(raw) {
    const papers = window.EXAM_PAPERS || [];
    const typed = pairKeys(raw);
    if (typed.size < 4) return null;
    let best = null, bestScore = 0;
    papers.forEach((p) => {
      p.pairs = p.pairs || pairKeys(p.text);
      let hit = 0;
      typed.forEach((k) => { if (p.pairs.has(k)) hit++; });
      const score = hit / typed.size;
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return bestScore >= 0.35 ? best : null;
  }
  const newExamId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const examMins = () => Math.max(examElapsed(), 1) / 60;
  const grossOf = (raw) => Math.round(((raw.trim().length + 1) / 5) / examMins());

  function analyseByDict() {
    const raw = exam.raw;
    if (!dict) { showSpeedOnly(); return; }
    const items = dictCheck(raw, exam.byTimer);
    const counted = (it) => it.issues.some((x) => x.kind !== "name");
    const words = items.filter((it) => !it.cut && !it.punctOnly);
    const clean = words.filter((it) => !counted(it));
    const cnt = (k) => items.reduce((s, it) => s + it.issues.filter((x) => x.kind === k).length, 0);
    const wrongWords = items.filter((it) => !it.cut && counted(it)).length;
    const netChars = clean.reduce((s, it) => s + it.t.length + 1, 0);
    const net = Math.round((netChars / 5) / examMins());
    const acc = words.length ? (clean.length / (clean.length + wrongWords)) * 100 : 0;
    const KIND_CLASS = { spell: "spell", punct: "punct", repeat: "extra", name: "name" };

    const review = items.map((it) => {
      if (it.cut) return `<span class="xw cut" title="Cut off by the timer, not counted">${esc(it.t)}</span>`;
      if (!it.issues.length) return `<span class="xw ok">${esc(it.t)}</span>`;
      const main = it.issues.find((x) => x.kind !== "name") || it.issues[0];
      const title = it.issues.map((x) => `${HINT_LABEL[x.kind]}: ${x.hint}${x.fix ? ` → ${x.fix}` : ""}`).join("\n");
      const fix = main.kind === "spell" ? (main.fix || "").split(", ")[0] : main.kind === "repeat" ? "" : main.fix || "";
      return `<span class="xw ${KIND_CLASS[main.kind]}" title="${esc(title)}">${esc(it.t)}${fix ? `<sup>${esc(fix)}</sup>` : ""}</span>`;
    }).join(" ");

    const rows = [];
    items.forEach((it) => it.issues.forEach((x) => rows.push({
      kind: x.kind, typed: x.word || it.t,
      hint: x.fix ? `${x.hint}: <b>${esc(x.fix)}</b>` : esc(x.hint),
      addable: x.kind === "name" || x.kind === "spell" ? x.word : null
    })));
    const practice = items.flatMap((it) => it.issues.filter((x) => x.kind === "spell" && x.fix).map((x) => x.fix.split(", ")[0]))
      .filter((w) => !w.includes(" "));

    saveExamHistory(net, acc, wrongWords, practice);
    renderExamResult({
      source: "dict", net, gross: grossOf(raw), acc, typedWords: words.length,
      tiles: [
        [clean.length, "Correct words", "good"],
        [cnt("spell"), "Spelling", "bad"],
        [cnt("punct"), "Punctuation / capitals", "bad"],
        [cnt("repeat"), "Repeated words", "bad"],
        [cnt("name"), "Names to check (not counted)", "warn"]
      ],
      review, rows, practice, mistakes: wrongWords
    });
  }

  function analyseByOriginal(paper) {
    const ref = splitWords(paper.text);
    exam.paper = paper.title;
    if (!examName.value.trim()) exam.title = paper.title;
    const raw = exam.raw, typ = splitWords(raw);
    const ops = alignExam(ref, typ);
    // A half-typed last word cut off by the timer is not a mistake: drop it.
    if (exam.byTimer && !/\s$/.test(raw)) {
      const last = ops[ops.length - 1];
      if (last && last.op === "sub" && last.e.startsWith(last.t)) ops.pop();
    }
    // Leftover "skipped" words at the very end just mean the typist stopped there.
    while (ops.length && ops[ops.length - 1].op === "miss") ops.pop();

    const count = { ok: 0, spell: 0, wrong: 0, punct: 0, miss: 0, extra: 0 };
    const mistakes = [];
    let netChars = 0;
    ops.forEach((o) => {
      if (o.op === "ok") { count.ok++; netChars += o.e.length + 1; return; }
      o.kind = o.op === "sub" ? mistakeKind(o.e, o.t) : o.op;
      count[o.kind]++;
      mistakes.push(o);
    });
    const net = Math.round((netChars / 5) / examMins());
    const acc = count.ok + mistakes.length ? (count.ok / (count.ok + mistakes.length)) * 100 : 0;
    const review = ops.map((o) => {
      if (o.op === "ok") return `<span class="xw ok">${esc(o.t)}</span>`;
      if (o.op === "extra") return `<span class="xw extra" title="Extra word, not in the passage">${esc(o.t)}</span>`;
      if (o.op === "miss") return `<span class="xw miss" title="Skipped: you did not type this word">${esc(o.e)}</span>`;
      return `<span class="xw ${o.kind}" title="${HINT_LABEL[o.kind]}. Expected: ${esc(o.e)}">${esc(o.t)}<sup>${esc(o.e)}</sup></span>`;
    }).join(" ");
    const rows = mistakes.map((m) => ({
      kind: m.kind, typed: m.t || "",
      hint: m.e ? `Expected: <b>${esc(m.e)}</b>` : "Not in the original: remove it"
    }));
    const practice = mistakes.filter((m) => m.e).map((m) => stripPunct(m.e));
    saveExamHistory(net, acc, mistakes.length, practice);
    renderExamResult({
      source: "original", net, gross: grossOf(raw), acc, typedWords: typ.length,
      tiles: [
        [count.ok, "Correct words", "good"],
        [count.spell, "Spelling", "bad"],
        [count.wrong, "Wrong words", "bad"],
        [count.punct, "Punctuation / capitals", "bad"],
        [count.miss, "Skipped words", "bad"],
        [count.extra, "Extra words", "bad"]
      ],
      review, rows, practice, mistakes: mistakes.length
    });
  }

  // One history row per attempt; checking against the original later updates that same row.
  function saveExamHistory(net, acc, wrong, missedWords) {
    exam.saved = true;
    const hist = store.get("history", []);
    const entry = { date: exam.date, title: `Exam: ${exam.title}`, wpm: net, acc: +acc.toFixed(1), wrong, secs: Math.round(examElapsed()), examId: exam.id };
    const i = hist.findIndex((h) => h.examId === exam.id);
    if (i >= 0) hist[i] = entry; else hist.unshift(entry);
    store.set("history", hist.slice(0, 20));
    exam.missedAdded = exam.missedAdded || new Set();
    const missed = store.get("missed", {});
    missedWords.forEach((w) => {
      const k = cleanWord(w);
      if (k && !exam.missedAdded.has(k)) { exam.missedAdded.add(k); missed[k] = (missed[k] || 0) + 1; }
    });
    store.set("missed", missed);
    touchUser();
    updateGoal();
  }

  const HINT_LABEL = {
    spell: "Spelling", wrong: "Wrong word", punct: "Punctuation / capital", miss: "Skipped word",
    extra: "Extra word", repeat: "Repeated word", name: "Check"
  };

  function renderExamResult(r) {
    $("#examLive").classList.add("hidden");
    $("#examSetup").classList.add("hidden");
    $("#examResult").classList.remove("hidden");
    $("#xWpm").textContent = r.net == null ? "—" : r.net;
    $("#xAcc").textContent = r.acc == null ? "—" : r.acc.toFixed(1) + "%";
    $("#xGross").textContent = r.gross;
    $("#xErr").textContent = r.mistakes == null ? "—" : r.mistakes;
    $("#xHeading").textContent = exam.title;
    const how = { dict: "Checked with the English dictionary", original: `Checked word by word against the paper “${exam.paper}”`, none: "Speed only" }[r.source];
    $("#xSub").textContent = `${exam.byTimer ? "Time up" : "Submitted"} after ${fmtTime(examElapsed())} · ${r.typedWords} words · ${how}`;
    const tgt = $("#xTarget");
    if (r.acc == null) { tgt.textContent = "Speed only"; tgt.className = "badge"; }
    else {
      const speedOk = r.net >= goals.wpm, accOk = r.acc >= goals.acc;
      if (speedOk && accOk) { tgt.textContent = `✔ Goal reached (${goals.wpm} WPM · ${goals.acc}%)`; tgt.className = "badge pass"; }
      else if (!accOk) { tgt.textContent = `Accuracy below ${goals.acc}%`; tgt.className = "badge fail"; }
      else { tgt.textContent = `${goals.wpm - r.net} WPM below goal`; tgt.className = "badge fail"; }
    }
    $("#xBreakdown").innerHTML = r.tiles.map(([n, l, cls]) =>
      `<div class="xb ${cls === "good" ? "good" : n ? (cls === "warn" ? "warn" : "has") : ""}"><strong>${n}</strong><span>${l}</span></div>`).join("");
    $("#xFormula").textContent = r.source === "dict"
      ? "Accuracy = words with no mistake ÷ all words typed. A word with a spelling, capital-letter or punctuation mistake, or a repeated word, counts as wrong. Names the dictionary doesn't know are only flagged for you to check. (Your text did not match a saved exam paper, so it was checked with the dictionary.)"
      : r.source === "original"
        ? "Accuracy = correct words ÷ (correct words + every mistake). Spelling, wrong words, punctuation/capitals, skipped words and extra words each count as one mistake."
        : "Accuracy could not be checked this time, so only speed is shown. Refresh the page (Ctrl+F5) and try again.";
    $("#xLegendDict").classList.toggle("hidden", r.source !== "dict");
    $("#xLegendOrig").classList.toggle("hidden", r.source !== "original");
    $("#xReview").innerHTML = r.review;

    $("#xMistakesCard").classList.toggle("hidden", !r.rows.length);
    $("#xMistakesTitle").textContent = r.source === "dict" ? "Mistakes and hints" : "Mistakes";
    $("#xMistakesSub").textContent = `${r.rows.length} item${r.rows.length === 1 ? "" : "s"}, in the order you typed them`;
    $("#xMistakes thead").innerHTML = `<tr><th>Type</th><th>You typed</th><th>${r.source === "dict" ? "Hint" : "Correct"}</th>${r.source === "dict" ? "<th></th>" : ""}</tr>`;
    $("#xMistakes tbody").innerHTML = r.rows.map((m) =>
      `<tr><td><span class="tag kind-${m.kind}">${HINT_LABEL[m.kind]}</span></td><td>${m.typed ? esc(m.typed) : "<span class=\"muted\">—</span>"}</td><td>${m.hint}</td>${r.source === "dict" ? `<td class="num">${m.addable ? `<button class="btn btn-ghost btn-sm" data-addword="${esc(m.addable)}" title="This word is correct: stop flagging it">Add to my words</button>` : ""}</td>` : ""}</tr>`).join("");
    $("#xMistakes tbody").querySelectorAll("[data-addword]").forEach((b) => b.addEventListener("click", () => {
      const w = b.dataset.addword.toLowerCase();
      const list = store.get("myWords", []);
      if (!list.includes(w)) { list.push(w); store.set("myWords", list); }
      myWords = getMyWords();
      toast(`"${b.dataset.addword}" added to your words. Re-checking…`);
      analyseByDict();
    }));
    exam.practice = [...new Set(r.practice.filter(Boolean))];
    $("#xPractice").classList.toggle("hidden", !exam.practice.length);
    // Open the results at the top so the score is the first thing you see.
    $("#xAgain").focus({ preventScroll: true });
    window.scrollTo(0, 0);
    document.querySelector(".main").scrollTop = 0;
  }

  examInput.addEventListener("input", () => { if (exam && !exam.started && !exam.done && examInput.value.length) examBegin(); });
  examInput.addEventListener("paste", (e) => { e.preventDefault(); toast("Inko copy mat karo! Paste allowed nahi hai."); });
  examInput.addEventListener("drop", (e) => e.preventDefault());
  examInput.addEventListener("copy", (e) => e.preventDefault());
  $("#examSubmit").addEventListener("click", () => {
    if (!examRunning()) return;
    if (!confirm("Submit now? The remaining time will be skipped.")) return;
    finishExam(false);
  });
  examName.addEventListener("input", () => { if (!exam || !exam.started) $("#examTitle").textContent = examTitle(); });
  examName.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); examInput.focus(); } });
  document.querySelectorAll("#examDur button").forEach((b) => b.addEventListener("click", () => {
    if (examRunning()) return;
    document.querySelectorAll("#examDur button").forEach((x) => x.classList.toggle("on", x === b));
    examSecs = +b.dataset.v;
    examReset();
  }));
  $("#xAgain").addEventListener("click", examReset);
  $("#xPractice").addEventListener("click", () => practiceWords(exam.practice || [], "Drill: My exam mistakes"));
  function stopExam() { if (exam) { clearInterval(exam.timer); exam.done = true; } }

  // ---------- text size ----------
  const typingCard = $("#typingCard");
  function applySize(sz) {
    typingCard.dataset.size = sz;
    examCard.dataset.size = sz;
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
    examCard.dataset.font = f;
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
  const pressLogo = (e) => {
    if (e.key.length !== 1 && e.key !== "Backspace") return;
    logo.classList.add("press", "typing");
    clearTimeout(pressT); clearTimeout(typingT);
    pressT = setTimeout(() => logo.classList.remove("press"), 90);
    typingT = setTimeout(() => logo.classList.remove("typing"), 1200);
  };
  input.addEventListener("keydown", pressLogo);
  examInput.addEventListener("keydown", pressLogo);
  // Tab title shows live speed while a test runs, and the final score after.
  setInterval(() => {
    if (!session || !session.started) { document.title = BASE_TITLE; return; }
    const { net } = liveNumbers();
    document.title = session.finished ? `✔ ${net} WPM · ${BASE_TITLE}` : `${net} WPM · ${BASE_TITLE}`;
  }, 1000);

  // =====================================================================
  // Sign-in: profiles + PIN, no backend. Everything lives in this browser.
  // PINs are stored only as salted SHA-256 hashes. This keeps profiles
  // private from each other on a shared device; it is not server-grade
  // security (anyone with dev tools on this device can read raw storage).
  // =====================================================================
  let currentUser = null;
  const SESSION_KEY = "td_session";
  const getUsers = () => { try { return JSON.parse(localStorage.getItem("users") || "[]"); } catch { return []; } };
  const saveUsers = (u) => { try { localStorage.setItem("users", JSON.stringify(u)); } catch { /* ignore */ } };
  const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const initials = (n) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  const hueOf = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const avatarStyle = (u) => `background:hsl(${(hueOf(u.id) % 60) + 5} 52% 46%)`; // warm hues to match the theme
  const fmtShort = (d) => (d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const validPin = (p) => /^\d{4,8}$/.test(p);

  function hexOf(buf) { return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
  async function hashPin(pin, salt) {
    const msg = `${salt}:${pin}:typingDrill`;
    if (window.crypto && crypto.subtle) {
      try { return hexOf(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg))); } catch { /* fall through */ }
    }
    // Fallback for browsers without SubtleCrypto (e.g. some file:// contexts): iterated 53-bit hash.
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let r = 0; r < 2000; r++) for (let i = 0; i < msg.length; i++) {
      const ch = msg.charCodeAt(i) + r;
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    return "f" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  const newSalt = () => {
    const a = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else a.forEach((_, i) => { a[i] = Math.random() * 256; });
    return hexOf(a);
  };

  // ---------- built-in admin (same on every device) ----------
  // Admin rights come ONLY from admin-config.js (shipped with the site), never from
  // anything stored in the browser, so nobody can create or promote an admin locally.
  const ADMIN_ID = "admin";
  const ADMIN_CFG = (() => {
    const c = window.TYPINGDRILL_ADMIN;
    const ok = c && typeof c.name === "string" && c.name.trim() && /^[0-9a-f]{16,}$/.test(c.salt || "") &&
      /^[0-9a-f]{64}$/.test(c.hash || "") && Number(c.iter) >= 100000;
    return ok ? Object.freeze({ name: c.name.trim(), salt: c.salt, hash: c.hash, iter: Number(c.iter) }) : null;
  })();
  const isAdminName = (n) => !!ADMIN_CFG && n.trim().toLowerCase() === ADMIN_CFG.name.toLowerCase();
  const adminUser = () => ({ id: ADMIN_ID, name: ADMIN_CFG ? ADMIN_CFG.name : "Admin", role: "admin" });

  // Must match tools/admin-setup.html.
  async function verifyAdmin(password) {
    if (!ADMIN_CFG || !(window.crypto && crypto.subtle)) return false;
    try {
      const salt = new Uint8Array(ADMIN_CFG.salt.match(/../g).map((h) => parseInt(h, 16)));
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ADMIN_CFG.iter }, key, 256);
      const h = hexOf(bits);
      let diff = 0; // constant-time compare
      for (let i = 0; i < 64; i++) diff |= h.charCodeAt(i) ^ ADMIN_CFG.hash.charCodeAt(i);
      return diff === 0;
    } catch { return false; }
  }

  function touchUser() {
    if (!currentUser) return;
    if (currentUser.id === ADMIN_ID) {
      try { localStorage.setItem("u:admin:lastActive", new Date().toISOString()); } catch { /* ignore */ }
      return;
    }
    const users = getUsers();
    const u = users.find((x) => x.id === currentUser.id);
    if (u) { u.lastActive = new Date().toISOString(); saveUsers(users); }
  }

  // ---------- auth screens ----------
  function showScreen(id) {
    ["#authPick", "#authCreate"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
    const first = $(id).querySelector("input");
    if (first) setTimeout(() => first.focus(), 30);
  }
  function shakeAuth(errSel, msg) {
    $(errSel).textContent = msg;
    const c = $(".auth-card");
    c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
  }

  // Private sign-in: nobody can see which profiles exist. Users type their own
  // name + PIN, and every failure gives the same message whether or not the
  // name exists, so the form can't be used to discover other people.
  function openLogin() {
    $("#authPick").reset();
    $("#loginErr").textContent = "";
    showScreen("#authPick");
  }

  // Lockout is tracked per typed name (and for unknown names too) and survives
  // a page refresh within this tab.
  const LOCK_KEY = "td_attempts";
  const getAttempts = () => { try { return JSON.parse(sessionStorage.getItem(LOCK_KEY) || "{}"); } catch { return {}; } };
  const saveAttempts = (a) => { try { sessionStorage.setItem(LOCK_KEY, JSON.stringify(a)); } catch { /* ignore */ } };

  $("#authPick").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#loginName").value.trim();
    const pin = $("#loginPin").value.trim();
    const key = name.toLowerCase();
    const all = getAttempts();
    const a = all[key] || { n: 0, until: 0 };
    if (Date.now() < a.until) {
      return shakeAuth("#loginErr", `Too many attempts. Try again in ${Math.ceil((a.until - Date.now()) / 1000)} s.`);
    }
    let signedIn = null;
    const btn = $("#authPick").querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Signing in…";
    $("#loginErr").textContent = "";
    if (isAdminName(name)) {
      // The built-in admin: checked only against admin-config.js (deliberately slow hash).
      if (await verifyAdmin(pin)) signedIn = adminUser();
    } else {
      const u = getUsers().find((x) => x.hash && x.role !== "admin" && x.name.toLowerCase() === key);
      // Always hash (even for unknown names) so success/failure takes the same time.
      const h = await hashPin(pin, u ? u.salt : "no-such-user");
      if (u && h === u.hash) signedIn = { ...u, role: "user" }; // stored data can never grant admin
    }
    btn.disabled = false;
    btn.textContent = label;
    if (signedIn) {
      delete all[key];
      saveAttempts(all);
      signIn(signedIn);
      return;
    }
    a.n++;
    if (a.n >= 5) { a.until = Date.now() + (isAdminName(name) ? 120000 : 30000); a.n = 0; }
    all[key] = a;
    saveAttempts(all);
    $("#loginPin").value = "";
    shakeAuth("#loginErr", a.until > Date.now()
      ? `Too many attempts. Locked for ${Math.ceil((a.until - Date.now()) / 1000)} seconds.`
      : "Name or PIN is incorrect.");
  });

  $("#toCreate").addEventListener("click", () => { $("#authCreate").reset(); $("#newErr").textContent = ""; showScreen("#authCreate"); });

  $("#authCreate").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#newName").value.trim(), p1 = $("#newPin").value, p2 = $("#newPin2").value;
    const users = getUsers();
    if (!name) return shakeAuth("#newErr", "Please enter a name.");
    if (isAdminName(name) || name.toLowerCase() === ADMIN_ID ||
        users.some((u) => u.name.toLowerCase() === name.toLowerCase())) return shakeAuth("#newErr", "Please choose a different name.");
    if (!validPin(p1)) return shakeAuth("#newErr", "PIN must be 4 to 8 digits.");
    if (p1 !== p2) return shakeAuth("#newErr", "PINs don't match.");
    const salt = newSalt();
    const u = { id: newId(), name, role: "user", salt, hash: await hashPin(p1, salt), created: new Date().toISOString() };
    users.push(u);
    saveUsers(users);
    signIn(u);
  });

  document.querySelectorAll("#auth [data-back]").forEach((b) => b.addEventListener("click", openLogin));

  function signIn(u) {
    currentUser = u;
    currentUserId = u.id;
    // Students stay signed in for this tab. The admin must re-enter the password after a refresh.
    try {
      if (u.role === "admin") sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, u.id);
    } catch { /* ignore */ }
    touchUser();
    goals = loadGoals();
    $("#userAvatar").textContent = initials(u.name);
    $("#userAvatar").setAttribute("style", avatarStyle(u));
    $("#userName").textContent = u.name;
    $("#userRole").textContent = u.role === "admin" ? "Admin" : "Student";
    $("#adminNav").classList.toggle("hidden", u.role !== "admin");
    $("#planNav").classList.toggle("hidden", u.role !== "admin");
    document.body.classList.remove("locked");
    updateGoal();
    setMode("stories");
  }

  $("#signOutBtn").addEventListener("click", () => {
    if (((session && session.started && !session.finished) || examUnsaved()) && !confirm("A test is running. Sign out anyway?")) return;
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    location.reload(); // clean slate: nothing from this profile stays in memory
  });

  // ---------- export / import ----------
  function readUserData(id) {
    const out = {};
    USER_KEYS.forEach((k) => { try { const v = localStorage.getItem(`u:${id}:${k}`); out[k] = v ? JSON.parse(v) : null; } catch { out[k] = null; } });
    return out;
  }
  function writeUserData(id, data) {
    USER_KEYS.forEach((k) => { if (data[k] != null) { try { localStorage.setItem(`u:${id}:${k}`, JSON.stringify(data[k])); } catch { /* ignore */ } } });
  }
  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";
  const today = () => new Date().toISOString().slice(0, 10);

  $("#exportBtn").addEventListener("click", () => {
    if (!currentUser) return;
    download(`typingDrill-${slug(currentUser.name)}-${today()}.json`, {
      app: "typingDrill", kind: "progress", version: 1, exported: new Date().toISOString(),
      user: { id: currentUser.id, name: currentUser.name }, data: readUserData(currentUser.id)
    });
    toast("Progress exported. Send the file to your admin.");
  });

  // Merge imported progress into what we already have, keeping the best of both.
  function mergeData(a, b) {
    const out = { ...a };
    const histKey = (h) => `${h.date}|${h.title}|${h.wpm}`;
    if (b.history) {
      const seen = new Map();
      [...(a.history || []), ...b.history].forEach((h) => seen.set(histKey(h), h));
      out.history = [...seen.values()].sort((x, y) => (y.date > x.date ? 1 : -1)).slice(0, 50);
    }
    if (b.missed) {
      out.missed = { ...(a.missed || {}) };
      Object.entries(b.missed).forEach(([w, c]) => { out.missed[w] = Math.max(out.missed[w] || 0, c); });
    }
    if (b.daily) {
      const ad = a.daily || { unlocked: 0, current: 0, best: {} };
      const best = { ...(ad.best || {}) };
      Object.entries(b.daily.best || {}).forEach(([k, v]) => { best[k] = Math.max(best[k] || 0, v); });
      out.daily = { unlocked: Math.max(ad.unlocked || 0, b.daily.unlocked || 0), current: b.daily.current || 0, best };
    }
    if (b.plan) {
      out.plan = { ...(a.plan || {}) };
      Object.entries(b.plan).forEach(([k, r]) => { if (!out.plan[k] || r.wpm > out.plan[k].wpm) out.plan[k] = r; });
    }
    if (b.goals) out.goals = b.goals;
    return out;
  }

  function importOne(users, rec, data) {
    // Admin progress (from the admin on another device, or an old local admin) goes to the
    // built-in admin. Imported records can never become admin.
    if (rec.id === ADMIN_ID || rec.role === "admin") {
      writeUserData(ADMIN_ID, mergeData(readUserData(ADMIN_ID), data || {}));
      return;
    }
    let u = users.find((x) => x.id === rec.id);
    if (!u) {
      u = { id: rec.id, name: rec.name, role: "user", imported: true, salt: rec.salt || null, hash: rec.hash || null, created: new Date().toISOString() };
      users.push(u);
    } else if (!u.hash && rec.hash) { u.salt = rec.salt; u.hash = rec.hash; }
    u.role = "user";
    u.lastImport = new Date().toISOString();
    writeUserData(u.id, mergeData(readUserData(u.id), data || {}));
  }

  $("#importFile").addEventListener("change", async (e) => {
    if (!currentUser || currentUser.role !== "admin") return;
    const files = [...e.target.files];
    e.target.value = "";
    const users = getUsers();
    let ok = 0, bad = 0;
    for (const f of files) {
      try {
        const j = JSON.parse(await f.text());
        if (j.app !== "typingDrill") throw new Error("not ours");
        if (j.kind === "progress" && j.user && j.user.id) { importOne(users, j.user, j.data); ok++; }
        else if (j.kind === "backup" && Array.isArray(j.users)) { j.users.forEach((u) => importOne(users, u, (j.data || {})[u.id])); ok++; }
        else throw new Error("unknown");
      } catch { bad++; }
    }
    saveUsers(users);
    renderAdmin();
    toast(`${ok} file${ok === 1 ? "" : "s"} imported${bad ? `, ${bad} skipped (not a typingDrill file)` : ""}.`);
  });

  $("#backupBtn").addEventListener("click", () => {
    if (!currentUser || currentUser.role !== "admin") return;
    const users = [{ id: ADMIN_ID, name: adminUser().name, role: "admin" }, ...getUsers().filter((u) => u.role !== "admin")];
    const data = {};
    users.forEach((u) => { data[u.id] = readUserData(u.id); });
    download(`typingDrill-backup-${today()}.json`, { app: "typingDrill", kind: "backup", version: 2, exported: new Date().toISOString(), users, data });
    toast("Backup downloaded. Keep it somewhere safe.");
  });

  // ---------- admin dashboard ----------
  let adminSel = null;
  function userSummary(u) {
    const d = readUserData(u.id);
    const hist = d.history || [];
    const n = hist.length;
    const planDone = PLAN.reduce((s, day) => s + day.tasks.filter((t) => d.plan && d.plan[t.id]).length, 0);
    const last = [u.lastActive, hist[0] && hist[0].date].filter(Boolean).sort().pop();
    return {
      d, n,
      best: hist.reduce((m, h) => Math.max(m, h.wpm), 0),
      avg: n ? Math.round(hist.reduce((s, h) => s + h.wpm, 0) / n) : 0,
      acc: n ? (hist.reduce((s, h) => s + h.acc, 0) / n).toFixed(1) : null,
      plan: Math.round((planDone / (PLAN.length * 3)) * 100),
      last
    };
  }

  function renderAdmin() {
    if (!currentUser || currentUser.role !== "admin") return;
    let adminLast = null;
    try { adminLast = localStorage.getItem("u:admin:lastActive"); } catch { /* ignore */ }
    const users = [
      { ...adminUser(), lastActive: adminLast },
      ...getUsers().filter((u) => u.role !== "admin").sort((a, b) => a.name.localeCompare(b.name))
    ];
    const sums = users.map((u) => ({ u, s: userSummary(u) }));
    const weekAgo = Date.now() - 7 * 864e5;
    $("#aUsers").textContent = users.length;
    $("#aTop").textContent = sums.reduce((m, x) => Math.max(m, x.s.best), 0);
    $("#aTests").textContent = sums.reduce((m, x) => m + x.s.n, 0);
    $("#aActive").textContent = sums.filter((x) => x.s.last && new Date(x.s.last).getTime() > weekAgo).length;

    $("#adminTable tbody").innerHTML = sums.map(({ u, s }) => `
      <tr data-uid="${u.id}" class="${u.id === adminSel ? "sel" : ""}">
        <td><div class="who-cell"><span class="avatar" style="${avatarStyle(u)}">${esc(initials(u.name))}</span>
          <strong>${esc(u.name)}</strong>
          ${u.role === "admin" ? `<span class="tag admin">Admin</span>` : u.imported ? `<span class="tag">Imported</span>` : `<span class="tag">This device</span>`}
        </div></td>
        <td class="num">${s.n}</td>
        <td class="num strong">${s.best || "—"}</td>
        <td class="num">${s.avg || "—"}</td>
        <td class="num">${s.acc != null ? s.acc + "%" : "—"}</td>
        <td class="num">${s.plan}%</td>
        <td>${fmtShort(s.last)}</td>
      </tr>`).join("");
    $("#adminTable tbody").querySelectorAll("tr").forEach((tr) =>
      tr.addEventListener("click", () => { adminSel = tr.dataset.uid; renderAdmin(); }));

    const pick = sums.find((x) => x.u.id === adminSel);
    $("#adminDetail").classList.toggle("hidden", !pick);
    if (!pick) return;
    const { u, s } = pick;
    $("#adRole").textContent = u.role === "admin" ? "Admin" : u.imported ? "Imported profile" : "Student on this device";
    $("#adName").textContent = u.name;
    $("#adSub").textContent = `Best ${s.best} WPM · average ${s.avg} WPM · plan ${s.plan}% · last active ${fmtShort(s.last)}`;
    // The built-in admin is fixed: it can't be deleted or have its password changed here.
    $("#adDelete").disabled = u.id === ADMIN_ID;
    $("#adResetPin").disabled = u.id === ADMIN_ID;
    $("#adResetPin").title = u.id === ADMIN_ID ? "The admin password is set in admin-config.js" : "";
    const hist = s.d.history || [];
    renderChart(hist.slice().reverse(), fmtShort, "#adChart", null, (s.d.goals && s.d.goals.wpm) || DEFAULT_GOALS.wpm);
    const top = Object.entries(s.d.missed || {}).sort((a, b) => b[1] - a[1]).slice(0, 15);
    $("#adHard").innerHTML = top.length ? top.map(([w, c]) => `<span class="chip">${esc(w)}<b>×${c}</b></span>`).join("") : `<span class="muted">No mistakes recorded.</span>`;
    $("#adHistory tbody").innerHTML = hist.length
      ? hist.map((h) => `<tr><td>${fmtShort(h.date)}</td><td>${esc(h.title)}</td><td class="num strong">${h.wpm}</td><td class="num">${h.acc}%</td></tr>`).join("")
      : `<tr><td colspan="4" class="muted">No results yet.</td></tr>`;
  }

  $("#adDelete").addEventListener("click", () => {
    const users = getUsers();
    const u = users.find((x) => x.id === adminSel);
    if (!u || u.id === ADMIN_ID) return;
    if (!confirm(`Delete "${u.name}" and all of their progress from this device? This cannot be undone.`)) return;
    USER_KEYS.forEach((k) => { try { localStorage.removeItem(`u:${u.id}:${k}`); } catch { /* ignore */ } });
    saveUsers(users.filter((x) => x.id !== u.id));
    adminSel = null;
    renderAdmin();
    toast("Profile deleted.");
  });

  $("#adResetPin").addEventListener("click", async () => {
    const users = getUsers();
    const u = users.find((x) => x.id === adminSel);
    if (!u || u.id === ADMIN_ID) return;
    const p1 = prompt(`New PIN for ${u.name} (4 to 8 digits):`);
    if (p1 == null) return;
    if (!validPin(p1)) { toast("PIN must be 4 to 8 digits."); return; }
    if (prompt("Type the new PIN again:") !== p1) { toast("PINs didn't match. Nothing changed."); return; }
    u.salt = newSalt();
    u.hash = await hashPin(p1, u.salt);
    saveUsers(users);
    renderAdmin();
    toast(`PIN updated for ${u.name}.${u.imported ? " They can now sign in on this device." : ""}`);
  });

  window.addEventListener("resize", () => { if (mode === "admin") renderAdmin(); });

  // ---------- boot ----------
  // One-time migration to the built-in admin:
  //  - progress saved before sign-in existed (un-prefixed keys)
  //  - any admin created locally by older versions (e.g. "hamidi")
  // is moved into the built-in admin's profile, and local admin records are removed.
  function migrateToBuiltInAdmin() {
    const has = (k) => { try { return localStorage.getItem(`u:${ADMIN_ID}:${k}`) != null; } catch { return true; } };
    const move = (from, k) => {
      try {
        const v = localStorage.getItem(from);
        if (v == null) return;
        if (!has(k)) localStorage.setItem(`u:${ADMIN_ID}:${k}`, v);
        localStorage.removeItem(from);
      } catch { /* ignore */ }
    };
    USER_KEYS.forEach((k) => move(k, k));
    // Old local admins, and any local profile using the built-in admin's name (it could no
    // longer sign in), are merged into the admin so no progress is lost.
    const users = getUsers();
    const absorb = users.filter((u) => u.role === "admin" || isAdminName(u.name));
    if (absorb.length) {
      absorb.forEach((u) => {
        writeUserData(ADMIN_ID, mergeData(readUserData(ADMIN_ID), readUserData(u.id)));
        USER_KEYS.forEach((k) => { try { localStorage.removeItem(`u:${u.id}:${k}`); } catch { /* ignore */ } });
      });
      saveUsers(users.filter((u) => !absorb.includes(u)));
    }
  }

  (function boot() {
    migrateToBuiltInAdmin();
    if (!ADMIN_CFG) console.info("typingDrill: no admin configured yet. Open tools/admin-setup.html to create admin-config.js.");
    let sid = null;
    try { sid = sessionStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
    // Only student sessions are restored; the admin always signs in again.
    const u = sid && sid !== ADMIN_ID ? getUsers().find((x) => x.id === sid && x.hash && x.role !== "admin") : null;
    if (u) { signIn({ ...u, role: "user" }); return; } // same tab, still signed in
    openLogin();
  })();
})();
