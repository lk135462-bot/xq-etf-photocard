const BUILD = "0612e";
const slideKeys = ["cover", "basic", "holdings", "perfRisk", "cta"];

const state = { index: 0, data: null, mode: "etf", count: 5 };

const deckTitleEl = document.getElementById("deckTitle");
const progressEl = document.getElementById("progress");
const cardEl = document.getElementById("card");
const cardHeaderEl = document.getElementById("cardHeader");
const cardBodyEl = document.getElementById("cardBody");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// 缺值判斷：空字串 / null / "--" / "—" 視為缺
function has(v) {
  if (v === 0) return true;
  if (v == null) return false;
  const s = String(v).trim();
  return s !== "" && s !== "--" && s !== "—";
}
function show(v, fallback = "—") { return has(v) ? esc(v) : fallback; }

function getIdFromUrl() {
  const p = new URLSearchParams(location.search);
  // 保留原始大小寫（檔名 ticker 為大寫如 00981A、功能型為小寫如 etf-tool）
  const raw = (p.get("id") || "00981A").trim();
  return raw.replace(/[^A-Za-z0-9_-]/g, "") || "00981A";
}

async function loadData(id) {
  const res = await fetch(`data/${encodeURIComponent(id)}.json`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`資料載入失敗（${res.status}）`);
  return res.json();
}

// 埋點：推到 dataLayer，GTM / GA4 可直接接
function track(event, props = {}) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, deck_id: state.data?.id, ...props });
  } catch (e) { /* no-op */ }
}

// 把進站網址的 utm_* / 點擊 ID 透傳到 CTA 連結，維持歸因鏈
function buildCtaUrl() {
  try {
    const url = new URL(state.data.ctaUrl, location.href);
    const incoming = new URLSearchParams(location.search);
    incoming.forEach((v, k) => {
      if (/^utm_/i.test(k) || k === "gclid" || k === "fbclid" || k === "yclid") {
        url.searchParams.set(k, v);
      }
    });
    return url.toString();
  } catch (e) {
    return state.data.ctaUrl;
  }
}

function renderProgress() {
  progressEl.innerHTML = Array.from({ length: state.count })
    .map((_, i) => `<span class="progress-segment ${i === state.index ? "active" : ""}"></span>`)
    .join("");
}

/* ---------- 卡1 封面 ---------- */
function renderCover() {
  const c = state.data.cover;
  const dir = c.up ? "up" : "down";
  // 把鉤子數字（近一年報酬）拉到封面當誘因
  const y1 = state.data.perfRisk?.return?.y1;
  const teaser = has(y1) ? `
      <div class="cover-teaser">
        <span class="t-label">近一年報酬</span>
        <span class="t-value ${dirOf(y1)}">${esc(y1)}</span>
      </div>` : "";
  return `
    <section class="cover">
      <span class="cover-tag">${show(state.data.categoryLabel, "ETF")}</span>
      <div>
        <div class="cover-id">${esc(state.data.id)}</div>
        <h2 class="cover-name">${esc(c.name)}</h2>
        <p class="cover-pitch">${show(c.indexOrPitch, "")}</p>
      </div>
      ${teaser}
      <div class="cover-price-box">
        <div class="cover-price ${dir}">${show(c.price)}</div>
        <div class="cover-change ${dir}">${show(c.change)}　${show(c.changePct)}</div>
        <div class="cover-asof">資料日期 ${show(c.asOf)}</div>
      </div>
    </section>`;
}

/* ---------- 卡2 這檔是什麼 ---------- */
function renderBasic() {
  const b = state.data.basic;
  return `
    <div class="grid g2">
      <div class="cell"><div class="cell-label">成立年資</div><div class="cell-value">${show(b.ageYears)}</div></div>
      <div class="cell"><div class="cell-label">管理費（內扣）</div><div class="cell-value">${show(b.expenseRatio)}</div></div>
      <div class="cell"><div class="cell-label">規模</div><div class="cell-value sm">${show(b.aum)}</div></div>
      <div class="cell"><div class="cell-label">近一年配息</div><div class="cell-value sm">${show(b.dividendTTM, "尚未配息")}</div></div>
    </div>
    <p class="kv-inline">配息頻率：<b>${show(b.dividendFreq, "—")}</b></p>
    <p class="para">${show(b.strategyNote, "")}</p>`;
}

/* ---------- 卡3 成分與配息 ---------- */
function renderHoldings() {
  const h = state.data.holdings;
  const sectors = Array.isArray(h.sectors) ? h.sectors.filter((s) => has(s.name)) : [];
  const top = Array.isArray(h.top) ? h.top.filter((t) => has(t)) : [];

  const yieldBlock = `
    <div class="yield-hero">
      <div class="v">${show(h.yield, "—")}</div>
      <div class="l">殖利率（近一年配息 ${show(state.data.basic?.dividendTTM, "—")}）</div>
    </div>`;

  const sectorBlock = sectors.length
    ? `<p class="block-title">產業分布</p>` + sectors.map((s) => `
        <div class="bar-row">
          <span class="bar-name">${esc(s.name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${Number(s.ratio) || 0}%"></span></span>
          <span class="bar-val">${has(s.ratio) && Number(s.ratio) > 0 ? Number(s.ratio) + "%" : "—"}</span>
        </div>`).join("")
    : "";

  const topBlock = top.length
    ? `<p class="block-title" style="margin-top:12px">前十大成分股</p>
       <div class="chips">${top.map((t) => `<span class="chip">${esc(t.name || t)}</span>`).join("")}</div>`
    : "";

  return yieldBlock + sectorBlock + topBlock +
    `<p class="disclaimer">${show(h.note, "成分以最新公告為準，實際持股請於 XQ 內查看")}</p>`;
}

/* ---------- 卡4 報酬與風險 ---------- */
function renderPerfRisk() {
  const p = state.data.perfRisk;
  const r = p.return || {};
  const rk = p.risk || {};
  const bm = p.benchmark || {};

  const retGrid = `
    <p class="block-title">報酬表現</p>
    <div class="grid g2">
      <div class="cell"><div class="cell-label">1 月</div><div class="cell-value ${dirOf(r.m1)}">${show(r.m1)}</div></div>
      <div class="cell"><div class="cell-label">3 月</div><div class="cell-value ${dirOf(r.m3)}">${show(r.m3)}</div></div>
      <div class="cell"><div class="cell-label">1 年</div><div class="cell-value ${dirOf(r.y1)}">${show(r.y1)}</div></div>
      <div class="cell"><div class="cell-label">YTD</div><div class="cell-value ${dirOf(r.ytd)}">${show(r.ytd)}</div></div>
    </div>`;

  const riskAvailable = has(rk.std) || has(rk.sharpe) || has(rk.beta);
  const riskGrid = riskAvailable ? `
    <p class="block-title">風險指標</p>
    <div class="grid g3">
      <div class="cell"><div class="cell-label">標準差</div><div class="cell-value">${show(rk.std)}</div><div class="cell-sub">波動幅度</div></div>
      <div class="cell"><div class="cell-label">Sharpe</div><div class="cell-value">${show(rk.sharpe)}</div><div class="cell-sub">風險調整報酬</div></div>
      <div class="cell"><div class="cell-label">Beta</div><div class="cell-value">${show(rk.beta)}</div><div class="cell-sub">對大盤敏感度</div></div>
    </div>` : `
    <p class="block-title">風險指標</p>
    <div class="missing">成立未滿一年，風險指標（標準差／Sharpe／Beta）資料量不足，待累積。</div>`;

  const benchBlock = (has(bm.std) || has(bm.sharpe) || has(bm.beta)) ? `
    <div class="bench-row">
      <span>對照 <b>${show(bm.id)} ${show(bm.name, "")}</b></span>
      <span>標準差 <b>${show(bm.std)}</b>｜Sharpe <b>${show(bm.sharpe)}</b>｜Beta <b>${show(bm.beta)}</b></span>
    </div>` : "";

  const takeaway = has(p.takeaway) ? `<div class="note-box">${esc(p.takeaway)}</div>` : "";

  const term = `<p class="term">標準差＝上下震盪幅度（越大越會跳）｜Sharpe＝每承擔 1 單位風險換到多少報酬（越高越好）｜Beta＝大盤漲跌 1%，它大約跟著動多少。</p>`;

  return retGrid + riskGrid + benchBlock + takeaway + term;
}

function dirOf(v) {
  if (!has(v)) return "";
  const s = String(v);
  if (s.includes("-")) return "down";
  if (s.includes("+")) return "up";
  return "";
}

/* ---------- 卡5 CTA ---------- */
function renderCta() {
  const c = state.data.cta;
  const steps = (c.steps || []).map((s, i) => `
    <div class="step">
      <span class="step-no">${i + 1}</span>
      <div><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></div>
    </div>`).join("");
  return `
    <div class="steps">${steps}</div>
    <div class="brand-box">
      <h3>${esc(c.brandBox?.title || "XQ 全球贏家")}</h3>
      <p>${esc(c.brandBox?.desc || "")}</p>
    </div>`;
}

const HEADERS = {
  cover: { bg: "#6f63d6", text: (d) => `台股 ETF 圖卡 ・ ${d.id}` },
  basic: { bg: "#2f7f9f", text: () => "這檔 ETF 是什麼" },
  holdings: { bg: "#16a06f", text: () => "成分與配息" },
  perfRisk: { bg: "#5b4db2", text: () => "報酬與風險" },
  cta: { bg: "#14532d", text: (d) => d.cta?.header || "3 步驟，用 XQ 追蹤 ETF" },
};

/* ===================== 功能型 deck（deckMode: feature）===================== */
const FEATURE_COLORS = ["#6f63d6", "#2f7f9f", "#16a06f", "#5b4db2", "#14532d"];

// 模擬 XQ 真實 UI 的小預覽（可互動：tab 列 / 篩選 chip / 監控列）
function renderQuoteRows(rows) {
  return (rows || []).map((s) =>
    `<div class="ui-q-row"><span>${esc(s.k)}</span><b class="${s.dir || ""}">${esc(s.v)}</b></div>`).join("");
}

function renderFeatureVisual(v) {
  if (!v || !v.type) return "";
  if (v.type === "tabs") {
    const active = v.active || 0;
    const rows = Array.isArray(v.rows) ? (v.rows[active] || []) : (v.sample || []);
    return `<div class="ui-mock interactive" data-mock="tabs">
      <div class="ui-tabs">${(v.items || []).map((t, i) =>
        `<span class="ui-tab ${i === active ? "on" : ""}" data-i="${i}">${esc(t)}</span>`).join("")}</div>
      ${has(v.caption) ? `<div class="ui-cap">${esc(v.caption)}</div>` : ""}
      <div class="ui-quote">${renderQuoteRows(rows)}</div>
      <div class="ui-hint">點分頁切換 →</div>
    </div>`;
  }
  if (v.type === "pills") {
    const active = v.active || 0;
    return `<div class="ui-mock interactive" data-mock="pills">
      <div class="ui-pills">${(v.items || []).map((t, i) =>
        `<span class="ui-pill ${i === active ? "on" : ""}" data-i="${i}">${esc(t)}</span>`).join("")}</div>
      <div class="ui-hint">點分類試試 →</div>
    </div>`;
  }
  if (v.type === "rows") {
    return `<div class="ui-mock ui-rows">${(v.items || []).map((r) =>
      `<div class="ui-row"><span>${esc(r.k)}</span><b>${esc(r.v)}</b></div>`).join("")}</div>`;
  }
  return "";
}

function renderFeatureCover(c) {
  const hero = c.hero || {};
  const heroBlock = (has(hero.big) || has(hero.label)) ? `
      <div class="feat-stat">
        <div class="fs-row">
          ${has(hero.big) ? `<span class="fs-num">${esc(hero.big)}</span>` : ""}
          ${has(hero.unit) ? `<span class="fs-unit">${esc(hero.unit)}</span>` : ""}
          ${has(hero.label) ? `<span class="fs-label">${esc(hero.label)}</span>` : ""}
        </div>
        ${has(hero.sub) ? `<div class="fs-sub">${esc(hero.sub)}</div>` : ""}
      </div>` : "";
  return `
    <section class="cover">
      ${has(c.tag) ? `<span class="cover-tag">${esc(c.tag)}</span>` : ""}
      <div>
        <h2 class="cover-name">${esc(c.title)}</h2>
        <p class="cover-pitch">${show(c.pitch, "")}</p>
      </div>
      ${heroBlock}
      ${renderFeatureVisual(c.visual)}
    </section>`;
}

function renderFeatureCard2(c) {
  const bullets = (c.bullets || []).map((b) => {
    if (typeof b === "string") return `<li><span class="b-k">${esc(b)}</span></li>`;
    return `<li>
      <span class="b-k">${esc(b.k)}</span>
      ${has(b.v) ? `<span class="b-v">${esc(b.v)}</span>` : ""}
    </li>`;
  }).join("");
  return `
    ${has(c.icon) ? `<div class="feat-icon">${esc(c.icon)}</div>` : ""}
    ${has(c.subtitle) ? `<p class="feat-sub">${esc(c.subtitle)}</p>` : ""}
    ${renderFeatureVisual(c.visual)}
    <ul class="bullets">${bullets}</ul>
    ${has(c.highlight) ? `<div class="highlight">${esc(c.highlight)}</div>` : ""}`;
}

function renderFeatureCta(c) {
  const steps = (c.steps || []).map((s, i) => `
    <div class="step">
      <span class="step-no">${i + 1}</span>
      <div><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></div>
    </div>`).join("");
  return `
    <div class="steps">${steps}</div>
    <div class="brand-box">
      <h3>${esc(c.brandBox?.title || "XQ 全球贏家")}</h3>
      <p>${esc(c.brandBox?.desc || "")}</p>
    </div>`;
}

function renderFeatureBody(card) {
  if (card.key === "cover") return renderFeatureCover(card);
  if (card.key === "cta") return renderFeatureCta(card);
  return renderFeatureCard2(card);
}
/* ========================================================================= */

function renderCard() {
  cardEl.setAttribute("aria-label", `第 ${state.index + 1} 張，共 ${state.count} 張`);

  if (state.mode === "feature") {
    const card = state.data.cards[state.index];
    state.currentVisual = card.visual || null;
    cardHeaderEl.style.background = card.color || FEATURE_COLORS[state.index % FEATURE_COLORS.length];
    cardHeaderEl.textContent = card.header || "";
    cardBodyEl.innerHTML = renderFeatureBody(card);
    cardBodyEl.scrollTop = 0;
    return;
  }
  state.currentVisual = null;

  const key = slideKeys[state.index];
  const head = HEADERS[key];
  cardHeaderEl.style.background = head.bg;
  cardHeaderEl.textContent = head.text(state.data);

  const renderers = {
    cover: renderCover, basic: renderBasic, holdings: renderHoldings,
    perfRisk: renderPerfRisk, cta: renderCta,
  };
  cardBodyEl.innerHTML = renderers[key]();
  cardBodyEl.scrollTop = 0;
}

function renderControls() {
  const isFirst = state.index === 0;
  const isLast = state.index === state.count - 1;
  prevBtn.hidden = isFirst;
  nextBtn.textContent = isLast ? "開啟 XQ 全球贏家" : "下一張";
  nextBtn.classList.toggle("btn-cta-green", isLast);
  nextBtn.classList.toggle("btn-primary", !isLast);
  // 首卡讓「下一張」脈動，暗示可往下看
  nextBtn.classList.toggle("pulse", isFirst);
  nextBtn.closest(".controls").classList.toggle("single-next", isFirst);
}

function render() {
  renderProgress();
  renderCard();
  renderControls();
  // 重新觸發切換動畫
  cardBodyEl.classList.remove("swap");
  void cardBodyEl.offsetWidth;
  cardBodyEl.classList.add("swap");
  track("card_view", { card_index: state.index, card_count: state.count });
}

function openCta() {
  track("cta_click", { card_index: state.index });
  window.open(buildCtaUrl(), "_blank", "noopener,noreferrer");
}

function renderError(msg) {
  progressEl.innerHTML = "";
  cardHeaderEl.style.background = "#b24f3d";
  cardHeaderEl.textContent = "載入錯誤";
  cardBodyEl.innerHTML = `<p class="para">${esc(msg)}</p>`;
  prevBtn.hidden = true;
  nextBtn.hidden = true;
}

prevBtn.addEventListener("click", () => {
  if (!state.data) return;
  state.index = Math.max(0, state.index - 1);
  render();
});
nextBtn.addEventListener("click", () => {
  if (!state.data) return;
  if (state.index === state.count - 1) { openCta(); return; }
  state.index += 1;
  render();
});

// 互動式 UI 預覽：點分頁換數據、點 chip 換高亮
cardBodyEl.addEventListener("click", (e) => {
  const tab = e.target.closest(".ui-tab");
  if (tab) {
    const v = state.currentVisual;
    if (!v || v.type !== "tabs") return;
    const i = Number(tab.dataset.i);
    const mock = tab.closest(".ui-mock");
    mock.querySelectorAll(".ui-tab").forEach((el, idx) => el.classList.toggle("on", idx === i));
    const rows = Array.isArray(v.rows) ? (v.rows[i] || []) : (v.sample || []);
    const q = mock.querySelector(".ui-quote");
    if (q) q.innerHTML = renderQuoteRows(rows);
    track("demo_tab", { tab_index: i });
    return;
  }
  const pill = e.target.closest(".ui-pill");
  if (pill) {
    const mock = pill.closest(".ui-mock");
    mock.querySelectorAll(".ui-pill").forEach((el) => el.classList.remove("on"));
    pill.classList.add("on");
    track("demo_pill", { pill: pill.textContent });
  }
});

// 觸控左右滑動
let touchX = null;
cardEl.addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
cardEl.addEventListener("touchend", (e) => {
  if (touchX == null || !state.data) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) < 50) return;
  if (dx < 0 && state.index < state.count - 1) { state.index++; render(); }
  if (dx > 0 && state.index > 0) { state.index--; render(); }
  touchX = null;
}, { passive: true });

async function init() {
  const id = getIdFromUrl();
  try {
    const data = await loadData(id);
    state.data = data;
    state.index = 0;
    if (data.deckMode === "feature") {
      state.mode = "feature";
      state.count = (data.cards || []).length;
      deckTitleEl.textContent = data.title || "XQ 功能介紹";
    } else {
      state.mode = "etf";
      state.count = slideKeys.length;
      deckTitleEl.textContent = `${data.id} ${data.cover?.name || ""} ｜ ETF 圖卡`;
    }
    deckTitleEl.textContent += `　·　build ${BUILD}`;
    render();
  } catch (e) {
    renderError(e instanceof Error ? e.message : "未知錯誤");
  }
}

init();
