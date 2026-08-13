(() => {
  "use strict";

  const STORAGE_KEY = "assembly-vote-sim-local-v1";
  const THEME_KEY = "assembly-ui-theme";
  const LEGAL_SEATS = 300;
  const AS_OF = "2026. 7. 16.";

  const KINDS = [
    {
      id: "ordinary",
      name: "일반 법률안·의안",
      shortName: "일반 의결",
      basis: "헌법 제49조",
      summary: "재적의원 과반수 출석, 출석의원 과반수 찬성. 가부동수는 부결.",
      attendance: "majority_registered",
      approval: "majority_present",
    },
    {
      id: "fasttrack",
      name: "패스트트랙 지정",
      shortName: "패스트트랙",
      basis: "국회법 제85조의2",
      summary: "재적의원 5분의 3 이상의 찬성으로 신속처리안건 지정.",
      attendance: "none",
      approval: "three_fifths_registered",
    },
    {
      id: "filibuster",
      name: "필리버스터 종결",
      shortName: "필리 종결",
      basis: "국회법 제106조의2",
      summary: "재적의원 5분의 3 이상의 찬성으로 무제한 토론 종결.",
      attendance: "none",
      approval: "three_fifths_registered",
    },
    {
      id: "reconsider",
      name: "법률안 재의 (거부권)",
      shortName: "재의결",
      basis: "헌법 제53조 제4항",
      summary: "재적의원 과반수 출석, 출석의원 3분의 2 이상의 찬성.",
      attendance: "majority_registered",
      approval: "two_thirds_present",
    },
    {
      id: "amendment",
      name: "헌법개정안",
      shortName: "개헌",
      basis: "헌법 제130조",
      summary: "재적의원 3분의 2 이상의 찬성.",
      attendance: "none",
      approval: "two_thirds_registered",
    },
    {
      id: "impeach_president",
      name: "대통령 탄핵소추",
      shortName: "탄핵",
      basis: "헌법 제65조",
      summary: "재적의원 3분의 2 이상의 찬성.",
      attendance: "none",
      approval: "two_thirds_registered",
    },
    {
      id: "dismiss_pm",
      name: "국무총리 해임건의",
      shortName: "해임건의",
      basis: "헌법 제63조",
      summary: "재적의원 과반수의 찬성.",
      attendance: "none",
      approval: "majority_registered",
    },
  ];

  const DEFAULT_PARTIES = [
    { id: "dp", name: "더불어민주당", shortName: "민주", seats: 161, color: "#1b4a9b", aye: 0, nay: 0, abstain: 0, negotiable: true },
    { id: "ppp", name: "국민의힘", shortName: "국힘", seats: 109, color: "#c43b3b", aye: 0, nay: 0, abstain: 0, negotiable: true },
    { id: "rkp", name: "조국혁신당", shortName: "조국", seats: 12, color: "#1a3358", aye: 0, nay: 0, abstain: 0, negotiable: false },
    { id: "jp", name: "진보당", shortName: "진보", seats: 4, color: "#9b2c2c", aye: 0, nay: 0, abstain: 0, negotiable: false },
    { id: "reform", name: "개혁신당", shortName: "개혁", seats: 3, color: "#b86a2d", aye: 0, nay: 0, abstain: 0, negotiable: false },
    { id: "bip", name: "기본소득당", shortName: "기본소득", seats: 1, color: "#2a7a72", aye: 0, nay: 0, abstain: 0, negotiable: false },
    { id: "sdp", name: "사회민주당", shortName: "사회민주", seats: 1, color: "#8a4a2a", aye: 0, nay: 0, abstain: 0, negotiable: false },
    { id: "ind", name: "무소속", shortName: "무소속", seats: 8, color: "#6a6e76", aye: 0, nay: 0, abstain: 0, negotiable: false },
  ];

  const DEMOCRATIC_BLOC = new Set(["dp", "rkp", "jp", "bip", "sdp"]);
  const PPP = new Set(["ppp"]);

  const PRESETS = [
    { id: "clear", label: "전원 불참" },
    { id: "all-present-undecided", label: "전원 출석" },
    { id: "bloc-split", label: "민주당계 찬성 · 국힘 반대" },
    { id: "ppp-walkout", label: "국민의힘 퇴장" },
    { id: "dp-alone", label: "민주당 단독" },
  ];

  function cloneDefaults() {
    return DEFAULT_PARTIES.map((p) => ({ ...p }));
  }

  function majority(n) {
    return n <= 0 ? 0 : Math.floor(n / 2) + 1;
  }
  function threeFifths(n) {
    return n <= 0 ? 0 : Math.ceil((n * 3) / 5);
  }
  function twoThirds(n) {
    return n <= 0 ? 0 : Math.ceil((n * 2) / 3);
  }
  function oneFifth(n) {
    return n <= 0 ? 0 : Math.ceil(n / 5);
  }
  function presentOf(p) {
    return p.aye + p.nay + p.abstain;
  }
  function absentOf(p) {
    return Math.max(0, p.seats - presentOf(p));
  }

  function normalizeParty(party) {
    let seats = Math.max(0, Math.floor(Number(party.seats) || 0));
    let aye = Math.max(0, Math.floor(Number(party.aye) || 0));
    let nay = Math.max(0, Math.floor(Number(party.nay) || 0));
    let abstain = Math.max(0, Math.floor(Number(party.abstain) || 0));
    let total = aye + nay + abstain;
    if (total > seats) {
      const scale = seats / total;
      aye = Math.floor(aye * scale);
      nay = Math.floor(nay * scale);
      abstain = Math.floor(abstain * scale);
      let left = seats - (aye + nay + abstain);
      while (left > 0) {
        if (party.aye >= party.nay && party.aye >= party.abstain) aye += 1;
        else if (party.nay >= party.abstain) nay += 1;
        else abstain += 1;
        left -= 1;
      }
    }
    const name = String(party.name || "정당").slice(0, 40);
    return {
      id: String(party.id || `custom-${Date.now()}`),
      name,
      shortName: String(party.shortName || name).slice(0, 6),
      seats,
      color: party.color || "#5c6370",
      aye,
      nay,
      abstain,
      negotiable: !!party.negotiable,
    };
  }

  function setField(party, field, value) {
    if (field === "seats") {
      const seats = Math.max(0, Math.min(LEGAL_SEATS, Math.floor(Number(value) || 0)));
      return normalizeParty({ ...party, seats });
    }
    if (field === "name") {
      const name = String(value || "").slice(0, 40) || "정당";
      return { ...party, name, shortName: name.slice(0, 6) };
    }
    const next = Math.max(0, Math.floor(Number(value) || 0));
    const other =
      (field === "aye" ? 0 : party.aye) +
      (field === "nay" ? 0 : party.nay) +
      (field === "abstain" ? 0 : party.abstain);
    const max = Math.max(0, party.seats - other);
    return { ...party, [field]: Math.min(next, max) };
  }

  function fillOne(party, mode) {
    if (mode === "absent") return { ...party, aye: 0, nay: 0, abstain: 0 };
    return {
      ...party,
      aye: mode === "aye" ? party.seats : 0,
      nay: mode === "nay" ? party.seats : 0,
      abstain: mode === "abstain" ? party.seats : 0,
    };
  }

  function applyPreset(parties, presetId) {
    return parties.map((p) => {
      if (presetId === "clear") return fillOne(p, "absent");
      if (presetId === "all-present-undecided") return fillOne(p, "abstain");
      if (presetId === "bloc-split") {
        if (DEMOCRATIC_BLOC.has(p.id)) return fillOne(p, "aye");
        if (PPP.has(p.id)) return fillOne(p, "nay");
        return fillOne(p, "abstain");
      }
      if (presetId === "ppp-walkout") {
        if (p.id === "ppp") return fillOne(p, "absent");
        if (DEMOCRATIC_BLOC.has(p.id)) return fillOne(p, "aye");
        return fillOne(p, "abstain");
      }
      if (presetId === "dp-alone") {
        if (p.id === "dp") return fillOne(p, "aye");
        return fillOne(p, "absent");
      }
      return p;
    });
  }

  function totals(parties) {
    const registered = parties.reduce((s, p) => s + p.seats, 0);
    const aye = parties.reduce((s, p) => s + p.aye, 0);
    const nay = parties.reduce((s, p) => s + p.nay, 0);
    const abstain = parties.reduce((s, p) => s + p.abstain, 0);
    const present = aye + nay + abstain;
    return {
      registered,
      aye,
      nay,
      abstain,
      present,
      absent: Math.max(0, registered - present),
      vacancy: Math.max(0, LEGAL_SEATS - registered),
    };
  }

  function approvalNeed(spec, registered, present) {
    switch (spec.approval) {
      case "majority_present":
        return majority(present);
      case "two_thirds_present":
        return twoThirds(present);
      case "three_fifths_registered":
        return threeFifths(registered);
      case "two_thirds_registered":
        return twoThirds(registered);
      case "majority_registered":
        return majority(registered);
      default:
        return 0;
    }
  }

  function attendanceNeed(spec, registered) {
    return spec.attendance === "majority_registered" ? majority(registered) : null;
  }

  function approvalLabel(spec, registered, present) {
    switch (spec.approval) {
      case "majority_present":
        return `출석 과반 (${majority(present)}표)`;
      case "two_thirds_present":
        return `출석 2/3 (${twoThirds(present)}표)`;
      case "three_fifths_registered":
        return `재적 3/5 (${threeFifths(registered)}표)`;
      case "two_thirds_registered":
        return `재적 2/3 (${twoThirds(registered)}표)`;
      case "majority_registered":
        return `재적 과반 (${majority(registered)}표)`;
      default:
        return "";
    }
  }

  function evaluate(parties, kindId) {
    const spec = KINDS.find((k) => k.id === kindId) || KINDS[0];
    const t = totals(parties);
    const needAtt = attendanceNeed(spec, t.registered);
    const attendanceMet = needAtt === null || t.present >= needAtt;
    const needApp = approvalNeed(spec, t.registered, t.present);
    const approvalMet = t.aye >= needApp && needApp > 0;
    const sessionMet = t.present >= oneFifth(t.registered);
    const passed = attendanceMet && approvalMet && t.registered > 0;

    let reason;
    if (t.registered === 0) {
      reason = "재적의원이 없습니다. 정당별 의석을 입력하세요.";
    } else if (!attendanceMet && needAtt !== null) {
      reason = `출석 ${t.present}명으로 의사·의결 출석 요건(${needAtt}명)에 미달합니다.`;
    } else if (approvalMet) {
      reason = "출석·찬성 요건을 모두 충족하여 가결됩니다.";
    } else {
      const lack = Math.max(0, needApp - t.aye);
      reason =
        lack === 0
          ? `찬성 ${t.aye}표로는 가결 요건(${needApp}표)을 충족하지 못합니다.`
          : `찬성 ${t.aye}표, 가결까지 ${lack}표가 부족합니다. (필요 ${needApp}표)`;
    }

    return {
      spec,
      ...t,
      attendanceNeed: needAtt,
      attendanceMet,
      approvalNeed: needApp,
      approvalMet,
      sessionMet,
      passed,
      reason,
      short: passed ? "가결" : "부결",
      approvalText: approvalLabel(spec, t.registered, t.present),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { parties: cloneDefaults(), kind: "fasttrack" };
      const parsed = JSON.parse(raw);
      const parties = Array.isArray(parsed.parties)
        ? parsed.parties.map(normalizeParty)
        : cloneDefaults();
      const kind = KINDS.some((k) => k.id === parsed.kind) ? parsed.kind : "fasttrack";
      return { parties: parties.length ? parties : cloneDefaults(), kind };
    } catch {
      return { parties: cloneDefaults(), kind: "fasttrack" };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ parties: state.parties, kind: state.kind, v: 1 })
      );
    } catch {
      /* ignore quota / private mode */
    }
  }

  const state = loadState();

  const els = {
    themeToggle: document.getElementById("theme-toggle"),
    kindTabs: document.getElementById("kind-tabs"),
    kindDesc: document.getElementById("kind-desc"),
    seatSummary: document.getElementById("seat-summary"),
    seatRatio: document.getElementById("seat-ratio"),
    seatBar: document.getElementById("seat-bar"),
    quotaGrid: document.getElementById("quota-grid"),
    presets: document.getElementById("presets"),
    partyList: document.getElementById("party-list"),
    resultPanel: document.getElementById("result-panel"),
    btnReset: document.getElementById("btn-reset-votes"),
    btnAdd: document.getElementById("btn-add-party"),
    asOf: document.getElementById("as-of"),
  };

  els.asOf.textContent = `제22대 · ${AS_OF} 기준`;

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function setTheme(theme) {
    const t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = t;
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#07080a" : "#e6e9ef");
    els.themeToggle.setAttribute("aria-checked", t === "dark" ? "true" : "false");
    els.themeToggle.setAttribute("aria-label", t === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환");
  }

  function commit() {
    saveState(state);
    render();
  }

  function renderKindTabs() {
    els.kindTabs.innerHTML = KINDS.map(
      (k) =>
        `<button type="button" class="segmented-item" data-kind="${k.id}" data-active="${
          state.kind === k.id
        }" role="tab" aria-selected="${state.kind === k.id}">${escapeHtml(k.shortName)}</button>`
    ).join("");
    const spec = KINDS.find((k) => k.id === state.kind) || KINDS[0];
    els.kindDesc.innerHTML = `<strong>${escapeHtml(spec.name)}</strong> · ${escapeHtml(
      spec.basis
    )}. ${escapeHtml(spec.summary)}`;
  }

  function renderSeatOverview(t) {
    els.seatSummary.textContent =
      t.vacancy > 0
        ? `법정 ${LEGAL_SEATS}석 · 재적 ${t.registered}석 · 공석 ${t.vacancy}`
        : `법정 ${LEGAL_SEATS}석 · 재적 ${t.registered}석`;
    els.seatRatio.textContent = `${t.registered} / ${LEGAL_SEATS}`;

    const denom = Math.max(t.registered + t.vacancy, 1);
    const segments = state.parties
      .filter((p) => p.seats > 0)
      .map(
        (p) =>
          `<div title="${escapeAttr(p.name)} ${p.seats}석" style="width:${
            (p.seats / denom) * 100
          }%;background:${escapeAttr(p.color)}"></div>`
      )
      .join("");
    const vac =
      t.vacancy > 0
        ? `<div title="공석 ${t.vacancy}석" style="width:${
            (t.vacancy / denom) * 100
          }%;background:color-mix(in srgb, var(--app-subtle) 30%, transparent)"></div>`
        : "";

    const legend = state.parties
      .map(
        (p) =>
          `<li><span class="dot" style="background:${escapeAttr(
            p.color
          )}"></span><span class="name">${escapeHtml(p.shortName)}</span><span class="tabular">${
            p.seats
          }</span></li>`
      )
      .join("");
    const vacLi =
      t.vacancy > 0
        ? `<li><span class="dot" style="background:color-mix(in srgb, var(--app-subtle) 40%, transparent)"></span>공석 <span class="tabular">${t.vacancy}</span></li>`
        : "";

    els.seatBar.innerHTML = `<div class="seat-bar">${segments}${vac}</div><ul class="legend">${legend}${vacLi}</ul>`;

    els.quotaGrid.innerHTML = `
      <div><dt>개의 1/5</dt><dd>${oneFifth(t.registered)}<span>명</span></dd></div>
      <div><dt>과반</dt><dd>${majority(t.registered)}<span>명</span></dd></div>
      <div><dt>3/5</dt><dd>${threeFifths(t.registered)}<span>명</span></dd></div>
      <div><dt>2/3</dt><dd>${twoThirds(t.registered)}<span>명</span></dd></div>
      <div class="quota-wide"><p>현재 출석 / 재적</p><div class="big">${t.present}<span> / ${
      t.registered
    }</span></div></div>
    `;
  }

  function renderPresets() {
    els.presets.innerHTML = PRESETS.map(
      (p) =>
        `<button type="button" class="btn secondary sm" data-preset="${p.id}">${escapeHtml(
          p.label
        )}</button>`
    ).join("");
  }

  function voteBox(party, field, label, tone) {
    const maxOther =
      party.seats -
      ((field === "aye" ? 0 : party.aye) +
        (field === "nay" ? 0 : party.nay) +
        (field === "abstain" ? 0 : party.abstain));
    const val = party[field];
    return `
      <div class="vote-box" data-party="${escapeAttr(party.id)}" data-field="${field}">
        <label class="${tone}">${label}</label>
        <input class="vote-input" type="number" inputmode="numeric" min="0" max="${maxOther}" value="${val}" aria-label="${escapeAttr(
      party.shortName + " " + label
    )}" />
        <div class="stepper">
          <button type="button" data-step="-1" aria-label="${label} 감소" ${
      val <= 0 ? "disabled" : ""
    }>−</button>
          <button type="button" data-step="1" aria-label="${label} 증가" ${
      val >= maxOther ? "disabled" : ""
    }>+</button>
        </div>
      </div>
    `;
  }

  function renderParties() {
    els.partyList.innerHTML = state.parties
      .map((p) => {
        const present = presentOf(p);
        const absent = absentOf(p);
        const custom = String(p.id).startsWith("custom-");
        const barDenom = Math.max(p.seats, 1);
        return `
        <article class="party-card" data-party-card="${escapeAttr(p.id)}">
          <div class="party-top">
            <div class="party-id">
              <span class="dot" style="width:10px;height:10px;margin-top:6px;background:${escapeAttr(
                p.color
              )}"></span>
              <div>
                <input class="party-name" type="text" value="${escapeAttr(p.name)}" ${
          custom ? "" : 'readonly onfocus="this.removeAttribute(\'readonly\')"'
        } aria-label="정당명" />
                <p class="party-sub">${p.negotiable ? "교섭단체" : "비교섭"} · 출석 ${present} · 불참 ${absent}</p>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.35rem">
              <label class="seat-input-wrap">의석
                <input type="number" inputmode="numeric" min="0" max="300" value="${p.seats}" data-seat-input />
              </label>
              ${
                custom
                  ? `<button type="button" class="btn icon" data-remove title="정당 삭제" aria-label="정당 삭제">✕</button>`
                  : ""
              }
            </div>
          </div>
          <div class="mini-bar">
            ${p.aye ? `<i class="aye" style="width:${(p.aye / barDenom) * 100}%"></i>` : ""}
            ${p.nay ? `<i class="nay" style="width:${(p.nay / barDenom) * 100}%"></i>` : ""}
            ${
              p.abstain
                ? `<i class="abstain" style="width:${(p.abstain / barDenom) * 100}%"></i>`
                : ""
            }
          </div>
          <div class="vote-grid">
            ${voteBox(p, "aye", "찬성", "aye")}
            ${voteBox(p, "nay", "반대", "nay")}
            ${voteBox(p, "abstain", "기권", "muted")}
            <div class="vote-box">
              <label class="subtle">불참</label>
              <div class="absent-val">${absent}</div>
            </div>
          </div>
          <div class="party-actions">
            <button type="button" class="btn aye xs" data-fill="aye">전원 찬성</button>
            <button type="button" class="btn nay xs" data-fill="nay">전원 반대</button>
            <button type="button" class="btn abstain xs" data-fill="abstain">전원 기권</button>
            <button type="button" class="btn ghost xs" data-fill="absent">전원 불참</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function detailRows(result) {
    const attNote =
      result.attendanceNeed === null
        ? `개의 정족수 ${oneFifth(result.registered)}명`
        : `필요 ${result.attendanceNeed}명`;
    const attOk =
      result.attendanceNeed === null ? result.sessionMet : result.attendanceMet;
    const rows = [
      {
        label: "재적의원",
        value: `${result.registered}명`,
        note: result.vacancy > 0 ? `공석 ${result.vacancy}` : "공석 없음",
      },
      {
        label: "출석",
        value: `${result.present}명`,
        note: attNote,
        ok: attOk,
      },
      {
        label: "찬성",
        value: `${result.aye}표`,
        note: `필요 ${result.approvalNeed}표 · ${result.approvalText}`,
        ok: result.approvalMet,
      },
      { label: "반대", value: `${result.nay}표` },
      { label: "기권·무효", value: `${result.abstain}표` },
      { label: "불참", value: `${result.absent}명` },
    ];
    return rows
      .map((r) => {
        const mark =
          r.ok === undefined
            ? ""
            : `<span class="${r.ok ? "ok" : "ng"}" aria-hidden="true">${r.ok ? "✓" : "−"}</span>`;
        return `<div class="detail-row"><dt>${escapeHtml(r.label)}</dt><dd><span class="val">${escapeHtml(
          r.value
        )}</span> ${mark}${
          r.note ? `<p class="note">${escapeHtml(r.note)}</p>` : ""
        }</dd></div>`;
      })
      .join("");
  }

  function partyBreakdown() {
    return state.parties
      .filter((p) => p.seats > 0)
      .map(
        (p) => `<li>
          <span class="dot" style="background:${escapeAttr(p.color)}"></span>
          <span class="name">${escapeHtml(p.shortName)}</span>
          <span class="aye">${p.aye}</span><span class="sep">/</span>
          <span class="nay">${p.nay}</span><span class="sep">/</span>
          <span class="abs">${p.abstain}</span>
        </li>`
      )
      .join("");
  }

  function renderResult(result) {
    const tone = result.passed ? "pass" : "fail";
    const details = `
      <dl class="detail-list">${detailRows(result)}</dl>
      <p class="party-breakdown-title">정당별 찬성 / 반대 / 기권</p>
      <ul class="party-breakdown">${partyBreakdown()}</ul>
    `;
    els.resultPanel.innerHTML = `
      <div class="result-head">
        <div>
          <p class="label">시뮬레이션 결과</p>
          <h3>${escapeHtml(result.spec.shortName)}</h3>
        </div>
        <span class="badge ${tone}">${escapeHtml(result.short)}</span>
      </div>
      <div class="result-hero ${tone}">
        <p class="big">${escapeHtml(result.short)}</p>
        <p class="reason">${escapeHtml(result.reason)}</p>
      </div>
      <dl class="result-stats">
        <div><dt>출석</dt><dd>${result.present}</dd></div>
        <div><dt>찬성</dt><dd class="aye">${result.aye}</dd></div>
        <div><dt>필요</dt><dd>${result.approvalNeed}</dd></div>
      </dl>
      <details class="mobile-only">
        <summary>상세 내역</summary>
        ${details}
      </details>
      <div class="desktop-only">${details}</div>
    `;
  }

  function render() {
    const t = totals(state.parties);
    const result = evaluate(state.parties, state.kind);
    renderKindTabs();
    renderSeatOverview(t);
    renderPresets();
    renderParties();
    renderResult(result);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function findPartyIndex(id) {
    return state.parties.findIndex((p) => p.id === id);
  }

  function updateParty(id, field, value) {
    const i = findPartyIndex(id);
    if (i < 0) return;
    state.parties[i] = setField(state.parties[i], field, value);
    commit();
  }

  // Events
  els.themeToggle.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });

  els.kindTabs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-kind]");
    if (!btn) return;
    state.kind = btn.getAttribute("data-kind");
    commit();
  });

  els.presets.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (!btn) return;
    state.parties = applyPreset(state.parties, btn.getAttribute("data-preset"));
    commit();
  });

  els.btnReset.addEventListener("click", () => {
    state.parties = applyPreset(state.parties, "clear");
    commit();
  });

  els.btnAdd.addEventListener("click", () => {
    state.parties.push(
      normalizeParty({
        id: `custom-${Date.now()}`,
        name: "새 정당",
        shortName: "신규",
        seats: 1,
        color: "#5c6370",
        aye: 0,
        nay: 0,
        abstain: 0,
        negotiable: false,
      })
    );
    commit();
  });

  els.partyList.addEventListener("click", (e) => {
    const card = e.target.closest("[data-party-card]");
    if (!card) return;
    const id = card.getAttribute("data-party-card");

    if (e.target.closest("[data-remove]")) {
      state.parties = state.parties.filter((p) => p.id !== id);
      commit();
      return;
    }

    const fill = e.target.closest("[data-fill]");
    if (fill) {
      const i = findPartyIndex(id);
      if (i < 0) return;
      state.parties[i] = fillOne(state.parties[i], fill.getAttribute("data-fill"));
      commit();
      return;
    }

    const stepBtn = e.target.closest("[data-step]");
    if (stepBtn) {
      const box = stepBtn.closest("[data-field]");
      if (!box) return;
      const field = box.getAttribute("data-field");
      const i = findPartyIndex(id);
      if (i < 0) return;
      const delta = Number(stepBtn.getAttribute("data-step")) || 0;
      state.parties[i] = setField(state.parties[i], field, state.parties[i][field] + delta);
      commit();
    }
  });

  els.partyList.addEventListener("change", (e) => {
    const card = e.target.closest("[data-party-card]");
    if (!card) return;
    const id = card.getAttribute("data-party-card");
    if (e.target.matches("[data-seat-input]")) {
      updateParty(id, "seats", e.target.value);
      return;
    }
    if (e.target.matches(".party-name")) {
      updateParty(id, "name", e.target.value);
      return;
    }
    const box = e.target.closest("[data-field]");
    if (box && e.target.matches(".vote-input")) {
      updateParty(id, box.getAttribute("data-field"), e.target.value);
    }
  });

  // Keep typing smooth: update on input for numbers without full remount focus loss is ok after commit
  els.partyList.addEventListener("input", (e) => {
    if (!e.target.matches(".vote-input, [data-seat-input]")) return;
    // deferred to change/blur for less thrash; steppers handle quick edits
  });

  setTheme(currentTheme());
  render();
})();
