/**
 * ============================================================================
 * CONFIG.JS — KONFIGURASI FRONTEND e-HASIL FPMSB TENANG
 * ============================================================================
 * Semua constant, mapping, dan URL API untuk frontend PWA.
 * Dipisah dari app.js supaya mudah dikemaskini tanpa kacau logic.
 *
 * UNTUK KEMASKINI API URL:
 *   Tukar nilai API_URL di bawah sahaja apabila Web App di-redeploy.
 * ============================================================================
 */


// ============================================================================
// 1. API ENDPOINT
// ============================================================================

const API_URL = "https://script.google.com/macros/s/AKfycbyGcP-WcSbJfKf6M5f9fcY1wsZQn4ZPc_KE1Ndq9vekJXOrm4-dvCqubs6F2zsX0Ppu3A/exec";


// ============================================================================
// 2. KONFIGURASI PERINGKAT & TEAM
// ============================================================================

/**
 * Konfigurasi untuk modul Input Hasil.
 * pkt      : Senarai semua peringkat termasuk RUMUSAN
 * teams    : Nama team/blok untuk setiap PKT berbilang kolum
 *            PKT001 & RUMUSAN tidak disertakan — mereka ada satu input sahaja
 */
const HASIL_CFG = {
  pkt: ["PKT004", "PKT001", "PKT002", "PKT001G", "PKT003G", "RUMUSAN"],
  teams: {
    PKT004  : ["BLOK 1", "BLOK 2", "BLOK 3", "BLOK 4", "BLOK 5"],
    PKT002  : ["TEAM PKT", "TEAM 1", "TEAM 2", "TEAM TKA", "TEAM TKA BAJA"],
    PKT001G : ["HABIBI", "P.BOWO", "MEGA", "TEAM TKA", "TEAM TKA BAJA"],
    PKT003G : ["TEAM KIRI", "TEAM KANAN", "TEAM BLOK C", "TEAM TKA", "TEAM TKA BAJA"]
  }
};

/**
 * Konfigurasi untuk modul BTB Muda.
 * PKT001 tidak ada dalam muda — sengaja dikecualikan.
 * PKT004 dalam muda dipanggil PKT004A (mapping backend berbeza).
 */
const MUDA_CFG = {
  PKT001G : ["HABIBI", "P.BOWO", "MEGA", "TKA"],
  PKT002  : ["TEAM PKT", "TEAM 1", "TEAM 2", "TKA"],
  PKT003G : ["KIRI", "KANAN", "BLOK C", "TKA"],
  PKT004A : ["BLOK 1", "BLOK 2", "BLOK 3", "BLOK 4", "BLOK 5"]
};

/**
 * Konfigurasi untuk modul Rekod Tandan Harian.
 */
const TANDAN_CFG = {
  PKT004  : ["BLOK 1", "BLOK 2", "BLOK 3", "BLOK 4", "BLOK 5"],
  PKT001  : ["TKA"],
  PKT002  : ["TEAM PKT", "TEAM 1", "TEAM 2"],
  PKT001G : ["HABIBI", "P.BOWO", "MEGA"],
  PKT003G : ["KIRI", "KANAN", "BLOK C", "TKA"]
};

/**
 * Konfigurasi untuk modul Penalti.
 * Jenis: MENGKAL atau LAMA
 */
const PENALTI_PKT = ["PKT001", "PKT001G", "PKT002", "PKT003G", "PKT004"];


// ============================================================================
// 3. WARNA PROGRESS BAR DASHBOARD
// ============================================================================

/**
 * Threshold warna progress bar berdasarkan peratus capai.
 * Nilai pct adalah 0-100 (sudah didarab 100).
 */
const PROGRESS_COLOR = {
  GREEN  : "linear-gradient(90deg, #05cd99, #02a176)",  // ≥ 90%
  YELLOW : "linear-gradient(90deg, #ffb547, #e0921f)",  // ≥ 80%
  RED    : "linear-gradient(90deg, #ee5d50, #c93b2e)"   // < 80%
};


// ============================================================================
// 4. KONFIGURASI TEMA
// ============================================================================

/**
 * Key localStorage untuk simpan pilihan tema pengguna.
 * Nilai: 'dark' | 'light' | null (ikut OS)
 */
const THEME_KEY = "eh_tema";