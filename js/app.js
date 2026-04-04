/**
 * ============================================================================
 * APP.JS — LOGIK UTAMA FRONTEND e-HASIL FPMSB TENANG
 * ============================================================================
 * Semua JavaScript logic untuk PWA e-Hasil.
 * Bergantung kepada: config.js (mesti diload dahulu)
 *
 * SUSUNAN:
 *   1.  State Variables
 *   2.  Inisialisasi
 *   3.  Tema (Dark/Light)
 *   4.  Navigasi & UI
 *   5.  Toast & Loader
 *   6.  Dashboard
 *   7.  Input Handler (Formula Support)
 *   8.  Render — Hasil
 *   9.  Render — Muda
 *   10. Render — Tandan
 *   11. Render — Penalti
 *   12. Stats Display
 *   13. Simpan Data
 *   14. Admin & Laporan
 *   15. API Helper
 * ============================================================================
 */


// ============================================================================
// 1. STATE VARIABLES
// ============================================================================

/** Simpan nilai/formula input semasa. Key = type+idx atau type+team */
let FORMULA_STORE = {};

/** Data status pusingan tuai dari backend. Diisi oleh fetchHarvestStats() */
let HARVEST_STATS = null;


// ============================================================================
// 2. INISIALISASI
// ============================================================================

window.onload = async () => {
  const today = new Date().toISOString().split("T")[0];
  ["date-hasil","date-muda","date-penalti","date-tandan"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = today;
    });
  renderPeringkatHasil();
  renderTeamMuda();
  renderTeamTandan();
  renderPeringkatPenalti();
  fetchHarvestStats();
  await loadDashboardData(); // tunggu dashboard selesai dulu
  initChartPage();           // baru mula chart
};


// ============================================================================
// 3. TEMA (DARK / LIGHT)
// ============================================================================

/**
 * Inisialisasi tema — baca dari localStorage dan apply.
 * Dipanggil sebagai IIFE supaya tema diapply sebelum page render.
 */
(function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
    syncThemeIcon();
  } catch (e) {}
})();

/**
 * Sync ikon toggle tema dengan tema semasa.
 * dark_mode = sedang light (butang untuk pergi dark)
 * light_mode = sedang dark (butang untuk pergi light)
 */
function syncThemeIcon() {
  const icon = document.getElementById("themeIcon");
  if (!icon) return;

  const forced = document.documentElement.getAttribute("data-theme");
  let isDark = false;

  if (forced === "dark")  isDark = true;
  else if (forced === "light") isDark = false;
  else isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  icon.textContent = isDark ? "light_mode" : "dark_mode";
}

/**
 * Toggle tema manual antara dark dan light.
 * Simpan pilihan ke localStorage.
 */
function toggleTheme() {
  const cur  = document.documentElement.getAttribute("data-theme");
  const osDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  let next;

  if (cur === "dark")       next = "light";
  else if (cur === "light") next = "dark";
  else                      next = osDark ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  syncThemeIcon();
}

// Sync ikon bila OS tema berubah (hanya jika tiada forced tema)
try {
  window.matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (!document.documentElement.getAttribute("data-theme")) {
        syncThemeIcon();
      }
    });
} catch (e) {}


// ============================================================================
// 4. NAVIGASI & UI
// ============================================================================

/** Toggle sidebar buka/tutup */
function toggleMenu() {
  document.querySelector(".sidebar").classList.toggle("open");
  document.querySelector(".overlay").classList.toggle("open");
}

/**
 * Navigasi ke halaman tertentu.
 * @param {string} pageId - ID elemen halaman (contoh: "page-hasil")
 * @param {Element} menuEl - Elemen sidebar yang diklik
 */
function nav(pageId, menuEl) {
  // Sembunyikan semua halaman
  document.querySelectorAll(".page-section")
    .forEach(p => p.classList.remove("active"));

  // Papar halaman yang dipilih
  document.getElementById(pageId)?.classList.add("active");

  // Kemaskini active state dalam sidebar
  document.querySelectorAll(".sb-item")
    .forEach(i => i.classList.remove("active"));
  menuEl?.classList.add("active");

  toggleMenu();
}


// ============================================================================
// 5. TOAST & LOADER
// ============================================================================

/**
 * Papar notifikasi toast selama 3.5 saat.
 * @param {string} msg  - Mesej untuk dipapar
 * @param {string} type - "success" | "warning" | "error"
 */
function showToast(msg, type = "success") {
  const toast = document.getElementById("toast-box");
  const icon  = document.getElementById("toast-icon");
  const text  = document.getElementById("toast-msg");

  const icons = {
    success : "check_circle",
    warning : "report_problem",
    error   : "error"
  };

  text.textContent  = msg;
  icon.textContent  = icons[type] || "notifications";
  toast.className   = `show ${type}`;

  setTimeout(() => toast.classList.remove("show"), 3500);
}

/** Papar loading overlay */
function showLoader() {
  document.getElementById("loader").style.display = "flex";
}

/** Sembunyikan loading overlay */
function hideLoader() {
  document.getElementById("loader").style.display = "none";
}


// ============================================================================
// 6. DASHBOARD
// ============================================================================

/**
 * Tentukan warna progress bar berdasarkan peratus capai.
 * @param  {number} pct - Peratus (0-100)
 * @return {string}     - CSS gradient string
 */
function getProgColor(pct) {
  if (pct >= 90) return PROGRESS_COLOR.GREEN;
  if (pct >= 80) return PROGRESS_COLOR.YELLOW;
  return PROGRESS_COLOR.RED;
}

/**
 * Bina HTML untuk satu kad prestasi PKT atau Rumusan.
 * @param  {Object}  c          - Data kad dari backend
 * @param  {boolean} isRumusan  - true jika ini kad Rumusan
 * @return {string}             - HTML string
 */
function buildCardHTML(c, isRumusan = false) {
  const title    = isRumusan ? "🏆 RUMUSAN (KESELURUHAN)" : `📍 ${c.name}`;
  const cssClass = isRumusan ? "dash-card rumusan" : "dash-card";
  const hek      = c.hektar ? c.hektar.toFixed(2) + " Ha" : "0.00 Ha";

  const pctBulan  = Math.min(c.pctBulan  * 100, 100);
  const pctYTD    = Math.min(c.pctYTD    * 100, 100);
  const pctTahun  = Math.min(c.pctTahun  * 100, 100);

  return `
    <div class="${cssClass}">
      <div class="dc-header">
        <div class="dc-title">${title}</div>
        <div class="dc-luas">🌿 ${hek}</div>
      </div>

      <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:10px;">
        📅 BULAN SEMASA
      </div>
      <div class="dc-grid">
        <div class="dc-box">
          <span>📦 TAN</span>
          <div class="dc-val">${c.capaiTan.toFixed(2)}</div>
          <div class="dc-sub">Target: ${c.targetTan.toFixed(2)}</div>
        </div>
        <div class="dc-box">
          <span>⚖️ TAN / HEK</span>
          <div class="dc-val">${c.capaiTH.toFixed(2)}</div>
          <div class="dc-sub">Target: ${c.targetTH.toFixed(2)}</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:10px;">
        📊 PRESTASI & PROGRESS
      </div>

      <div class="pb-wrap">
        <div class="pb-labels">
          <span>Bulan Ini (${c.capaiTan.toFixed(2)} Tan / ${c.capaiTH.toFixed(2)} TH)</span>
          <span class="pb-pct">${Math.round(c.pctBulan * 100)}%</span>
        </div>
        <div class="pb-bg">
          <div class="pb-fill" style="width:${pctBulan}%;background:${getProgColor(pctBulan)}"></div>
        </div>
      </div>

      <div class="pb-wrap">
        <div class="pb-labels">
          <span>Hingga Kini (${c.ytdTan.toFixed(2)} Tan / ${c.ytdTH.toFixed(2)} TH)</span>
          <span class="pb-pct">${Math.round(c.pctYTD * 100)}%</span>
        </div>
        <div class="pb-bg">
          <div class="pb-fill" style="width:${pctYTD}%;background:${getProgColor(pctYTD)}"></div>
        </div>
      </div>

      <div class="pb-wrap">
        <div class="pb-labels">
          <span>Tahun Ini (${c.tahunTargetTan.toFixed(2)} Tan / ${c.tahunTargetTH.toFixed(2)} TH)</span>
          <span class="pb-pct">${Math.round(c.pctTahun * 100)}%</span>
        </div>
        <div class="pb-bg">
          <div class="pb-fill" style="width:${pctTahun}%;background:${getProgColor(pctTahun)}"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Ambil data dashboard dari backend dan render ke #dash-container.
 * Dipanggil semasa load dan selepas setiap operasi save.
 */
async function loadDashboardData() {
  try {
    const res = await apiCall("getDashboardData", {});
    const container = document.getElementById("dash-container");

    if (!res.ok || !res.payload) {
      container.innerHTML = `
        <div style="text-align:center;padding:20px;
                    color:var(--danger);font-weight:800;">
          Gagal memuatkan data. Sila cuba lagi.
        </div>`;
      return; // ← return tanpa value pun ok, async function auto return resolved promise
    }

    let html = "";
    if (res.payload.rumusan) html += buildCardHTML(res.payload.rumusan, true);
    res.payload.cards?.forEach(c => { html += buildCardHTML(c, false); });

    container.innerHTML = html || `
      <div style="text-align:center;padding:20px;">
        Tiada rekod untuk bulan ini.
      </div>`;

    setTimeout(() => {
      document.querySelectorAll(".pb-fill").forEach(el => {
        const w = el.style.width;
        el.style.width = "0";
        setTimeout(() => { el.style.width = w; }, 50);
      });
    }, 50);

  } catch (e) {
    document.getElementById("dash-container").innerHTML = `
      <div style="text-align:center;padding:20px;
                  color:var(--danger);font-weight:800;">
        Tiada sambungan ke server.
      </div>`;
  }
}


// ============================================================================
// 7. INPUT HANDLER (FORMULA SUPPORT)
// ============================================================================

/**
 * Bina key unik untuk FORMULA_STORE berdasarkan jenis input dan identifier.
 */
function _inputKey(type, el) {
  return type + (el.dataset.idx !== undefined ? el.dataset.idx : (el.dataset.team || ""));
}

/**
 * Dipanggil setiap kali user taip dalam input.
 * Simpan nilai ke FORMULA_STORE untuk kegunaan semasa submit.
 */
function onInputHandler(el, type) {
  FORMULA_STORE[_inputKey(type, el)] = el.value;
  if (type === "hasil") updateLiveTotal();
}

/**
 * Dipanggil apabila input kehilangan fokus.
 * Jika ada operator matematik (+,-,*,/), tambah "=" dan eval sebagai formula.
 * Papar hasil kira, simpan formula asal dalam FORMULA_STORE.
 */
function onBlurInput(el, type) {
  const key = _inputKey(type, el);
  let   val = el.value.trim();

  if (!val) {
    FORMULA_STORE[key] = "";
    return;
  }

  // Auto-tambah "=" jika ada operator tapi belum ada "="
  if (/[+\-*/]/.test(val) && !val.startsWith("=")) {
    val = "=" + val;
    FORMULA_STORE[key] = val;
  }

  // Eval formula dan papar hasil
  if (val.startsWith("=")) {
    try {
      const result = Function('"use strict";return (' + val.substring(1) + ')')();
      if (!isNaN(result)) {
        el.value = result % 1 !== 0 ? result.toFixed(2) : result;
      }
    } catch (e) {}
  }

  if (type === "hasil") updateLiveTotal();
}

/**
 * Dipanggil apabila input mendapat fokus.
 * Papar semula formula asal (jika ada) supaya user boleh edit.
 */
function onFocusInput(el, type) {
  const key = _inputKey(type, el);
  if (FORMULA_STORE[key]?.startsWith("=")) {
    el.value = FORMULA_STORE[key];
  }
}

/**
 * Kira dan papar jumlah live semua input team dalam halaman Hasil.
 * Hanya aktif untuk mod TAN (bukan PUS_TUAI) dan bukan RUMUSAN.
 */
function updateLiveTotal() {
  const pkt  = document.getElementById("sel-pkt-hasil")?.value;
  const mode = document.getElementById("mode-hasil")?.value;
  if (pkt === "RUMUSAN" || mode !== "TAN") return;

  let total = 0;
  document.querySelectorAll(".bulk-hasil").forEach(inp => {
    const raw = inp.value.trim();
    if (raw.startsWith("=")) {
      try {
        total += Function('"use strict";return (' + raw.substring(1) + ')')() || 0;
      } catch (e) {}
    } else {
      total += parseFloat(raw) || 0;
    }
  });

  const display = document.getElementById("display-tan-live");
  if (display) display.textContent = total.toFixed(2);
}

/**
 * Clear semua FORMULA_STORE entries untuk type tertentu.
 */
function clearFormulaStore(type) {
  Object.keys(FORMULA_STORE).forEach(k => {
    if (k.startsWith(type)) delete FORMULA_STORE[k];
  });
}


// ============================================================================
// 8. RENDER — HALAMAN HASIL
// ============================================================================

/**
 * Render semula dropdown peringkat apabila mode berubah.
 * PUS_TUAI mode tidak termasuk RUMUSAN dalam senarai.
 */
function renderPeringkatHasil() {
  clearFormulaStore("hasil");

  const sel  = document.getElementById("sel-pkt-hasil");
  const mode = document.getElementById("mode-hasil")?.value;
  const list = mode === "PUS_TUAI"
    ? HASIL_CFG.pkt.filter(x => x !== "RUMUSAN")
    : HASIL_CFG.pkt;

  sel.innerHTML = list.map(x => `<option value="${x}">${x}</option>`).join("");
  renderTeamHasil();
}

/**
 * Render input team/blok untuk PKT yang dipilih dalam halaman Hasil.
 * RUMUSAN: papar butang Refresh Rumusan sahaja, tiada input team.
 * TAN mode: input bulk per team.
 * PUS_TUAI mode: input tunggal (hektar).
 */
function renderTeamHasil() {
  clearFormulaStore("hasil");

  const pkt       = document.getElementById("sel-pkt-hasil").value;
  const mode      = document.getElementById("mode-hasil")?.value;
  const wrap      = document.getElementById("wrap-team-hasil");
  const wrapSingle = document.getElementById("wrap-single-hasil");
  const wrapLive  = document.getElementById("wrap-live-display");
  const btnRefresh = document.getElementById("btnRefRumusan");
  const lblDisplay = document.getElementById("lbl-display");

  // Kes khas: RUMUSAN
  if (pkt === "RUMUSAN") {
    showToast("Sila klik 'REFRESH RUMUSAN' dahulu!", "warning");
    btnRefresh.style.display  = "block";
    lblDisplay.textContent    = "JUMLAH TAN KESELURUHAN";
    wrap.innerHTML            = "";
    wrapSingle.style.display  = "none";
    wrapLive.style.display    = "block";
    document.getElementById("display-tan-live").textContent = "0.00";
    updateHarvestStatusDisplay(pkt);
    return;
  }

  btnRefresh.style.display = "none";
  lblDisplay.textContent   = "JUMLAH TAN (HARI INI)";

  if (mode === "TAN") {
    wrapSingle.style.display = "none";
    wrapLive.style.display   = "block";

    const teams = pkt === "PKT001" ? ["TOTAL"] : (HASIL_CFG.teams[pkt] || []);
    wrap.innerHTML = `<label>MASUKKAN TAN PER TEAM (${pkt})</label>`
      + teams.map((t, i) => `
          <div class="bulk-row">
            <label>${t}</label>
            <input type="text" class="bulk-hasil" data-idx="${i}"
              placeholder="0.00"
              onfocus="onFocusInput(this,'hasil')"
              onblur="onBlurInput(this,'hasil')"
              oninput="onInputHandler(this,'hasil')">
          </div>`
      ).join("");

    updateLiveTotal();

  } else {
    // PUS_TUAI mode — input tunggal
    wrap.innerHTML           = "";
    wrapSingle.style.display = "block";
    wrapLive.style.display   = "none";
  }

  updateHarvestStatusDisplay(pkt);
}


// ============================================================================
// 9. RENDER — HALAMAN MUDA
// ============================================================================

/**
 * Render input team untuk PKT yang dipilih dalam halaman BTB Muda.
 * Selepas render, ambil stats team dari backend untuk papar badge.
 */
function renderTeamMuda() {
  clearFormulaStore("muda");

  const pkt    = document.getElementById("sel-pkt-muda").value;
  const teams  = MUDA_CFG[pkt] || [];
  const wrap   = document.getElementById("wrap-team-muda");

  wrap.innerHTML = `<label>SENARAI TEAM : ${pkt}</label>`
    + teams.map(t => `
        <div class="bulk-row">
          <label id="lbl-muda-${t}">${t}</label>
          <input type="text" class="bulk-muda" data-team="${t}"
            placeholder="0"
            onfocus="onFocusInput(this,'muda')"
            onblur="onBlurInput(this,'muda')"
            oninput="onInputHandler(this,'muda')">
        </div>`
    ).join("");

  fetchTeamStats("MUDA", pkt);
}


// ============================================================================
// 10. RENDER — HALAMAN TANDAN
// ============================================================================

/**
 * Render input team untuk PKT yang dipilih dalam halaman Rekod Tandan.
 * Selepas render, ambil stats team dari backend untuk papar badge.
 */
function renderTeamTandan() {
  clearFormulaStore("tandan");

  const pkt   = document.getElementById("sel-pkt-tandan").value;
  const teams = TANDAN_CFG[pkt] || [];
  const wrap  = document.getElementById("wrap-team-tandan");

  wrap.innerHTML = `<label>SENARAI TEAM : ${pkt}</label>`
    + teams.map(t => `
        <div class="bulk-row">
          <label id="lbl-tandan-${t}">${t}</label>
          <input type="text" class="bulk-tandan" data-team="${t}"
            placeholder="0"
            onfocus="onFocusInput(this,'tandan')"
            onblur="onBlurInput(this,'tandan')"
            oninput="onInputHandler(this,'tandan')">
        </div>`
    ).join("");

  fetchTeamStats("TANDAN", pkt);
}


// ============================================================================
// 11. RENDER — HALAMAN PENALTI
// ============================================================================

/**
 * Render semula display stat penalti apabila PKT atau jenis berubah.
 * Ambil stats dari backend untuk papar rekod semasa.
 */
function renderPeringkatPenalti() {
  clearFormulaStore("penalti");

  const pkt  = document.getElementById("sel-pkt-penalti").value;
  const type = document.getElementById("type-penalti").value;
  const stat = document.getElementById("stat-penalti");

  if (stat) stat.textContent = "Loading...";
  fetchTeamStats("PENALTI", pkt, type);
}


// ============================================================================
// 12. STATS DISPLAY
// ============================================================================

/**
 * Ambil statistik team dari backend dan update UI.
 * @param {string} mode - "MUDA" | "PENALTI" | "TANDAN"
 * @param {string} pkt  - Nama PKT
 * @param {string} type - Untuk PENALTI: "MENGKAL" | "LAMA"
 */
async function fetchTeamStats(mode, pkt, type = "") {
  try {
    const res = await apiCall("getTeamStats", { mode, peringkat: pkt, type });
    if (res.ok) drawStatsUI(mode, pkt, res.stats || {});
    else        drawStatsUI(mode, pkt, {});
  } catch (e) {
    console.error("fetchTeamStats error:", e);
  }
}

/**
 * Kemaskini UI badge stats tanpa reload halaman.
 * MUDA/TANDAN: papar total dan badge nombor di setiap team.
 * PENALTI: papar rekod semasa di sebelah label.
 */
function drawStatsUI(mode, pkt, data) {
  if (mode === "MUDA" || mode === "TANDAN") {
    const headerId = mode === "MUDA" ? "stats-header-muda" : "stats-header-tandan";
    const header   = document.getElementById(headerId);
    const cfg      = mode === "MUDA" ? MUDA_CFG : TANDAN_CFG;

    if (data.totalPkt !== undefined) {
      let txt = `TOTAL PKT: ${data.totalPkt}`;
      if (mode === "TANDAN" && data.berat) {
        const estTon = (data.totalPkt * data.berat / 1000).toFixed(2);
        txt += ` | BERAT: ${estTon} MT`;
      }
      header.textContent    = txt;
      header.style.display  = "block";
    } else {
      header.style.display = "none";
    }

    // Kemaskini badge di setiap label team
    (cfg[pkt] || []).forEach(t => {
      const labelEl = document.getElementById(`lbl-${mode.toLowerCase()}-${t}`);
      if (!labelEl) return;
      labelEl.innerHTML = t;
      if (data.teams?.[t] !== undefined) {
        labelEl.innerHTML += ` <span class="stat-badge">${data.teams[t]}</span>`;
      }
    });

  } else if (mode === "PENALTI") {
    const el = document.getElementById("stat-penalti");
    if (!el) return;
    el.textContent = data.totalType !== undefined
      ? `(Rekod: ${data.totalType})`
      : "";
  }
}

/**
 * Ambil data harvest status dari backend.
 * Simpan ke HARVEST_STATS untuk digunakan oleh updateHarvestStatusDisplay.
 */
async function fetchHarvestStats() {
  try {
    const res = await apiCall("getHarvestStatus", {});
    if (res.ok) {
      HARVEST_STATS = res.stats;
      updateHarvestStatusDisplay(
        document.getElementById("sel-pkt-hasil")?.value
      );
    }
  } catch (e) {
    console.error("fetchHarvestStats error:", e);
  }
}

/**
 * Kemaskini paparan luas hektar dan status siap tuai/baki.
 * Hanya dipapar untuk mod PUS_TUAI.
 */
function updateHarvestStatusDisplay(pkt) {
  const box          = document.getElementById("box-status-tuai");
  const infoLuas     = document.getElementById("info-luas-header");
  const mode         = document.getElementById("mode-hasil")?.value;

  if (!HARVEST_STATS?.[pkt]) {
    if (infoLuas) infoLuas.textContent = "";
    if (box)      box.style.display    = "none";
    return;
  }

  const { luas, siap } = HARVEST_STATS[pkt];
  if (infoLuas) infoLuas.textContent = `• ${luas.toFixed(2)} Ha`;

  if (mode === "PUS_TUAI" && pkt !== "RUMUSAN" && box) {
    const day    = Number(document.getElementById("date-hasil")?.value.split("-")[2] || 1);
    const target = (day >= 16 || siap > luas) ? luas * 2 : luas;

    document.getElementById("valSiap").textContent = siap.toFixed(2)  + " Ha";
    document.getElementById("valBaki").textContent = (target - siap).toFixed(2) + " Ha";
    box.style.display = "flex";
  } else {
    if (box) box.style.display = "none";
  }
}


// ============================================================================
// 13. SIMPAN DATA
// ============================================================================

/**
 * Proses simpan data Hasil (TAN atau PUS_TUAI).
 * Kumpul semua nilai input, hantar ke backend.
 */
async function processSaveMaster() {
  const d    = document.getElementById("date-hasil").value;
  const pkt  = document.getElementById("sel-pkt-hasil").value;
  const mode = document.getElementById("mode-hasil").value;
  const day  = Number(d.split("-")[2]);

  let action  = mode === "TAN" ? "saveTanBulk" : "savePusTuai";
  let payload = { peringkat: pkt, tarikh: d, day };

  if (mode === "TAN") {
    payload.list = [];
    document.querySelectorAll(".bulk-hasil").forEach(inp => {
      const val = FORMULA_STORE["hasil" + inp.dataset.idx] || inp.value;
      if (val.trim() !== "" && val.trim() !== "0") {
        payload.list.push({ idx: inp.dataset.idx, val });
      }
    });

    if (pkt !== "RUMUSAN" && payload.list.length === 0) {
      showToast("Sila isi sekurang-kurangnya satu nilai!", "error");
      return;
    }

  } else {
    // PUS_TUAI — nilai tunggal hektar
    payload.hektar = FORMULA_STORE["hasil"] || document.getElementById("val-hasil").value;
    if (!payload.hektar) {
      showToast("Sila isi nilai hektar!", "error");
      return;
    }
  }

  showLoader();
  try {
    const res = await apiCall(action, payload);
    hideLoader();

    if (res.ok) {
      showToast(res.message, "success");
      _clearHasilInputs(mode);
      if (mode === "PUS_TUAI") fetchHarvestStats();
      loadDashboardData(); // Refresh dashboard senyap
    } else {
      showToast(res.message, "error");
    }
  } catch (e) {
    hideLoader();
    showToast("Ralat sambungan!", "error");
  }
}

/**
 * Proses simpan data untuk modul lain (Muda, Tandan, Penalti).
 * @param {string} type - "muda" | "tandan" | "penalti"
 */
async function saveData(type) {
  const d   = document.getElementById(`date-${type}`).value;
  const pkt = document.getElementById(`sel-pkt-${type}`).value;
  const day = Number(d.split("-")[2]);

  const actions = {
    muda    : "saveMudaBulk",
    tandan  : "saveTandanBulk",
    penalti : "savePenalti"
  };

  let payload = { peringkat: pkt, tarikh: d, day };

  if (type === "penalti") {
    payload.type = document.getElementById("type-penalti").value;
    payload.val  = FORMULA_STORE["penalti"] || document.getElementById("val-penalti").value;

    if (!payload.val) {
      showToast("Sila isi nilai!", "error");
      return;
    }

  } else {
    payload.list = [];
    document.querySelectorAll(`.bulk-${type}`).forEach(inp => {
      const val = FORMULA_STORE[type + (inp.dataset.team || "")] || inp.value;
      if (val.trim() !== "") {
        payload.list.push({ team: inp.dataset.team, val });
      }
    });

    if (payload.list.length === 0) {
      showToast("Sila isi sekurang-kurangnya satu nilai!", "error");
      return;
    }
  }

  showLoader();
  try {
    const res = await apiCall(actions[type], payload);
    hideLoader();

    if (res.ok) {
      showToast(res.message, "success");
      _clearModulInputs(type);
    } else {
      showToast(res.message, "error");
    }
  } catch (e) {
    hideLoader();
    showToast("Ralat sambungan!", "error");
  }
}

/**
 * Jalankan action admin (refresh rumusan).
 * @param {string} act - Nama action
 */
async function runAdmin(act) {
  const d   = document.getElementById("date-hasil").value;
  const pkt = document.getElementById("sel-pkt-hasil").value;
  const day = Number(d.split("-")[2]);

  showLoader();
  try {
    const res = await apiCall(act, { peringkat: pkt, day });
    hideLoader();

    if (act === "refreshRumusan" && res.tan !== undefined) {
      const display = document.getElementById("display-tan-live");
      if (display) display.textContent = Number(res.tan).toFixed(2);
      FORMULA_STORE["hasil"] = String(res.tan);
      loadDashboardData();
    }

    showToast(res.message, res.ok ? "success" : "error");
  } catch (e) {
    hideLoader();
    showToast("Ralat!", "error");
  }
}

/**
 * Clear input Hasil selepas save berjaya.
 * @param {string} mode - "TAN" | "PUS_TUAI"
 */
function _clearHasilInputs(mode) {
  if (mode === "TAN") {
    document.querySelectorAll(".bulk-hasil").forEach(inp => { inp.value = ""; });
    const display = document.getElementById("display-tan-live");
    if (display) display.textContent = "0.00";
  } else {
    const valInput = document.getElementById("val-hasil");
    if (valInput) valInput.value = "";
  }
  clearFormulaStore("hasil");
}

/**
 * Clear input modul (Muda/Tandan/Penalti) selepas save berjaya.
 * @param {string} type - "muda" | "tandan" | "penalti"
 */
function _clearModulInputs(type) {
  document.querySelectorAll(`.bulk-${type}`).forEach(inp => { inp.value = ""; });
  if (type === "penalti") {
    const valInput = document.getElementById("val-penalti");
    if (valInput) valInput.value = "";
  }
  clearFormulaStore(type);
}


// ============================================================================
// 14. ADMIN & LAPORAN
// ============================================================================

/**
 * Jana laporan dan papar dalam textarea.
 * @param {string} t - "PO" | "RUMUSAN" | "ALL"
 */
async function getReport(t) {
  showLoader();
  try {
    const res = await apiCall("genReport", t);
    hideLoader();

    if (res.ok) {
      document.getElementById("report-out").value = res.reportText;
      document.getElementById("reportResult").style.display = "block";
    } else {
      showToast(res.message || "Gagal jana laporan.", "error");
    }
  } catch (e) {
    hideLoader();
    showToast("Ralat sambungan!", "error");
  }
}

/**
 * Salin teks laporan ke clipboard.
 */
function copyText() {
  const t = document.getElementById("report-out");
  t.select();
  document.execCommand("copy");
  showToast("Laporan berjaya disalin!", "success");
}


// ============================================================================
// 15. API HELPER
// ============================================================================

/**
 * Hantar request POST ke GAS Web App.
 * Wrapper ringkas untuk semua panggilan API.
 *
 * @param  {string} action - Nama action (contoh: "saveTanBulk")
 * @param  {*}      data   - Payload untuk dihantar
 * @return {Object}        - Response JSON dari backend
 */
async function apiCall(action, data) {
  const response = await fetch(API_URL, {
    method : "POST",
    body   : JSON.stringify({ action, data })
  });
  return response.json();
}

// ============================================================================
// 16. GRAF & ANALISIS (CHART.JS)
// ============================================================================

/** Instance Chart.js aktif — disimpan untuk destroy sebelum render baru */
let _chartInstance = null;

/** Cache data chart — elak fetch berulang bila tukar tab sahaja */
let _chartDataCache = null;

/** State semasa: tab aktif, PKT, tahun */
let _chartState = {
  type    : "hasil",
  pkt     : "RUMUSAN",
  tahun   : new Date().getFullYear(),
  compare : false
};

/**
 * Inisialisasi halaman graf — render dropdown + tabs.
 * Dipanggil sekali semasa nav ke page-grafik.
 */
function initChartPage() {
  _renderChartPktDropdown();
  _renderChartTahunDropdown();
  _renderChartTabs();
  loadChartData();
}

/**
 * Dipanggil bila mana-mana kawalan berubah (PKT, tahun, compare).
 * Invalidate cache dan reload.
 */
function onChartFilterChange() {
  const pkt     = document.getElementById("chart-pkt").value;
  const tahun   = Number(document.getElementById("chart-tahun").value);
  const compare = document.getElementById("chart-compare").checked;

  const changed = (pkt !== _chartState.pkt || tahun !== _chartState.tahun);
  _chartState.pkt     = pkt;
  _chartState.tahun   = tahun;
  _chartState.compare = compare;

  if (changed) {
    _chartDataCache = null; // PKT/tahun berubah → perlu fetch semula
  }

  loadChartData();
}

/**
 * Fetch data chart dari backend dan render.
 */
async function loadChartData() {
  _showChartLoader(true);

  try {
    if (!_chartDataCache) {
      const res = await apiCall("getChartData", {
        pkt   : _chartState.pkt,
        tahun : _chartState.tahun
      });

      if (!res.ok) {
        _showChartError(res.message);
        return;
      }

      _chartDataCache = res.payload;
    }

    _renderChart(_chartDataCache);
    _renderChartStats(_chartDataCache);

  } catch (e) {
    _showChartError("Ralat sambungan ke server.");
  } finally {
    _showChartLoader(false);
  }
}

/**
 * Render graf berdasarkan jenis tab aktif.
 */
function _renderChart(payload) {
  const canvas = document.getElementById("mainChart");
  const labels = payload.labels; // ["JAN","FEB",..."DIS"]
  const type   = _chartState.type;

  // Destroy instance lama sebelum buat baru
  if (_chartInstance) {
    _chartInstance.destroy();
    _chartInstance = null;
  }

  let config;

  if (type === "hasil") {
    config = _buildHasilChartConfig(labels, payload.hasil);
  } else if (type === "pusTuai") {
    config = _buildPusTuaiChartConfig(labels, payload.pusTuai);
  } else if (type === "muda") {
    config = _buildSimpleBarConfig(
      labels, payload.muda.total,
      "Tandan Muda", CHART_COLORS.barMuda, CHART_COLORS.barMudaBdr,
      "Tandan"
    );
  } else if (type === "mengkal") {
    config = _buildSimpleBarConfig(
      labels, payload.mengkal.total,
      "Tandan Mengkal", CHART_COLORS.barMengkal, CHART_COLORS.barMengkalBdr,
      "Tandan"
    );
  }

  _chartInstance = new Chart(canvas, config);
}

/**
 * Bina konfigurasi chart HASIL (Bar capai + Line target + Bar tahun lepas).
 */
function _buildHasilChartConfig(labels, data) {
  const datasets = [
    {
      type           : "bar",
      label          : `Capai ${_chartState.tahun} (Tan)`,
      data           : data.capaiIni,
      backgroundColor: CHART_COLORS.barCurrent,
      borderColor    : CHART_COLORS.barCurrentBdr,
      borderWidth    : 1,
      borderRadius   : 4,
      order          : 2
    },
    {
      type       : "line",
      label      : "Target (Tan)",
      data       : data.targetIni,
      borderColor: CHART_COLORS.lineTarget,
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: CHART_COLORS.lineTarget,
      fill       : false,
      tension    : 0.3,
      order      : 1
    }
  ];

  // Tambah bar tahun lepas jika toggle aktif
  if (_chartState.compare && data.capaiLps) {
    datasets.push({
      type           : "bar",
      label          : `Capai ${_chartState.tahun - 1} (Tan)`,
      data           : data.capaiLps,
      backgroundColor: CHART_COLORS.barPrev,
      borderColor    : CHART_COLORS.barPrevBdr,
      borderWidth    : 1,
      borderRadius   : 4,
      order          : 3
    });
  }

  return _baseChartConfig(labels, datasets, "Tan");
}

/**
 * Bina konfigurasi chart PUSINGAN TUAI (Bar hektar + Line luas PKT).
 */
function _buildPusTuaiChartConfig(labels, data) {
  const luasLine = new Array(12).fill(data.luasPKT);

  const datasets = [
    {
      type           : "bar",
      label          : "Hektar Dituai",
      data           : data.hektarBulan,
      backgroundColor: CHART_COLORS.barPusTuai,
      borderColor    : CHART_COLORS.barPusTuaiBdr,
      borderWidth    : 1,
      borderRadius   : 4,
      order          : 2
    },
    {
      type       : "line",
      label      : "Luas PKT (Ha)",
      data       : luasLine,
      borderColor: CHART_COLORS.lineLuas,
      borderWidth: 2,
      borderDash : [6, 4],
      pointRadius: 0,
      fill       : false,
      order      : 1
    }
  ];

  return _baseChartConfig(labels, datasets, "Ha");
}

/**
 * Bina konfigurasi chart bar ringkas (Muda/Mengkal).
 */
function _buildSimpleBarConfig(labels, data, label, bgColor, borderColor, unit) {
  const datasets = [{
    type           : "bar",
    label,
    data,
    backgroundColor: bgColor,
    borderColor,
    borderWidth    : 1,
    borderRadius   : 4
  }];

  return _baseChartConfig(labels, datasets, unit);
}

/**
 * Konfigurasi asas Chart.js yang dikongsi semua jenis graf.
 * Dioptimakan untuk skrin telefon kecil.
 */
function _baseChartConfig(labels, datasets, yUnit) {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark"
    || (!document.documentElement.getAttribute("data-theme")
       && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  const labelColor = isDark ? "rgba(230,234,245,0.7)" : CHART_COLORS.label;

  return {
    type : "bar",
    data : { labels, datasets },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position : "bottom",
          labels   : {
            color    : labelColor,
            font     : { size: 10, family: "'Plus Jakarta Sans', sans-serif" },
            boxWidth : 12,
            padding  : 10
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              if (val === null || val === undefined) return null;
              return ` ${ctx.dataset.label}: ${val.toFixed(2)} ${yUnit}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid  : { color: CHART_COLORS.grid },
          ticks : {
            color   : labelColor,
            font    : { size: 9 },
            maxRotation: 0 // Horizontal label untuk telefon
          }
        },
        y: {
          grid  : { color: CHART_COLORS.grid },
          ticks : {
            color    : labelColor,
            font     : { size: 9 },
            callback : v => v >= 1000 ? (v/1000).toFixed(1)+"k" : v
          }
        }
      }
    }
  };
}

/**
 * Render stats ringkas di bawah graf (max, min, jumlah).
 */
function _renderChartStats(payload) {
  const container = document.getElementById("chart-stats");
  const type      = _chartState.type;
  const tahun     = _chartState.tahun;

  let values = [];
  let unit   = "";

  if (type === "hasil") {
    values = payload.hasil.capaiIni.filter(v => v !== null);
    unit   = "Tan";
  } else if (type === "pusTuai") {
    values = payload.pusTuai.hektarBulan.filter(v => v !== null);
    unit   = "Ha";
  } else if (type === "muda") {
    values = payload.muda.total.filter(v => v !== null);
    unit   = "Tdn";
  } else if (type === "mengkal") {
    values = payload.mengkal.total.filter(v => v !== null);
    unit   = "Tdn";
  }

  if (!values.length) {
    container.innerHTML = "";
    return;
  }

  const jumlah  = values.reduce((s, v) => s + v, 0);
  const maxVal  = Math.max(...values);
  const minVal  = Math.min(...values);

  const stats = [
    { label: "Jumlah YTD",   val: jumlah.toFixed(2),  unit },
    { label: "Bulan Terbaik", val: maxVal.toFixed(2), unit },
    { label: "Bulan Terendah",val: minVal.toFixed(2), unit }
  ];

  container.innerHTML = stats.map(s => `
    <div style="background:var(--input-bg);padding:12px 8px;
                border-radius:12px;text-align:center;
                border:1px solid var(--border);">
      <div style="font-size:9px;font-weight:800;color:var(--text-muted);
                  text-transform:uppercase;margin-bottom:4px;">
        ${s.label}
      </div>
      <div style="font-size:15px;font-weight:900;color:var(--primary);">
        ${s.val}
      </div>
      <div style="font-size:9px;color:var(--text-muted);font-weight:700;">
        ${s.unit}
      </div>
    </div>
  `).join("");
}

// ============================================================================
// RENDER HELPERS — DROPDOWN & TABS
// ============================================================================

function _renderChartPktDropdown() {
  const sel = document.getElementById("chart-pkt");
  sel.innerHTML = CHART_PKT_LIST
    .map(p => `<option value="${p}">${p}</option>`)
    .join("");
  sel.value = _chartState.pkt;
}

function _renderChartTahunDropdown() {
  const sel      = document.getElementById("chart-tahun");
  const tahunIni = new Date().getFullYear();
  sel.innerHTML  = [tahunIni, tahunIni - 1, tahunIni - 2]
    .map(y => `<option value="${y}">${y}</option>`)
    .join("");
  sel.value = _chartState.tahun;
}

function _renderChartTabs() {
  const container = document.getElementById("chart-tabs");
  container.innerHTML = CHART_TYPES.map(t => `
    <button onclick="onChartTabChange('${t.key}')"
            id="tab-${t.key}"
            style="flex-shrink:0;width:auto;padding:8px 14px;
                   font-size:11px;border-radius:20px;
                   background:${_chartState.type === t.key ? 'var(--primary)' : 'var(--input-bg)'};
                   color:${_chartState.type === t.key ? '#fff' : 'var(--text-muted)'};
                   border:1px solid ${_chartState.type === t.key ? 'var(--primary)' : 'var(--border)'};
                   font-weight:900;">
      ${t.label}
    </button>
  `).join("");
}

function onChartTabChange(type) {
  _chartState.type = type;
  _renderChartTabs();
  if (_chartDataCache) {
    _renderChart(_chartDataCache);
    _renderChartStats(_chartDataCache);
  }
}

function _showChartLoader(show) {
  const loader = document.getElementById("chart-loader");
  if (loader) loader.style.display = show ? "flex" : "none";
}

function _showChartError(msg) {
  _showChartLoader(false); // ← pastikan loader sentiasa tersembunyi
  const canvas = document.getElementById("mainChart");
  if (!canvas) return;
  if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById("chart-stats").innerHTML = `
    <div style="grid-column:span 3;text-align:center;
                padding:20px;color:var(--danger);font-weight:800;">
      ${msg}
    </div>`;
}
