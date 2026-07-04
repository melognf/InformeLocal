/* =========================
   InformePorTurno — LOCAL (sin Firebase)
   - Persistencia: localStorage por dispositivo
   - PDF: html2canvas + jsPDF (CDN)
   ========================= */

window.syncNow = window.syncNow || function(){};

/* ======== Fecha / Día automático ======== */
function parseDateLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const fecha = document.getElementById("fecha");
const dia   = document.getElementById("dia");

fecha?.addEventListener("change", () => {
  const f = parseDateLocal(fecha.value);
  if (dia) dia.value = f ? dias[f.getDay()] : "";
});

window.addEventListener("load", () => {
  if (fecha?.value) {
    const f = parseDateLocal(fecha.value);
    if (dia) dia.value = f ? dias[f.getDay()] : "";
  }
});

/* ======== Turnos (2 o 3 por día) ======== */
const MODOS_TURNO = {
  "2": {
    opciones: [
      { tn: "TM", rango: "06-18", start: 6,  dur: 720 },
      { tn: "TN", rango: "18-06", start: 18, dur: 720 },
    ]
  },
  "3": {
    opciones: [
      { tn: "TM", rango: "06-14", start: 6,  dur: 480 },
      { tn: "TT", rango: "14-22", start: 14, dur: 480 },
      { tn: "TN", rango: "22-06", start: 22, dur: 480 },
    ]
  }
};

const RANGO_LABELS = {
  "06-18": "06:00 → 18:00",
  "18-06": "18:00 → 06:00",
  "06-14": "06:00 → 14:00",
  "14-22": "14:00 → 22:00",
  "22-06": "22:00 → 06:00",
};

const RANGOS = {};
Object.values(MODOS_TURNO).forEach(m => m.opciones.forEach(o => { RANGOS[o.rango] = o; }));

function getModoTurno() {
  return document.getElementById("modoTurno")?.value === "3" ? "3" : "2";
}

function rangoInfo(rangoId) {
  return RANGOS[rangoId] || RANGOS["06-18"];
}

function rangoFinHora(rangoId) {
  const info = rangoInfo(rangoId);
  return (info.start + info.dur / 60) % 24;
}

function rangoEnvuelveMedianoche(rangoId) {
  return rangoFinHora(rangoId) <= rangoInfo(rangoId).start;
}

function tnToRango(tn, modo) {
  const m = MODOS_TURNO[modo] || MODOS_TURNO["2"];
  const found = m.opciones.find(o => o.tn === tn);
  return found ? found.rango : m.opciones[0].rango;
}

// Válido en ambos extremos (incluye la hora exacta de cierre del turno)
function horaEnRangoInclusiva(h, rangoId) {
  const info = rangoInfo(rangoId);
  const end = rangoFinHora(rangoId);
  if (info.start < end) return h >= info.start && h <= end;
  return (h >= info.start && h <= 23) || (h >= 0 && h <= end);
}

// Excluye la hora exacta de cierre del turno
function horaEnRangoExclusiva(h, rangoId) {
  const info = rangoInfo(rangoId);
  const end = rangoFinHora(rangoId);
  if (info.start < end) return h >= info.start && h < end;
  return (h >= info.start && h <= 23) || (h >= 0 && h < end);
}

function buildTnOptions() {
  const sel = document.getElementById("tn");
  if (!sel) return;
  const modo = getModoTurno();
  const prev = sel.value;
  sel.innerHTML = `<option value=""></option>` +
    MODOS_TURNO[modo].opciones.map(o => `<option>${o.tn}</option>`).join("");
  const sigueValido = Array.from(sel.options).some(o => o.value === prev);
  sel.value = sigueValido ? prev : "";
}

function buildRangoOptions() {
  const sel = document.getElementById("cgRango");
  if (!sel) return;
  const modo = getModoTurno();
  const tn = document.getElementById("tn")?.value || "";
  sel.innerHTML = MODOS_TURNO[modo].opciones
    .map(o => `<option value="${o.rango}">${RANGO_LABELS[o.rango]}</option>`)
    .join("");
  sel.value = tnToRango(tn, modo);
}

/* ======== Cronograma ======== */
const CG_STATE_KEY = 'cronograma_v1';

const cg = {
  rango: '06-18',
  toMin(hhmm) {
    const [h,m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  },
  relMin(hhmm, rango) {
    const m = this.toMin(hhmm);
    const info = rangoInfo(rango);
    let rel = m - info.start * 60;
    if (rel < 0) rel += 24 * 60;
    return rel;
  }
};

function saveCgState() {
  const rango = document.getElementById('cgRango')?.value || '06-18';
  localStorage.setItem(CG_STATE_KEY, JSON.stringify({ rango }));
}

function restoreCgState() {
  const saved = JSON.parse(localStorage.getItem(CG_STATE_KEY) || '{}');
  const rangoSel = document.getElementById('cgRango');
  if (rangoSel && saved.rango) {
    rangoSel.value = saved.rango;
  }
}

function cgBuildAxis() {
  const eje = document.getElementById('cgEje');
  if (!eje) return;

  eje.innerHTML = '';
  const rango = document.getElementById('cgRango')?.value || '06-18';
  const info = rangoInfo(rango);
  const horas = [];

  for (let i = 0; i < info.dur / 60; i++) horas.push((info.start + i) % 24);
  window.cgStartHour = info.start;
  window.cgDurMin = info.dur;

  const total = horas.length;
  eje.style.gridTemplateColumns = `repeat(${total}, 1fr)`;
  horas.forEach((h, i) => {
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.textContent = window.innerWidth < 768 ? `${h}` : `${String(h).padStart(2,'0')}:00`;
    lab.style.flex = i === total - 1 ? '0 0 auto' : '1';
    eje.appendChild(lab);
  });
}

function adjustLaneHeight(lane) {
  lane.style.height = "40px";
}

function isLectura() {
  const btn = document.getElementById("modeBtn");
  return !!btn && btn.classList.contains("is-lectura");
}

function updateBarDeleteVisibility(show) {
  document.querySelectorAll(".cg-bar .cg-bar-close").forEach(btn => {
    btn.classList.toggle("is-hidden", !show);
  });
}

function removeCorrida(linea, inicio, fin, sabor, color) {
  const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
  const next = saved.filter(c => !(c.linea == linea && c.inicio == inicio && c.fin == fin && c.sabor == sabor && c.color == color));
  localStorage.setItem("corridas", JSON.stringify(next));
}

function cgAddBar(linea, inicio, fin, sabor, color = "rojo", restored = false) {
  const lane = document.querySelector(`.cg-lane[data-linea="${linea}"]`);
  if (!lane) return;

  const rangeText = `${inicio}|${fin}`;

  Array.from(lane.querySelectorAll(".cg-bar")).forEach(b => {
    if (b.dataset.timeRange === rangeText && b.dataset.sabor === sabor) b.remove();
  });

  const [iniH, iniM] = inicio.split(":").map(Number);
  const [finH, finM] = fin.split(":").map(Number);
  const iniMin = iniH * 60 + iniM;
  const finMin = finH * 60 + finM;

  const total = window.cgDurMin || 720;
  const startRange = (window.cgStartHour ?? 6) * 60;

  let startMin, endMin;
  const wrap = (startRange + total) % 1440 > startRange;

  if (wrap) {
    startMin = iniMin - startRange;
    endMin = finMin - startRange;
  } else {
    startMin = (iniMin >= startRange) ? iniMin - startRange : (1440 - startRange) + iniMin;
    endMin = (finMin >= startRange) ? finMin - startRange : (1440 - startRange) + finMin;
  }

  startMin = Math.max(0, startMin);
  endMin = Math.min(total, endMin);

  const left = (startMin / total) * 100;
  const width = Math.max(1, ((endMin - startMin) / total) * 100);

  const bar = document.createElement("div");
  bar.className = `cg-bar cg-bar-${color}`;
  bar.dataset.timeRange = rangeText;
  bar.dataset.sabor = sabor;
  bar.dataset.linea = linea;
  bar.dataset.color = color;

  bar.style.left = `${left}%`;
  bar.style.width = `${width}%`;

  const btn = document.createElement("button");
  btn.className = "cg-bar-close";
  btn.textContent = "×";
  if (isLectura()) btn.classList.add("is-hidden");

  btn.addEventListener("click", () => {
    bar.remove();
    removeCorrida(linea, inicio, fin, sabor, color);
  });

  bar.appendChild(btn);
  bar.appendChild(document.createTextNode(sabor));
  lane.appendChild(bar);

  if (!restored) {
    const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
    saved.push({ linea, inicio, fin, sabor, color });
    localStorage.setItem("corridas", JSON.stringify(saved));
  }
}

function cgClear() {
  if (!confirm("¿Borrar todas las corridas del gráfico?")) return;

  document.querySelectorAll('.cg-lane').forEach(lane => {
    lane.innerHTML = '';
    lane.style.height = '40px';
  });

  ["corridas", CG_STATE_KEY].forEach(k => localStorage.removeItem(k));
  setTimeout(() => document.querySelectorAll('.cg-lane').forEach(l => l.innerHTML = ''), 100);
}

function restoreCorridas() {
  document.querySelectorAll('.cg-lane').forEach(l => l.innerHTML = '');
  const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
  saved.forEach(c => cgAddBar(c.linea, c.inicio, c.fin, c.sabor, c.color || "rojo", true));
  updateBarDeleteVisibility(!isLectura());

  document.querySelectorAll(".cg-lane").forEach(lane => adjustLaneHeight(lane));

  document.querySelectorAll(".cg-lane").forEach(lane => {
    const bars = lane.querySelectorAll(".cg-bar");
    bars.forEach((bar, i) => bar.style.top = `${8 + i * 28}px`);
    adjustLaneHeight(lane);
  });
}

function cgInit() {
  restoreCgState();
  cgBuildAxis();
  restoreCorridas();
  buildNvHoraOptions();
  renderNovedades();

  renderProdTurno();

  const rangoSel = document.getElementById('cgRango');
  rangoSel?.addEventListener('change', () => {
    saveCgState();
    cgBuildAxis();
    restoreCorridas();
    buildNvHoraOptions();
    renderNovedades();
  });

  window.addEventListener('resize', () => {
    cgBuildAxis();
    restoreCorridas();
  });
}
document.addEventListener('DOMContentLoaded', cgInit);

/* ======== Form cronograma ======== */
const form = document.getElementById('formBarra');
const cgLinea = document.getElementById('cgLinea');
const cgSabor = document.getElementById('cgSabor');
const cgInicio = document.getElementById('cgInicio');
const cgFin = document.getElementById('cgFin');
const cgClearBtn = document.getElementById('cgClear');

form?.addEventListener('submit', e => {
  e.preventDefault();

  const linea = cgLinea?.value;
  const sabor = (cgSabor?.value || '').trim();
  const ini = cgInicio?.value;
  const fin = cgFin?.value;
  const rango = document.getElementById("cgRango")?.value || "06-18";

  if (!linea || !sabor || !ini || !fin) {
    alert('Por favor completá todos los campos.');
    return;
  }

  const iniH = parseInt(ini.split(':')[0], 10);
  const finH = parseInt(fin.split(':')[0], 10);

  if (!horaEnRangoExclusiva(iniH, rango) || !horaEnRangoInclusiva(finH, rango)) {
    const info = rangoInfo(rango);
    const iniLabel = String(info.start).padStart(2, '0') + ':00';
    const finLabel = String(rangoFinHora(rango)).padStart(2, '0') + ':00';
    alert(`⚠️ Los horarios deben estar entre ${iniLabel} y ${finLabel}.`);
    return;
  }

  const color = document.getElementById("cgColor")?.value || "rojo";
  cgAddBar(linea, ini, fin, sabor, color);
  form.reset();
});

/* =========================
   NOVEDADES (localStorage)
   ========================= */
const FORM_KEY = "novedades_v1";

const MICRO_KEY = "micro_paradas_v1";
const MICRO_DISP_KEY = "micro_disponible_v1";
const CIERRES_KEY = "cierres_v1";
const RESUMEN_OCULTO_KEY = "resumen_turno_oculto_v1";
let _eficChart = null;

function isResumenTurnoOculto() {
  return localStorage.getItem(RESUMEN_OCULTO_KEY) === "1";
}

function setResumenTurnoOculto(oculto) {
  if (oculto) localStorage.setItem(RESUMEN_OCULTO_KEY, "1");
  else localStorage.removeItem(RESUMEN_OCULTO_KEY);
}

const LINEAS_PRODUCCION = ["LÍNEA 1", "LÍNEA 2", "LÍNEA 3", "LÍNEA 5", "LÍNEA 6", "LÍNEA 7"];

// Umbral de eficiencia (rojo/verde, sin amarillo) por línea, solo para Resumen del Turno.
// LÍNEA 5 y 6 no figuran a propósito: no se cargan tiempos ahí, se ignoran en el resumen.
const UMBRAL_EFICIENCIA_POR_LINEA = {
  "LÍNEA 1": 47,
  "LÍNEA 2": 60,
  "LÍNEA 3": 63,
  "LÍNEA 7": 60,
};

const TIPOS_MICRO = {
  mecanica:      { icono: "🔧", label: "MECÁNICA" },
  electrica:     { icono: "⚡", label: "ELÉCTRICA" },
  operativa:     { icono: "👷", label: "OPERATIVA" },
  calidad:       { icono: "⚠️", label: "CALIDAD" },
  materias:      { icono: "📦", label: "MAT. PRIMAS" },
  soplado:       { icono: "💨", label: "SOPLADO" },
  ajenos:        { icono: "🔀", label: "AJENOS" },
  cip:           { icono: "🧹", label: "CIP" },
  arranque:      { icono: "🟡", label: "ARRANQUE" },
  mantenimiento: { icono: "🟫", label: "MANTENIMIENTO" },
};

function comprimirImagen(file, maxW = 1200, quality = 0.72) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function abrirLightbox(src) {
  document.getElementById("nv-lightbox")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "nv-lightbox";
  overlay.className = "nv-lightbox";
  overlay.addEventListener("click", () => overlay.remove());
  const img = document.createElement("img");
  img.src = src;
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

const TIPOS_NOVEDAD = {
  mecanica:  { icono: "🔧", label: "PARO DE EQUIPO — MECÁNICA",        color: "red"    },
  electrica: { icono: "⚡", label: "PARO DE EQUIPO — ELÉCTRICA",        color: "red"    },
  operativa: { icono: "👷", label: "PARADA OPERATIVA",                   color: "orange" },
  calidad:   { icono: "⚠️", label: "DESVÍO DE CALIDAD",                 color: "orange" },
  materias:  { icono: "📦", label: "CALIDAD DEFICIENTE DE MAT. PRIMAS", color: "yellow" },
  soplado:   { icono: "💨", label: "SOPLADO",                            color: "blue"   },
  ajenos:    { icono: "🔀", label: "AJENOS",                             color: "blue"   },
};

const formNovedad = document.getElementById("formNovedad");
const nvLinea = document.getElementById("nvLinea");
const nvTexto = document.getElementById("nvTexto");
const nvClear = document.getElementById("nvClear");

(function ensureNvHoraSelect(){
  const el = document.getElementById("nvHora");
  if (!el) return;
  if (el.tagName.toLowerCase() === "select") return;
  const sel = document.createElement("select");
  sel.id = el.id;
  if (el.hasAttribute("required")) sel.setAttribute("required", "");
  el.parentNode.replaceChild(sel, el);
})();

function buildNvHoraOptions() {
  const sel = document.getElementById("nvHora");
  const rangoSel = document.getElementById("cgRango");
  if (!sel || !rangoSel) return;

  const rango = rangoSel.value;
  const info = rangoInfo(rango);
  const end = rangoFinHora(rango);
  const opts = [];
  const horas = [];

  if (info.start < end) {
    for (let h = info.start; h < end; h++) horas.push(h);
  } else {
    for (let h = info.start; h <= 23; h++) horas.push(h);
    for (let h = 0; h <= end; h++) horas.push(h);
  }
  horas.forEach(h => {
    const v = String(h).padStart(2, "0") + ":00";
    opts.push(`<option value="${v}">${v}</option>`);
  });

  const prev = sel.value;
  sel.innerHTML = opts.join("");
  const still = Array.from(sel.options).some(o => o.value === prev);
  sel.value = still ? prev : (sel.options[0]?.value || "");
}

document.addEventListener("DOMContentLoaded", () => {
  buildNvHoraOptions();
  renderNovedades();

  document.getElementById("nvRequiereAccion")?.addEventListener("change", function () {
    const show = this.checked;
    document.getElementById("accionResponsableWrap").style.display = show ? "" : "none";
    document.getElementById("accionDescWrap").style.display = show ? "" : "none";
  });
});

document.getElementById("cgRango")?.addEventListener("change", () => {
  buildNvHoraOptions();
  renderNovedades();
});

let NV_EDITING = false;

function rangoActual() {
  const v = document.getElementById("cgRango")?.value;
  return RANGOS[v] ? v : "06-18";
}

function horaEnPuntoValida(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [h, m] = hhmm.split(":").map(Number);
  if (m !== 0) return false;
  return horaEnRangoInclusiva(h, rangoActual());
}

function ordenHoraParaRango(hora) {
  if (!hora) return 999;
  const h = parseInt(hora.split(":")[0], 10);
  const rango = rangoActual();
  const info = rangoInfo(rango);
  const end = rangoFinHora(rango);

  if (info.start <= end) {
    if (h >= info.start && h <= end) return h - info.start;
    return 999;
  }

  if (h >= info.start) return h - info.start;
  if (h <= end) return h + (24 - info.start);
  return 999;
}

function sortNovedadesArray(list) {
  list.sort((a, b) => {
    const la = (a.linea || "");
    const lb = (b.linea || "");
    if (la !== lb) return la.localeCompare(lb);

    const ha = ordenHoraParaRango(a.hora || "");
    const hb = ordenHoraParaRango(b.hora || "");
    if (ha !== hb) return ha - hb;
    return (a.hora || "").localeCompare(b.hora || "");
  });
}

function ensureNvControls() {
  const cont = document.querySelector(".novedades");
  if (!cont || cont.querySelector(".nv-actions")) return;

  const bar = document.createElement("div");
  bar.className = "nv-actions";
  bar.style.display = "flex";
  bar.style.gap = "8px";
  bar.style.padding = "10px";
  bar.style.borderTop = "1px solid #000";
  bar.style.background = "#f1f1f1";

  const btnEditAll = document.createElement("button");
  btnEditAll.id = "nvEditAll";
  btnEditAll.type = "button";
  btnEditAll.textContent = "Editar novedades";

  const btnSaveAll = document.createElement("button");
  btnSaveAll.id = "nvSaveAll";
  btnSaveAll.type = "button";
  btnSaveAll.textContent = "Guardar";

  const btnCancelAll = document.createElement("button");
  btnCancelAll.id = "nvCancelAll";
  btnCancelAll.type = "button";
  btnCancelAll.textContent = "Cancelar";

  [btnEditAll, btnSaveAll, btnCancelAll].forEach(b => {
    b.style.background = "#e10600";
    b.style.color = "#fff";
    b.style.border = "0";
    b.style.borderRadius = "8px";
    b.style.padding = "8px 12px";
    b.style.fontWeight = "700";
    b.style.cursor = "pointer";
  });
  btnEditAll.style.background = "#3e3e3e";
  btnCancelAll.style.background = "#555";

  bar.appendChild(btnEditAll);
  bar.appendChild(btnSaveAll);
  bar.appendChild(btnCancelAll);

  const isLecturaNow = document.getElementById("modeBtn")?.classList.contains("is-lectura");
  bar.style.display = isLecturaNow ? "none" : "flex";

  cont.insertBefore(bar, cont.querySelector(".linea-card"));

  btnEditAll.addEventListener("click", enterNvEditMode);
  btnSaveAll.addEventListener("click", saveNvEdits);
  btnCancelAll.addEventListener("click", cancelNvEdits);
}

function enterNvEditMode() {
  NV_EDITING = true;

  document.querySelectorAll(".linea-card li").forEach(li => {
    const linea = li.closest(".linea-card")?.querySelector("h3")?.firstChild?.textContent.trim() || "";
    const originalHeight = Math.max(60, Math.round(li.getBoundingClientRect().height));

    const horaActual = li.dataset.hora || li.querySelector("b")?.textContent.replace(/:$/, "").trim() || "06:00";
    const textoActual = li.dataset.texto || li.querySelector(".nv-text")?.textContent || "";
    const tipoActual = li.dataset.tipo || "";
    const minutosActual = li.dataset.minutos || "0";

    li.dataset.originalLinea = linea;
    li.dataset.originalHora = horaActual;
    li.dataset.originalTexto = textoActual;
    li.dataset.originalTipo = tipoActual;
    li.dataset.originalMinutos = minutosActual;

    li.className = "editing";
    li.innerHTML = "";

    const selTipo = document.createElement("select");
    selTipo.className = "nv-edit-tipo";
    selTipo.innerHTML = `<option value="">— Sin clasificar —</option>` +
      Object.entries(TIPOS_NOVEDAD).map(([val, { icono, label }]) =>
        `<option value="${val}">${icono} ${label}</option>`
      ).join("");
    selTipo.value = tipoActual;

    const inHora = document.createElement("input");
    inHora.type = "time";
    inHora.step = 3600;
    inHora.value = horaActual;
    inHora.className = "nv-edit-time";

    const validateHourInput = () => {
      const ok = horaEnPuntoValida(inHora.value);
      inHora.style.outline = ok ? "2px solid transparent" : "2px solid #e10600";
      return ok;
    };
    inHora.addEventListener("input", validateHourInput);
    setTimeout(validateHourInput, 0);

    const ta = document.createElement("textarea");
    ta.className = "nv-edit-text";
    ta.value = textoActual;
    ta.style.height = originalHeight + "px";

    const autoGrow = () => {
      ta.style.height = "auto";
      ta.style.height = Math.max(originalHeight, ta.scrollHeight) + "px";
    };
    ta.addEventListener("input", autoGrow);
    setTimeout(autoGrow, 0);

    const inMin = document.createElement("input");
    inMin.type = "number";
    inMin.min = "0";
    inMin.max = "720";
    inMin.placeholder = "0";
    inMin.value = minutosActual !== "0" ? minutosActual : "";
    inMin.className = "nv-edit-min";

    li.appendChild(selTipo);
    li.appendChild(inHora);
    li.appendChild(inMin);
    li.appendChild(ta);
  });
}

function saveNvEdits() {
  if (!NV_EDITING) return;

  const items = Array.from(document.querySelectorAll(".linea-card li.editing"));
  const list = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");

  for (const li of items) {
    const inHora = li.querySelector('input[type="time"]');
    const ta = li.querySelector('textarea');
    if (!inHora || !ta) continue;

    const selTipo = li.querySelector("select.nv-edit-tipo");
    const inMin = li.querySelector("input.nv-edit-min");
    const oldLinea = li.dataset.originalLinea || "";
    const oldHora = li.dataset.originalHora || "";
    const oldTexto = li.dataset.originalTexto || "";

    const newHora = (inHora.value || "").trim();
    const newTexto = (ta.value || "").trim();
    const newTipo = selTipo?.value || "";
    const newMinutos = parseInt(inMin?.value || "0", 10) || 0;

    if (!newTexto) {
      alert("Hay una novedad sin descripción.");
      ta.focus();
      return;
    }
    if (!horaEnPuntoValida(newHora)) {
      alert("Hay una hora fuera de la franja o no es 'en punto'.");
      inHora.focus();
      return;
    }

    const idx = list.findIndex(nv => nv.linea === oldLinea && nv.hora === oldHora && nv.texto === oldTexto);
    if (idx !== -1) {
      list[idx].hora     = newHora;
      list[idx].texto    = newTexto;
      list[idx].tipo     = newTipo;
      list[idx].minutos  = newMinutos;
      // accion no se toca — solo se modifica desde el formulario o el botón banderín
    } else {
      list.push({ linea: oldLinea, hora: newHora, texto: newTexto, tipo: newTipo, minutos: newMinutos, accion: null });
    }
  }

  sortNovedadesArray(list);
  localStorage.setItem(FORM_KEY, JSON.stringify(list));

  NV_EDITING = false;
  renderNovedades();
}

function cancelNvEdits() {
  NV_EDITING = false;
  renderNovedades();
}

function renderNovedades() {
  ensureNvControls();

  const bar = document.querySelector(".nv-actions");
  const isLectura = document.getElementById("modeBtn")?.classList.contains("is-lectura");
  if (bar) bar.style.display = isLectura ? "none" : "flex";

  const cards = Array.from(document.querySelectorAll(".linea-card"));

  cards.forEach(card => {
    const ul = card.querySelector("ul");
    if (ul) ul.innerHTML = "";
  });

  const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  sortNovedadesArray(saved);

  saved.forEach(({ linea, hora, texto, tipo, minutos, accion, imagenes }) => {
    const card = cards.find(c => c.querySelector("h3")?.firstChild?.textContent.trim() === linea);
    if (!card) return;

    const ul = card.querySelector("ul");
    if (!ul) return;

    const tipoInfo = TIPOS_NOVEDAD[tipo] || null;
    const min = Number(minutos) || 0;

    const li = document.createElement("li");
    li.dataset.linea = linea;
    li.dataset.hora = hora;
    li.dataset.texto = texto;
    li.dataset.tipo = tipo || "";
    li.dataset.minutos = min;
    if (tipoInfo) li.classList.add(`nv-tipo-${tipoInfo.color}`);

    const b = document.createElement("b");
    b.textContent = `${hora}:`;

    const spanIcono = document.createElement("span");
    spanIcono.className = "nv-icono";
    spanIcono.textContent = tipoInfo ? tipoInfo.icono : "";

    const spanTxt = document.createElement("span");
    spanTxt.className = "nv-text";
    spanTxt.textContent = texto;

    const spanMin = document.createElement("span");
    spanMin.className = "nv-min";
    spanMin.textContent = min > 0 ? `${min} min` : "";

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "nv-del";
    btnDel.textContent = "×";
    btnDel.title = "Eliminar novedad";
    btnDel.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("¿Eliminar esta novedad?")) deleteNovedad(linea, hora, texto);
    });

    if (isLectura) btnDel.style.display = "none";

    const tieneAccion = !!(accion && (accion.responsable || accion.texto || accion.om));

    const btnFlag = document.createElement("button");
    btnFlag.type = "button";
    btnFlag.className = "btn-flag activo";
    btnFlag.textContent = "🚩";
    btnFlag.title = "Quitar acción requerida";
    if (!tieneAccion) btnFlag.style.display = "none";
    btnFlag.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm("¿Quitar la acción requerida de esta novedad?")) return;
      const list = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
      const nv = list.find(n => n.linea === linea && n.hora === hora && n.texto === texto);
      if (!nv) return;
      nv.accion = null;
      localStorage.setItem(FORM_KEY, JSON.stringify(list));
      renderNovedades();
    });

    const mainRow = document.createElement("div");
    mainRow.className = "nv-main-row";
    mainRow.appendChild(b);
    mainRow.appendChild(spanIcono);
    mainRow.appendChild(spanTxt);
    mainRow.appendChild(spanMin);
    mainRow.appendChild(btnFlag);
    mainRow.appendChild(btnDel);
    li.appendChild(mainRow);

    const imgs = Array.isArray(imagenes) ? imagenes : [];
    if (imgs.length > 0) {
      li.classList.add(imgs.length === 1 ? "nv-has-img" : "nv-has-multi-img");
      const divImgs = document.createElement("div");
      divImgs.className = "nv-imgs-full";
      imgs.forEach(src => {
        const img = document.createElement("img");
        img.src = src;
        img.className = "nv-img-full";
        img.addEventListener("click", (e) => {
          e.stopPropagation();
          abrirLightbox(src);
        });
        divImgs.appendChild(img);
      });
      li.appendChild(divImgs);
    }

    ul.appendChild(li);
  });

  renderSemaforo();
  renderAcciones();

  cards.forEach(card => {
    const ul = card.querySelector("ul");
    const tieneItems = !!ul && ul.children.length > 0;

    if (isLectura) {
      card.style.display = tieneItems ? "" : "none";
    } else {
      card.style.display = "";
    }
  });

  const seccionNovedades = document.getElementById("novedades");
  const hayAlgunaVisible = cards.some(card => card.style.display !== "none");

  if (seccionNovedades && isLectura) {
    seccionNovedades.style.display = hayAlgunaVisible ? "" : "none";
  } else if (seccionNovedades) {
    seccionNovedades.style.display = "";
  }

  renderResumenTurno();
}

/* ======== Semáforo de líneas ======== */
const SECTORES_SEMAFORO = [
  { id: "LÍNEA 1",      label: "LÍNEA 1",   grupo: "lineas" },
  { id: "LÍNEA 2",      label: "LÍNEA 2",   grupo: "lineas" },
  { id: "LÍNEA 3",      label: "LÍNEA 3",   grupo: "lineas" },
  { id: "LÍNEA 5",      label: "LÍNEA 5",   grupo: "lineas" },
  { id: "LÍNEA 6",      label: "LÍNEA 6",   grupo: "lineas" },
  { id: "LÍNEA 7",      label: "LÍNEA 7",   grupo: "lineas" },
  { id: "SOPLADO",      label: "SOPLADO",   grupo: "otros"  },
  { id: "ELABORACIÓN",  label: "ELABOR.",   grupo: "otros"  },
  { id: "AUXILIARES",   label: "AUXIL.",    grupo: "otros"  },
  { id: "A & E",        label: "A & E",     grupo: "otros"  },
  { id: "PLANEAMIENTO", label: "PLANEA.",   grupo: "otros"  },
];

const SEVERITY_ORDER = {
  mecanica: 4, electrica: 4,
  operativa: 3, calidad: 3,
  materias: 2,
  soplado: 1, ajenos: 1,
  "": 0
};

function getSemaforoColor(totalMin, worstSeverity, durMin) {
  if (worstSeverity === 0) return "verde";

  if (totalMin > 0) {
    const efic = ((durMin - totalMin) / durMin) * 100;
    if (efic < 50) return "rojo";
    if (efic <= 75) return "amarillo";
    return "verde";
  }

  if (worstSeverity >= 4) return "rojo";
  if (worstSeverity === 3) return "naranja";
  if (worstSeverity === 2) return "amarillo";
  return "azul";
}

function renderSemaforo() {
  const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  const durMin = rangoInfo(document.getElementById("cgRango")?.value || "06-18").dur;

  document.querySelectorAll(".linea-card").forEach(card => {
    const h3 = card.querySelector("h3");
    if (!h3) return;

    const linea = h3.firstChild?.textContent.trim() || "";
    h3.querySelector(".semaforo-dot")?.remove();

    const novedades = saved.filter(n => n.linea === linea);
    if (novedades.length === 0) return;

    const totalMin = novedades.reduce((s, n) => s + (Number(n.minutos) || 0), 0);

    const minByTipo = {};
    novedades.forEach(n => {
      const t = n.tipo || "";
      minByTipo[t] = (minByTipo[t] || 0) + (Number(n.minutos) || 0);
    });

    const tipoConMasMin = Object.entries(minByTipo)
      .filter(([t]) => t !== "")
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const worstSeverity = novedades.reduce((max, n) => Math.max(max, SEVERITY_ORDER[n.tipo] ?? 0), 0);
    const worstTipoSev = novedades.find(n => (SEVERITY_ORDER[n.tipo] ?? 0) === worstSeverity);

    const dominantTipo = totalMin > 0 ? tipoConMasMin : (worstTipoSev?.tipo || null);
    const icono = dominantTipo ? (TIPOS_NOVEDAD[dominantTipo]?.icono || "") : "";
    const color = getSemaforoColor(totalMin, worstSeverity, durMin);
    const efic = totalMin > 0 ? Math.round(((durMin - totalMin) / durMin) * 100) : null;

    const dot = document.createElement("span");
    dot.className = `semaforo-dot s-${color}`;
    dot.title = efic !== null ? `Eficiencia: ${efic}%` : "";

    const iconSpan = document.createElement("span");
    iconSpan.className = "semaforo-dot-icon";
    iconSpan.textContent = icono;

    if (efic !== null) {
      const eficSpan = document.createElement("span");
      eficSpan.className = "semaforo-dot-efic";
      eficSpan.textContent = `${efic}%`;
      dot.appendChild(iconSpan);
      dot.appendChild(eficSpan);
    } else {
      dot.appendChild(iconSpan);
    }

    h3.appendChild(dot);
  });
}

function renderAcciones() {
  const seccion = document.getElementById("accionesPendientes");
  const lista = document.getElementById("accionesLista");
  if (!seccion || !lista) return;

  const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  const conAccion = saved.filter(n => n.accion && (n.accion.texto || n.accion.responsable));

  if (conAccion.length === 0) {
    seccion.style.display = "none";
    return;
  }

  seccion.style.display = "";
  lista.innerHTML = "";

  conAccion.forEach(({ linea, hora, tipo, accion }) => {
    const tipoInfo = TIPOS_NOVEDAD[tipo] || null;
    const item = document.createElement("div");
    item.className = "accion-item";

    const meta = document.createElement("div");
    meta.className = "accion-meta";
    meta.innerHTML = `
      <span class="accion-linea">${linea}</span>
      <span class="accion-hora">${hora}</span>
      ${tipoInfo ? `<span class="accion-tipo-icon">${tipoInfo.icono}</span>` : ""}
      ${accion.responsable ? `<span class="accion-resp-tag">${accion.responsable}</span>` : ""}
    `;

    const texto = document.createElement("div");
    texto.className = "accion-texto";
    texto.textContent = accion.texto || "—";

    const omDiv = document.createElement("div");
    omDiv.className = "accion-om-lectura";
    omDiv.innerHTML = `AVISO N°: <strong>${accion.om || "—"}</strong>`;

    item.appendChild(meta);
    item.appendChild(texto);
    item.appendChild(omDiv);
    lista.appendChild(item);
  });
}

function clearNovedades() {
  if (!confirm("¿Borrar todas las novedades guardadas?")) return;
  localStorage.removeItem(FORM_KEY);
  document.querySelectorAll(".linea-card ul").forEach(u => u.innerHTML = "");
  renderNovedades();
  renderProdTurno();
}

function addNovedad(linea, hora, texto, tipo = "", minutos = 0, accion = null, imagenes = []) {
  const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  saved.push({ linea, hora, texto, tipo, minutos: Number(minutos) || 0, accion, imagenes });
  sortNovedadesArray(saved);
  localStorage.setItem(FORM_KEY, JSON.stringify(saved));

  const match = linea?.match(/^LÍNEA\s+(\d+)$/);
  if (match) setProdTurnoDisabled(match[1], false);

  renderNovedades();
  renderProdTurno();
}

function deleteNovedad(linea, hora, texto) {
  const list = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  const idx = list.findIndex(nv => nv.linea === linea && nv.hora === hora && nv.texto === texto);
  if (idx !== -1) {
    list.splice(idx, 1);
    localStorage.setItem(FORM_KEY, JSON.stringify(list));
  }
  renderNovedades();
  renderProdTurno();
}

function setupImgPreview(inputId, previewId) {
  document.getElementById(inputId)?.addEventListener("change", function() {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    preview.innerHTML = "";
    if (!this.files[0]) return;
    const img = document.createElement("img");
    img.src = URL.createObjectURL(this.files[0]);
    img.className = "nv-form-thumb";
    preview.appendChild(img);
  });
}
setupImgPreview("nvImagen1", "nvImgPreview1");
setupImgPreview("nvImagen2", "nvImgPreview2");

formNovedad?.addEventListener("submit", async e => {
  e.preventDefault();

  const selHora = document.getElementById("nvHora");
  if (selHora && selHora.tagName.toLowerCase() === "select" && selHora.options.length === 0) {
    buildNvHoraOptions();
  }

  const linea = (nvLinea?.value || "").trim();
  const hora = (document.getElementById("nvHora")?.value || "").trim();
  const texto = (nvTexto?.value || "").trim();
  const tipo = (document.getElementById("nvTipo")?.value || "").trim();
  const minutos = parseInt(document.getElementById("nvMinutos")?.value || "0", 10) || 0;
  const requiereAccion = document.getElementById("nvRequiereAccion")?.checked || false;
  const accion = requiereAccion ? {
    responsable: document.getElementById("nvResponsable")?.value || "",
    texto: (document.getElementById("nvAccionTexto")?.value || "").trim(),
    om: (document.getElementById("nvOM")?.value || "").trim()
  } : null;

  const rango = document.getElementById("cgRango")?.value || "06-18";

  if (!linea || !hora || !texto) {
    alert("Por favor completá todos los campos.");
    return;
  }
  if (!/^\d{2}:00$/.test(hora)) {
    alert("Usá horas en punto (HH:00).");
    return;
  }

  const h = parseInt(hora.split(":")[0], 10);
  if (!horaEnRangoExclusiva(h, rango)) {
    alert("⚠️ La hora ingresada está fuera del rango seleccionado.");
    return;
  }

  const img1 = document.getElementById("nvImagen1")?.files[0];
  const img2 = document.getElementById("nvImagen2")?.files[0];
  const imgFiles = [img1, img2].filter(Boolean);
  const imagenes = imgFiles.length > 0 ? await Promise.all(imgFiles.map(f => comprimirImagen(f))) : [];

  addNovedad(linea, hora, texto, tipo, minutos, accion, imagenes);
  document.getElementById("nvRequiereAccion").checked = false;
  document.getElementById("accionResponsableWrap").style.display = "none";
  document.getElementById("accionDescWrap").style.display = "none";
  ["nvImgPreview1", "nvImgPreview2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
  formNovedad.reset();
  buildNvHoraOptions();
  renderNovedades();
});

nvClear?.addEventListener("click", () => {
  clearNovedades();
  clearCierres();
  clearProdTurno();
  localStorage.removeItem(MICRO_KEY);
  localStorage.removeItem(MICRO_DISP_KEY);
  setResumenTurnoOculto(false);
  closeMicroModal();
  renderMicroParadas();
  renderResumenTurno();
});
cgClearBtn?.addEventListener("click", () => cgClear());

/* =========================
   TABLA PRINCIPAL (localStorage)
   ========================= */
const TABLA_KEY = "tabla_produccion_v1";
const TABLA_FILTRO_KEY = "tabla_filtrar_completas_v1";

/* ===== Formatos + velocidad nominal automática ===== */
const FORMATOS_POR_LINEA = {
  "LÍNEA 1": {
    "500x6": "25200",
    "300x6": "25200",
    "995x6": "18000",
    "1000x6": "18000",
    "1500x4": "12000"
  },
  "LÍNEA 2": {
    "220x8": "57000",
    "354x6": "57000",
    "473x6": "45000"
  },
  "LÍNEA 3": {
    "300x6": "16980",
    "500x6": "19200",
    "591x6": "18600",
    "600x6": "18600",
    "991x6": "13980",
    "1500x6": "10800",
    "2250x6": "9000"
  },
  "LÍNEA 4": {},
  "LÍNEA 5": {
    "1000x8": "15000"
  },
  "LÍNEA 6": {
    "200x24": "24000"
  },
  "LÍNEA 7": {
    "1500x6": "13800",
    "2250x6": "9000"
  }
};

function getLineaNameFromRow(tr) {
  return tr.querySelector("th")?.textContent.trim() || "";
}

function getVelocidadPorFormato(linea, formato) {
  return FORMATOS_POR_LINEA[linea]?.[formato] || "";
}

function createFormatoSelect(linea, slot) {
  const select = document.createElement("select");
  select.className = "td-formato-select";
  select.dataset.slot = String(slot);

  const formatos = Object.keys(FORMATOS_POR_LINEA[linea] || {});
  const opts = [`<option value=""></option>`].concat(
    formatos.map(f => `<option value="${f}">${f}</option>`)
  );

  select.innerHTML = opts.join("");

  select.addEventListener("change", () => {
    const tr = select.closest("tr");
    if (!tr) return;

    const tds = tr.querySelectorAll("td");
    const velTd = slot === 1 ? tds[2] : tds[5];
    const velInput = velTd?.querySelector(".td-velocidad-input");

    if (velInput) {
      velInput.value = getVelocidadPorFormato(linea, select.value);
    }

    saveTabla();
  });

  return select;
}

function createVelocidadInput(slot) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "td-velocidad-input";
  input.dataset.slot = String(slot);
  input.readOnly = true;
  input.tabIndex = -1;
  return input;
}

function initTablaFormatos() {
  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    const linea = getLineaNameFromRow(tr);
    const tds = tr.querySelectorAll("td");
    if (tds.length < 6) return;

    const formato1Td = tds[1];
    const vel1Td = tds[2];
    const formato2Td = tds[4];
    const vel2Td = tds[5];

    formato1Td.classList.add("td-formato");
    formato2Td.classList.add("td-formato");
    vel1Td.classList.add("td-velocidad");
    vel2Td.classList.add("td-velocidad");

    if (!formato1Td.querySelector(".td-formato-select")) {
      formato1Td.innerHTML = "";
      formato1Td.appendChild(createFormatoSelect(linea, 1));
    }

    if (!vel1Td.querySelector(".td-velocidad-input")) {
      vel1Td.innerHTML = "";
      vel1Td.appendChild(createVelocidadInput(1));
    }

    if (!formato2Td.querySelector(".td-formato-select")) {
      formato2Td.innerHTML = "";
      formato2Td.appendChild(createFormatoSelect(linea, 2));
    }

    if (!vel2Td.querySelector(".td-velocidad-input")) {
      vel2Td.innerHTML = "";
      vel2Td.appendChild(createVelocidadInput(2));
    }
  });
}

function getTdValue(td) {
  if (!td) return "";

  const select = td.querySelector("select");
  if (select) return select.value.trim();

  const input = td.querySelector("input");
  if (input) return input.value.trim();

  return td.textContent.trim();
}

function setTdValue(td, value) {
  if (!td) return;

  const select = td.querySelector("select");
  if (select) {
    select.value = value || "";
    select.dispatchEvent(new Event("change"));
    return;
  }

  const input = td.querySelector("input");
  if (input) {
    input.value = value || "";
    return;
  }

  td.textContent = value || "";
}

document.addEventListener("DOMContentLoaded", () => {
  initTablaFormatos();
  restoreTabla();

  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");

    const pares = [
      { sabor: tds[0], formato: tds[1], vel: tds[2] },
      { sabor: tds[3], formato: tds[4], vel: tds[5] }
    ];

    pares.forEach(({ sabor, formato, vel }) => {
      if (!sabor) return;
      sabor.addEventListener("input", () => {
        if (sabor.textContent.trim() === "") {
          const sel = formato?.querySelector("select");
          if (sel) { sel.value = ""; sel.dispatchEvent(new Event("change")); }
          const inp = vel?.querySelector("input");
          if (inp) inp.value = "";
        }
        saveTabla();
      });
    });

    [tds[1], tds[4]].forEach(td => {
      const sel = td?.querySelector("select");
      if (sel) sel.addEventListener("change", saveTabla);
    });
  });
});

function saveTabla() {
  const filas = [];
  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    const linea = tr.querySelector("th")?.textContent.trim() || "";
    const celdas = Array.from(tr.querySelectorAll("td")).map(td => getTdValue(td));
    filas.push({ linea, celdas });
  });

  localStorage.setItem(TABLA_KEY, JSON.stringify(filas));
  resaltarCeldasConDatos();
}

function resaltarCeldasConDatos() {
  document.querySelectorAll(".tabla-produccion tbody td").forEach(td => {
    const valor = getTdValue(td).trim();
    td.classList.toggle("has-data", valor !== "");
  });
}

function restoreTabla() {
  const saved = JSON.parse(localStorage.getItem(TABLA_KEY) || "[]");

  saved.forEach(({ linea, celdas }) => {
    const fila = Array.from(document.querySelectorAll(".tabla-produccion tbody tr"))
      .find(tr => tr.querySelector("th")?.textContent.trim() === linea);

    if (!fila) return;

    const tds = fila.querySelectorAll("td");
    for (let i = 0; i < tds.length; i++) {
      setTdValue(tds[i], (celdas && celdas[i]) ? celdas[i] : "");
    }
  });

  resaltarCeldasConDatos();

  const isLecturaNow = document.getElementById("modeBtn")?.classList.contains("is-lectura");
  const onlyCompletedStored = localStorage.getItem(TABLA_FILTRO_KEY) === "true";
  const onlyCompleted = isLecturaNow ? true : onlyCompletedStored;
  aplicarFiltroFilasCompletadas(onlyCompleted);
}

function filaTieneContenido(tr) {
  const tds = tr.querySelectorAll("td");
  if (tds.length < 6) return false;

  const sabor1 = getTdValue(tds[0]);
  const formato1 = getTdValue(tds[1]);
  const vel1 = getTdValue(tds[2]);
  const sabor2 = getTdValue(tds[3]);
  const formato2 = getTdValue(tds[4]);
  const vel2 = getTdValue(tds[5]);

  const bloque1Completo = !!(sabor1 || formato1 || vel1);
  const bloque2Completo = !!(sabor2 || formato2 || vel2);

  return bloque1Completo || bloque2Completo;
}

function aplicarFiltroFilasCompletadas(onlyCompleted) {
  const filas = document.querySelectorAll(".tabla-produccion tbody tr");

  filas.forEach(tr => {
    const visible = !onlyCompleted || filaTieneContenido(tr);
    tr.style.display = visible ? "" : "none";
  });

  localStorage.setItem(TABLA_FILTRO_KEY, onlyCompleted ? "true" : "false");
}

let TABLE_EDITING = false;

function setTableEditing(on) {
  TABLE_EDITING = !!on;

  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");

    const sabor1 = tds[0];
    const formato1 = tds[1];
    const vel1 = tds[2];
    const sabor2 = tds[3];
    const formato2 = tds[4];
    const vel2 = tds[5];

    [sabor1, sabor2].forEach(td => {
      if (!td) return;
      td.setAttribute("contenteditable", on ? "true" : "false");
      td.classList.toggle("is-editing", on);
    });

    [formato1, formato2].forEach(td => {
      if (!td) return;
      td.setAttribute("contenteditable", "false");
      td.classList.toggle("is-disabled-select", !on);

      const sel = td.querySelector(".td-formato-select");
      if (sel) sel.disabled = !on;
    });

    [vel1, vel2].forEach(td => {
      if (!td) return;
      td.setAttribute("contenteditable", "false");
      td.classList.remove("is-editing");

      const inp = td.querySelector(".td-velocidad-input");
      if (inp) inp.readOnly = true;
    });
  });
}
window.setTableEditing = setTableEditing;

function enterEditMode() {
  aplicarFiltroFilasCompletadas(false);
  setTableEditing(true);
  document.querySelector(".tabla-produccion tbody td")?.focus();
  resaltarCeldasConDatos();
}

function saveAndLock() {
  saveTabla();
  aplicarFiltroFilasCompletadas(true);
  setTableEditing(false);
}

document.getElementById("btnEditarFormatos")?.addEventListener("click", enterEditMode);
document.getElementById("btnGrabarFormatos")?.addEventListener("click", saveAndLock);

/* =========================
   ENCABEZADO (localStorage)
   ========================= */
const ENC_KEY = "encabezado_v1";

function saveEncabezado() {
  const data = {
    turno: document.getElementById("turno")?.value || "",
    modoTurno: document.getElementById("modoTurno")?.value || "2",
    tn: document.getElementById("tn")?.value || "",
    fecha: document.getElementById("fecha")?.value || "",
    dia: document.getElementById("dia")?.value || "",
    lideres: document.getElementById("lideres")?.value || ""
  };
  localStorage.setItem(ENC_KEY, JSON.stringify(data));
}

function restoreEncabezado() {
  const saved = JSON.parse(localStorage.getItem(ENC_KEY) || "{}");
  if (saved.turno) document.getElementById("turno").value = saved.turno;
  if (saved.modoTurno) {
    const modoEl = document.getElementById("modoTurno");
    if (modoEl) modoEl.value = saved.modoTurno;
  }
  buildTnOptions();
  if (saved.tn) document.getElementById("tn").value = saved.tn;
  buildRangoOptions();
  document.getElementById("cgRango")?.dispatchEvent(new Event("change"));
  if (saved.fecha) document.getElementById("fecha").value = saved.fecha;
  if (saved.dia) document.getElementById("dia").value = saved.dia;
  if (saved.lideres) document.getElementById("lideres").value = saved.lideres;
}

function clearEncabezado() {
  localStorage.removeItem(ENC_KEY);
  ["turno","tn","fecha","dia","lideres"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const modoEl = document.getElementById("modoTurno");
  if (modoEl) modoEl.value = "2";
  buildTnOptions();
  buildRangoOptions();
}

["turno","modoTurno","tn","fecha","dia","lideres"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", saveEncabezado);
});
document.getElementById("lideres")?.addEventListener("input", saveEncabezado);

document.getElementById("modoTurno")?.addEventListener("change", () => {
  buildTnOptions();
  buildRangoOptions();
  document.getElementById("cgRango")?.dispatchEvent(new Event("change"));
});

document.getElementById("tn")?.addEventListener("change", () => {
  const tn = document.getElementById("tn")?.value;
  const rangoSel = document.getElementById("cgRango");
  if (!rangoSel) return;
  const nuevoRango = tnToRango(tn, getModoTurno());
  if (rangoSel.value !== nuevoRango) {
    rangoSel.value = nuevoRango;
    rangoSel.dispatchEvent(new Event("change"));
  }
});

document.addEventListener("DOMContentLoaded", restoreEncabezado);

document.getElementById("cgClear")?.addEventListener("click", clearEncabezado);

/* =========================
   PRODUCCIÓN DEL TURNO (localStorage)
   ========================= */
const PROD_TURNO_KEY = "produccion_turno_v1";

const CAMPOS_POR_LINEA = {
  "1": [
    { key: "botellas",    label: "CANTIDAD DE BOTELLAS", type: "number" },
    { key: "packs",       label: "PACKS",                type: "number" },
    { key: "desperdicio", label: "DESPERDICIO",           type: "number" }
  ],
  "2": [
    { key: "latas",   label: "CANTIDAD DE LATAS", type: "number" },
    { key: "depa",    label: "ROTURA DE DEPA",    type: "number" },
    { key: "seamer",  label: "SEAMER",            type: "number" },
    { key: "rechazo", label: "RECHAZO",           type: "number" }
  ],
  "3": [
    { key: "orden",       label: "ORDEN",       type: "text" },
    { key: "sabor",       label: "SABOR",       type: "text" },
    { key: "c1",          label: "CONTADOR 1",  type: "number", size: "sm" },
    { key: "c2",          label: "CONTADOR 2",  type: "number", size: "sm" },
    { key: "c3",          label: "CONTADOR 3",  type: "number", size: "sm" },
    { key: "desperdicio", label: "DESPERDICIO (BOTELLAS)", type: "number", size: "sm" }
  ],
  "5": [
    { key: "botellas",    label: "CANTIDAD DE BOTELLAS", type: "number" },
    { key: "packs",       label: "PACKS",                type: "number" },
    { key: "desperdicio", label: "DESPERDICIO",           type: "number" }
  ],
  "6": [
    { key: "botellas",    label: "CANTIDAD DE BOTELLAS", type: "number" },
    { key: "packs",       label: "PACKS",                type: "number" },
    { key: "desperdicio", label: "DESPERDICIO",           type: "number" }
  ],
  "7": [
    { key: "orden",       label: "ORDEN",       type: "text" },
    { key: "sabor",       label: "SABOR",       type: "text" },
    { key: "c1",          label: "CONTADOR 1",  type: "number", size: "sm" },
    { key: "c2",          label: "CONTADOR 2",  type: "number", size: "sm" },
    { key: "c3",          label: "CONTADOR 3",  type: "number", size: "sm" },
    { key: "desperdicio", label: "DESPERDICIO (BOTELLAS)", type: "number", size: "sm" }
  ]
};

function getProdTurnoData() {
  return JSON.parse(localStorage.getItem(PROD_TURNO_KEY) || "{}");
}

function saveProdTurnoField(linea, run, key, value) {
  const data = getProdTurnoData();
  if (!data[linea]) data[linea] = {};
  if (!data[linea][run]) data[linea][run] = {};
  data[linea][run][key] = value;
  localStorage.setItem(PROD_TURNO_KEY, JSON.stringify(data));
}

function setProdTurnoRun2(linea, show) {
  const data = getProdTurnoData();
  if (!data[linea]) data[linea] = {};
  data[linea].showRun2 = show;
  if (!show) delete data[linea].run2;
  localStorage.setItem(PROD_TURNO_KEY, JSON.stringify(data));
}

function setProdTurnoDisabled(linea, disabled) {
  const data = getProdTurnoData();
  if (!data[linea]) data[linea] = {};
  data[linea].hidden = disabled;
  localStorage.setItem(PROD_TURNO_KEY, JSON.stringify(data));
}

function getLineasConNovedades() {
  const novedades = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  const lineas = new Set();
  novedades.forEach(({ linea }) => {
    const match = linea?.match(/^LÍNEA\s+(\d+)$/);
    if (match) lineas.add(match[1]);
  });
  return Array.from(lineas).sort((a, b) => Number(a) - Number(b));
}

function buildRunFields(linea, run, savedData, disabled) {
  const campos = CAMPOS_POR_LINEA[linea] || [];
  const runData = savedData?.[linea]?.[run] || {};

  const div = document.createElement("div");
  div.className = "prod-fields";

  campos.forEach(({ key, label, type, size }) => {
    const lbl = document.createElement("label");
    if (size === "sm") lbl.classList.add("campo-chico");
    lbl.textContent = label;

    const inp = document.createElement("input");
    inp.type = type;
    inp.placeholder = type === "number" ? "0" : "—";
    inp.value = runData[key] || "";
    inp.disabled = disabled;
    if (type === "number") inp.min = "0";

    inp.addEventListener("input", () => saveProdTurnoField(linea, run, key, inp.value));

    lbl.appendChild(inp);
    div.appendChild(lbl);
  });

  return div;
}

function renderProdTurno() {
  const seccion = document.getElementById("produccionTurno");
  if (!seccion) return;

  const lineasActivas = getLineasConNovedades();
  const savedData = getProdTurnoData();

  const h2 = seccion.querySelector("h2");
  seccion.innerHTML = "";
  if (h2) seccion.appendChild(h2);

  if (lineasActivas.length === 0) {
    seccion.style.display = "none";
    return;
  }

  seccion.style.display = "";

  lineasActivas.forEach(linea => {
    const lineaData = savedData[linea] || {};
    const showRun2 = !!lineaData.showRun2;

    // Saltar líneas ocultas manualmente
    if (lineaData.hidden) return;

    const card = document.createElement("div");
    card.className = "prod-card";

    const h3 = document.createElement("h3");

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.className = "prod-card-close";
    btnClose.textContent = "×";
    btnClose.title = "Ocultar este cuadro";
    btnClose.addEventListener("click", () => {
      setProdTurnoDisabled(linea, true);
      renderProdTurno();
    });

    h3.appendChild(document.createTextNode(`LÍNEA ${linea}`));
    h3.appendChild(btnClose);
    card.appendChild(h3);

    if (showRun2) {
      const lbl1 = document.createElement("p");
      lbl1.className = "prod-run-label";
      lbl1.textContent = "1RA CORRIDA";
      card.appendChild(lbl1);
    }

    card.appendChild(buildRunFields(linea, "run1", savedData, false));

    if (showRun2) {
      const lbl2 = document.createElement("p");
      lbl2.className = "prod-run-label";
      lbl2.textContent = "2DA CORRIDA";
      card.appendChild(lbl2);
      card.appendChild(buildRunFields(linea, "run2", savedData, false));
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "prod-btn-run2";
    btn.textContent = showRun2 ? "− Quitar 2da corrida" : "+ 2da corrida";
    btn.addEventListener("click", () => {
      if (showRun2 && !confirm("¿Quitar la 2da corrida y sus datos?")) return;
      setProdTurnoRun2(linea, !showRun2);
      renderProdTurno();
    });
    card.appendChild(btn);

    seccion.appendChild(card);
  });
}

function clearProdTurno() {
  localStorage.removeItem(PROD_TURNO_KEY);
  renderProdTurno();
}

/* =========================
   PDF
   ========================= */
const btnInforme = document.getElementById("btnInforme");

function prepararVistaPDF() {
  const ocultos = [];
  const hide = sel => {
    document.querySelectorAll(sel).forEach(el => {
      ocultos.push({ el, prev: el.style.display });
      el.style.display = 'none';
    });
  };

  // UI de edición y botones
  hide('.cg-form');
  hide('.form-novedad');
  hide('.nv-actions');
  hide('#modeBtn');
  hide('#btnInforme');
  hide('#cgClear');
  hide('#nvClear');
  hide('.nv-del');
  hide('.btn-flag');
  hide('.cierres-btns');
  hide('#formBarra');
  hide('.cronograma-controles');

  // Linea-cards sin novedades
  document.querySelectorAll('.linea-card').forEach(card => {
    const ul = card.querySelector('ul');
    if (!ul || ul.children.length === 0) {
      ocultos.push({ el: card, prev: card.style.display });
      card.style.display = 'none';
    }
  });

  // Sección novedades: ocultar título si todas las cards están vacías
  const novedadesSection = document.getElementById('novedades');
  if (novedadesSection) {
    const hayNovedades = Array.from(novedadesSection.querySelectorAll('.linea-card ul')).some(ul => ul.children.length > 0);
    if (!hayNovedades) {
      ocultos.push({ el: novedadesSection, prev: novedadesSection.style.display });
      novedadesSection.style.display = 'none';
    }
  }

  return ocultos;
}

function restaurarVistaPDF(ocultos) {
  ocultos.forEach(({ el, prev }) => { el.style.display = prev; });
}

function obtenerPuntosDeCorte(canvasW, canvasH, scale, pageHpx) {
  const puntos = [];
  const scrollY = window.scrollY;

  // Elementos que no queremos cortar por la mitad
  const elementos = document.querySelectorAll(
    '.linea-card, .acciones-seccion, .prod-turno, .cierres-seccion, #cronograma, header'
  );

  const rects = Array.from(elementos)
    .map(el => {
      const r = el.getBoundingClientRect();
      return {
        top: (r.top + scrollY) * scale,
        bottom: (r.bottom + scrollY) * scale,
      };
    })
    .filter(r => r.bottom > 0 && r.top < canvasH)
    .sort((a, b) => a.top - b.top);

  let paginaFin = pageHpx;
  while (paginaFin < canvasH) {
    const margen = pageHpx * 0.25;
    let mejorCorte = paginaFin;
    let minDist = Infinity;

    for (const r of rects) {
      // Cortar justo antes de que empiece un elemento
      if (r.top > paginaFin - margen && r.top < paginaFin + margen) {
        const d = Math.abs(r.top - paginaFin);
        if (d < minDist) { minDist = d; mejorCorte = r.top; }
      }
      // Cortar justo después de que termina un elemento
      if (r.bottom > paginaFin - margen && r.bottom < paginaFin + margen) {
        const d = Math.abs(r.bottom - paginaFin);
        if (d < minDist) { minDist = d; mejorCorte = r.bottom; }
      }
    }

    puntos.push(Math.min(Math.round(mejorCorte), canvasH));
    paginaFin = mejorCorte + pageHpx;
  }

  puntos.push(canvasH);
  return puntos;
}

btnInforme?.addEventListener("click", async () => {
  btnInforme.classList.add("is-busy");
  btnInforme.setAttribute("aria-busy", "true");
  btnInforme.disabled = true;

  const ocultos = prepararVistaPDF();
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500));

  try {
    const scale = 2;
    const canvas = await html2canvas(document.body, { scale, useCORS: true, allowTaint: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const canvasW = canvas.width;
    const canvasH = canvas.height;
    const mmPerPx = pageW / canvasW;
    const pageHpx = pageH / mmPerPx;

    const totalHmm = canvasH * mmPerPx;

    if (totalHmm <= pageH) {
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, totalHmm);
    } else {
      const cortes = obtenerPuntosDeCorte(canvasW, canvasH, scale, pageHpx);
      let prevY = 0;
      let primeraHoja = true;

      for (const corteY of cortes) {
        const altoPx = corteY - prevY;
        if (altoPx <= 0) { prevY = corteY; continue; }

        const slice = document.createElement("canvas");
        slice.width = canvasW;
        slice.height = altoPx;
        const ctx = slice.getContext("2d");
        ctx.drawImage(canvas, 0, prevY, canvasW, altoPx, 0, 0, canvasW, altoPx);

        const altomm = altoPx * mmPerPx;
        if (!primeraHoja) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageW, altomm);

        primeraHoja = false;
        prevY = corteY;
      }
    }

    pdf.save("informe-produccion.pdf");
  } finally {
    restaurarVistaPDF(ocultos);
    btnInforme.classList.remove("is-busy");
    btnInforme.removeAttribute("aria-busy");
    btnInforme.disabled = false;
  }
});

/* =========================
   CAPTURA IMAGEN
   ========================= */
const btnCaptura = document.getElementById("btnCaptura");

function prepararVistaCaptura() {
  document.body.classList.add('capturando');

  // Ocultar linea-cards vacías
  const cardsOcultas = [];
  document.querySelectorAll('.linea-card').forEach(card => {
    const ul = card.querySelector('ul');
    if (!ul || ul.children.length === 0) {
      card.style.display = 'none';
      cardsOcultas.push(card);
    }
  });

  return cardsOcultas;
}

function restaurarVistaCaptura(cardsOcultas) {
  document.body.classList.remove('capturando');
  cardsOcultas.forEach(card => { card.style.display = ''; });
}

btnCaptura?.addEventListener("click", async () => {
  btnCaptura.classList.add("is-busy");
  btnCaptura.setAttribute("aria-busy", "true");
  btnCaptura.disabled = true;

  const cardsOcultas = prepararVistaCaptura();
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500));

  try {
    const canvas = await html2canvas(document.body, { scale: 2, useCORS: true, allowTaint: true });
    const link = document.createElement("a");
    link.download = "informe-produccion.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    restaurarVistaCaptura(cardsOcultas);
    btnCaptura.classList.remove("is-busy");
    btnCaptura.removeAttribute("aria-busy");
    btnCaptura.disabled = false;
  }
});

/* =========================
   MODO (CARGA / LECTURA)
   ========================= */
(function () {
  const MODE_KEY = "modo_app_v1";
  let modeBtn = document.getElementById("modeBtn");
  if (!modeBtn) return;

  function showEditUI(show) {
    const selectors = [
      ".cg-form",
      ".form-novedad",
      "#btnInforme",
      "#cgClear",
      "#nvClear",
      "#formBarra button",
      "#formNovedad button",
      "#btnEditarFormatos",
      "#btnGrabarFormatos",
      "#microParadasWrap",
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (el.id === "modeBtn" || el.closest("#modeBtn")) return;
        el.style.display = show ? "" : "none";
      });
    });

    ["turno", "modoTurno", "tn", "fecha", "lideres"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !show;
    });
  }

  function cierresTienenDatos() {
    const data = getCierresData();
    return Object.values(data).some(linea => linea.open === true);
  }

  function applyMode(mode) {
    const lectura = mode === "lectura";
    document.body.classList.toggle("modo-lectura", lectura);
    modeBtn.classList.toggle("is-lectura", lectura);
    showEditUI(!lectura);
    updateBarDeleteVisibility(!lectura);
    if (lectura) setTableEditing(false);
    localStorage.setItem(MODE_KEY, mode);

    const secCierres = document.getElementById("cierres");
    if (secCierres) {
      secCierres.style.display = (!lectura || cierresTienenDatos()) ? "" : "none";
    }

    renderNovedades();
    restoreTabla();
    renderProdTurno();
    renderMicroParadas();
    renderResumenTurno();
  }

  modeBtn.onclick = () => {
    const newMode = modeBtn.classList.contains("is-lectura") ? "carga" : "lectura";
    applyMode(newMode);
  };

  applyMode(localStorage.getItem(MODE_KEY) || "carga");
})();

/* =========================
   CIERRES (localStorage)
   ========================= */
function getCierresData() {
  return JSON.parse(localStorage.getItem(CIERRES_KEY) || "{}");
}

function saveCierreField(linea, key, value) {
  const data = getCierresData();
  if (!data[linea]) data[linea] = {};
  data[linea][key] = value;
  localStorage.setItem(CIERRES_KEY, JSON.stringify(data));
}

function toggleCierre(linea) {
  const data = getCierresData();
  if (!data[linea]) data[linea] = {};
  data[linea].open = !data[linea].open;
  localStorage.setItem(CIERRES_KEY, JSON.stringify(data));
  renderCierres();
}

function inp(type, key, linea, value, placeholder, readOnly) {
  const el = document.createElement("input");
  el.type = type;
  el.placeholder = placeholder || (type === "number" ? "0" : "—");
  el.value = value || "";
  if (type === "number") el.min = "0";
  if (readOnly) { el.readOnly = true; el.className = "cierre-input cierre-calculated"; }
  else el.className = "cierre-input";
  if (!readOnly) el.addEventListener("input", () => saveCierreField(linea, key, el.value));
  return el;
}

function field(labelTxt, inputEl) {
  const wrap = document.createElement("div");
  wrap.className = "cierre-field";
  const lbl = document.createElement("label");
  lbl.textContent = labelTxt;
  lbl.appendChild(inputEl);
  wrap.appendChild(lbl);
  return wrap;
}

function buildCierreL1(data) {
  const frag = document.createDocumentFragment();

  const row = document.createElement("div");
  row.className = "cierre-row";
  row.appendChild(field("NÚMERO DE ORDEN", inp("text", "orden", "1", data.orden)));
  row.appendChild(field("CANTIDAD DE CAJAS", inp("number", "cajas", "1", data.cajas)));
  frag.appendChild(row);

  // Toggle SI/NO Expedición
  const expWrap = document.createElement("div");
  expWrap.className = "cierre-field cierre-expedicion";
  const expLbl = document.createElement("span");
  expLbl.className = "cierre-exp-label";
  expLbl.textContent = "CONTROLADO POR EXPEDICIÓN";
  const btnGroup = document.createElement("div");
  btnGroup.className = "cierre-toggle-group";
  ["SI", "NO"].forEach(val => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = val;
    b.className = "cierre-toggle-opt" + (data.expedicion === val ? " active" : "");
    b.addEventListener("click", () => {
      saveCierreField("1", "expedicion", val);
      btnGroup.querySelectorAll(".cierre-toggle-opt").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
    });
    btnGroup.appendChild(b);
  });
  expWrap.appendChild(expLbl);
  expWrap.appendChild(btnGroup);
  frag.appendChild(expWrap);

  const row2 = document.createElement("div");
  row2.className = "cierre-row";
  row2.appendChild(field("MERMA", inp("number", "merma", "1", data.merma)));
  frag.appendChild(row2);

  return frag;
}

function buildCierreL2(data) {
  const frag = document.createDocumentFragment();

  const row = document.createElement("div");
  row.className = "cierre-row";
  row.appendChild(field("NÚMERO DE ORDEN", inp("text", "orden", "2", data.orden)));
  row.appendChild(field("CANTIDAD DE CAJAS", inp("number", "cajas", "2", data.cajas)));
  frag.appendChild(row);

  const mermaGroup = document.createElement("div");
  mermaGroup.className = "cierre-merma-group";
  const mermaTitle = document.createElement("p");
  mermaTitle.className = "cierre-group-title";
  mermaTitle.textContent = "DETALLE DE MERMA";
  mermaGroup.appendChild(mermaTitle);

  const mermaKeys = [
    { key: "rot_depa",   label: "ROTURA DE DEPA" },
    { key: "rot_seamer", label: "ROTURA LLEN/SEAMER" },
    { key: "rechazo",    label: "RECHAZO" },
    { key: "rot_linea",  label: "ROTURA DE LÍNEA" }
  ];

  const totalInp = inp("number", "total_merma", "2", "", "0", true);
  totalInp.id = "cierre2Total";

  function recalcTotal() {
    const vals = mermaKeys.map(({ key }) => {
      const el = mermaGroup.querySelector(`[data-key="${key}"]`);
      return parseFloat(el?.value || 0) || 0;
    });
    totalInp.value = vals.reduce((a, b) => a + b, 0);
    saveCierreField("2", "total_merma", totalInp.value);
  }

  mermaKeys.forEach(({ key, label }) => {
    const i = inp("number", key, "2", data[key]);
    i.dataset.key = key;
    const oldHandler = i.oninput;
    i.addEventListener("input", () => { saveCierreField("2", key, i.value); recalcTotal(); });
    mermaGroup.appendChild(field(label, i));
  });

  mermaGroup.appendChild(field("TOTAL DE MERMA", totalInp));
  frag.appendChild(mermaGroup);

  // Recalc on load
  setTimeout(recalcTotal, 0);

  return frag;
}

function buildCierreSimple(linea, data) {
  const frag = document.createDocumentFragment();
  const row = document.createElement("div");
  row.className = "cierre-row";
  row.appendChild(field("NÚMERO DE ORDEN", inp("text", "orden", linea, data.orden)));
  row.appendChild(field("CANTIDAD DE CAJAS", inp("number", "cajas", linea, data.cajas)));
  row.appendChild(field("MERMA", inp("number", "merma", linea, data.merma)));
  frag.appendChild(row);
  return frag;
}

function renderCierres() {
  const container = document.getElementById("cierresCards");
  if (!container) return;
  container.innerHTML = "";

  const data = getCierresData();
  const lineas = ["1", "2", "3", "7"];

  // Actualizar estado activo de botones
  document.querySelectorAll(".cierre-btn").forEach(btn => {
    const l = btn.dataset.linea;
    btn.classList.toggle("active", !!(data[l]?.open));
  });

  lineas.forEach(linea => {
    if (!data[linea]?.open) return;

    const card = document.createElement("div");
    card.className = "cierre-card";

    const h3 = document.createElement("h3");
    h3.appendChild(document.createTextNode(`LÍNEA ${linea}`));

    const btnCloseCierre = document.createElement("button");
    btnCloseCierre.type = "button";
    btnCloseCierre.className = "cierre-card-close";
    btnCloseCierre.textContent = "×";
    btnCloseCierre.title = "Cerrar";
    btnCloseCierre.addEventListener("click", () => toggleCierre(linea));
    h3.appendChild(btnCloseCierre);

    card.appendChild(h3);

    const lineaData = data[linea] || {};
    if (linea === "1") card.appendChild(buildCierreL1(lineaData));
    else if (linea === "2") card.appendChild(buildCierreL2(lineaData));
    else card.appendChild(buildCierreSimple(linea, lineaData));

    container.appendChild(card);
  });
}

function clearCierres() {
  localStorage.removeItem(CIERRES_KEY);
  renderCierres();
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".cierre-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleCierre(btn.dataset.linea));
  });
  renderCierres();
});

/* =========================
   BOTÓN FLOTANTE
   ========================= */
(function () {
  const btn = document.getElementById("btnFlotante");
  const texto = document.getElementById("btnFlotanteTexto");
  const formNovedad = document.querySelector(".form-novedad");
  if (!btn || !formNovedad) return;

  function esCercaDelForm() {
    const rect = formNovedad.getBoundingClientRect();
    return rect.top <= window.innerHeight * 0.75;
  }

  const icono = document.getElementById("btnFlotanteIcono");

  function actualizarBoton() {
    if (esCercaDelForm()) {
      if (icono) icono.textContent = "⬆";
      btn.classList.add("is-arriba");
    } else {
      if (icono) icono.textContent = "＋";
      btn.classList.remove("is-arriba");
    }
  }

  btn.addEventListener("click", () => {
    if (esCercaDelForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      formNovedad.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  window.addEventListener("scroll", actualizarBoton, { passive: true });
  actualizarBoton();
})();

/* Labels móviles */
document.addEventListener("DOMContentLoaded", () => {
  const labels = [
    "Sabor 1", "Formato 1", "Velocidad nominal 1",
    "Sabor 2", "Formato 2", "Velocidad nominal 2"
  ];
  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    tr.querySelectorAll("td").forEach((td, i) => td.setAttribute("data-label", labels[i] || ""));
  });
});

/* =========================
   MICRO-PARADAS
   ========================= */
function getMicroParadas() {
  return JSON.parse(localStorage.getItem(MICRO_KEY) || "[]");
}

function getDisponibleDesde() {
  return JSON.parse(localStorage.getItem(MICRO_DISP_KEY) || "{}");
}

function saveDisponibleDesde(linea, hora) {
  const data = getDisponibleDesde();
  data[linea] = hora;
  localStorage.setItem(MICRO_DISP_KEY, JSON.stringify(data));
  renderResumenTurno();
}

function addMicroParada(linea, causa, minutos, nota) {
  const list = getMicroParadas();
  list.push({ linea, causa, minutos: Number(minutos) || 0, nota: nota || "" });
  localStorage.setItem(MICRO_KEY, JSON.stringify(list));
  renderMicroParadas();
  renderResumenTurno();
}

function deleteMicroParada(index) {
  const list = getMicroParadas();
  list.splice(index, 1);
  localStorage.setItem(MICRO_KEY, JSON.stringify(list));
  renderMicroParadas();
  renderResumenTurno();
}

function horaInicioTurno() {
  const rango = document.getElementById("cgRango")?.value || "06-18";
  return String(rangoInfo(rango).start).padStart(2, "0") + ":00";
}

function buildMicroHoraOpts(sel, selected) {
  const rango = document.getElementById("cgRango")?.value || "06-18";
  const info = rangoInfo(rango);
  const end = rangoFinHora(rango);
  const opts = [];
  const horas = [];

  if (info.start <= end) {
    for (let h = info.start; h <= end; h++) horas.push(h);
  } else {
    for (let h = info.start; h <= 23; h++) horas.push(h);
    for (let h = 0; h <= end; h++) horas.push(h);
  }
  horas.forEach(h => {
    const v = String(h).padStart(2, "0") + ":00";
    opts.push(`<option value="${v}"${v === selected ? " selected" : ""}>${v}</option>`);
  });
  sel.innerHTML = opts.join("");
  sel.value = selected;
}

function renderMicroParadas() {
  const wrap = document.getElementById("microParadasWrap");
  if (!wrap) return;

  wrap.style.display = isLectura() ? "none" : "";
  if (isLectura()) return;

  const lista = document.getElementById("microLista");
  if (!lista) return;
  lista.innerHTML = "";

  const all = getMicroParadas();
  const byLinea = {};
  all.forEach((item, idx) => {
    if (!byLinea[item.linea]) byLinea[item.linea] = [];
    byLinea[item.linea].push({ ...item, _idx: idx });
  });

  const lineasConDatos = LINEAS_PRODUCCION.filter(l => (byLinea[l] || []).length > 0);
  if (lineasConDatos.length === 0) return;

  const chips = document.createElement("div");
  chips.className = "micro-chips";

  lineasConDatos.forEach(linea => {
    const items = byLinea[linea];
    const total = items.reduce((s, i) => s + (Number(i.minutos) || 0), 0);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "micro-chip";
    chip.innerHTML = `<span class="micro-chip-linea">${linea}</span><span class="micro-chip-min">${total} min</span><span class="micro-chip-arrow">›</span>`;
    chip.addEventListener("click", () => openMicroModal());
    chips.appendChild(chip);
  });

  lista.appendChild(chips);
}

function buildMicroGrupo(linea, items, dispDesde) {
  const totalMin = items.reduce((s, i) => s + (Number(i.minutos) || 0), 0);

  const grupo = document.createElement("div");
  grupo.className = "micro-linea-grupo";

  const header = document.createElement("div");
  header.className = "micro-linea-header";

  const nombre = document.createElement("span");
  nombre.className = "micro-linea-nombre";
  nombre.textContent = linea;

  const dispLabel = document.createElement("label");
  dispLabel.className = "micro-disp-label";
  dispLabel.textContent = "Disponible desde: ";

  const dispSel = document.createElement("select");
  dispSel.className = "micro-disp-select";
  buildMicroHoraOpts(dispSel, dispDesde[linea] || horaInicioTurno());
  dispSel.addEventListener("change", () => saveDisponibleDesde(linea, dispSel.value));
  dispLabel.appendChild(dispSel);

  const totalSpan = document.createElement("span");
  totalSpan.className = "micro-linea-total";
  totalSpan.textContent = `${totalMin} min no rep.`;

  header.appendChild(nombre);
  header.appendChild(dispLabel);
  header.appendChild(totalSpan);
  grupo.appendChild(header);

  const itemsDiv = document.createElement("div");
  itemsDiv.className = "micro-linea-items";

  items.forEach(item => {
    const tipo = TIPOS_MICRO[item.causa] || { icono: "—", label: item.causa || "Sin clasificar" };
    const row = document.createElement("div");
    row.className = "micro-item";

    const causa = document.createElement("span");
    causa.className = "micro-item-causa";
    causa.textContent = `${tipo.icono} ${tipo.label}`;

    const min = document.createElement("span");
    min.className = "micro-item-min";
    min.textContent = `${item.minutos} min`;

    const btnDel = document.createElement("button");
    btnDel.className = "micro-item-del";
    btnDel.textContent = "×";
    btnDel.type = "button";
    btnDel.addEventListener("click", () => {
      if (confirm("¿Eliminar este tiempo?")) {
        deleteMicroParada(item._idx);
        if (getMicroParadas().length === 0) {
          closeMicroModal();
        } else {
          renderMicroModalBody();
        }
      }
    });

    row.appendChild(causa);
    row.appendChild(min);

    if (item.nota) {
      const nota = document.createElement("span");
      nota.className = "micro-item-nota";
      nota.textContent = item.nota;
      row.appendChild(nota);
    }

    row.appendChild(btnDel);
    itemsDiv.appendChild(row);
  });

  grupo.appendChild(itemsDiv);
  return grupo;
}

function renderMicroModalBody() {
  const body = document.getElementById("microModalBody");
  if (!body) return;
  body.innerHTML = "";

  const all = getMicroParadas();
  const dispDesde = getDisponibleDesde();

  const byLinea = {};
  all.forEach((item, idx) => {
    if (!byLinea[item.linea]) byLinea[item.linea] = [];
    byLinea[item.linea].push({ ...item, _idx: idx });
  });

  LINEAS_PRODUCCION.forEach(linea => {
    const items = byLinea[linea] || [];
    if (items.length === 0) return;
    body.appendChild(buildMicroGrupo(linea, items, dispDesde));
  });
}

function openMicroModal() {
  const modal = document.getElementById("microModal");
  if (!modal) return;
  renderMicroModalBody();
  modal.classList.add("open");
}

function closeMicroModal() {
  const modal = document.getElementById("microModal");
  if (modal) modal.classList.remove("open");
}

document.getElementById("formMicro")?.addEventListener("submit", e => {
  e.preventDefault();
  const linea = document.getElementById("mpLinea")?.value.trim();
  const causa = document.getElementById("mpCausa")?.value.trim();
  const minutos = Number(document.getElementById("mpMinutos")?.value) || 0;
  const nota = (document.getElementById("mpNota")?.value || "").trim();

  if (!linea) { alert("Seleccioná una línea."); return; }
  if (minutos <= 0) { alert("Ingresá los minutos."); return; }

  addMicroParada(linea, causa, minutos, nota);

  document.getElementById("mpLinea").value = "";
  document.getElementById("mpCausa").value = "";
  document.getElementById("mpMinutos").value = "";
  document.getElementById("mpNota").value = "";
});

document.addEventListener("DOMContentLoaded", () => {
  renderMicroParadas();
  renderResumenTurno();

  document.getElementById("microModalClose")?.addEventListener("click", closeMicroModal);
  document.getElementById("microModal")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closeMicroModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMicroModal();
  });
});

document.getElementById("cgRango")?.addEventListener("change", () => {
  renderMicroParadas();
  renderResumenTurno();
});

/* =========================
   RESUMEN DEL TURNO
   ========================= */
function minEntreHoras(desde, hasta, rango) {
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  let d = toMin(desde);
  let h = toMin(hasta);
  if (rangoEnvuelveMedianoche(rango) && h <= d) h += 24 * 60;
  return Math.max(0, h - d);
}

function calcEficienciaPorLinea() {
  const novedades = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  const micro = getMicroParadas();
  const dispDesde = getDisponibleDesde();
  const rango = document.getElementById("cgRango")?.value || "06-18";
  const finTurno = String(rangoFinHora(rango)).padStart(2, "0") + ":00";

  const result = {};
  LINEAS_PRODUCCION.forEach(linea => {
    const inicio = dispDesde[linea] || horaInicioTurno();
    const disponible = minEntreHoras(inicio, finTurno, rango);

    const perdidosNov = novedades
      .filter(n => n.linea === linea)
      .reduce((s, n) => s + (Number(n.minutos) || 0), 0);

    const perdidosMicro = micro
      .filter(m => m.linea === linea)
      .reduce((s, m) => s + (Number(m.minutos) || 0), 0);

    const totalPerdidos = perdidosNov + perdidosMicro;
    const efic = disponible > 0 ? Math.max(0, Math.round(((disponible - totalPerdidos) / disponible) * 100)) : null;

    result[linea] = { disponible, perdidosNov, perdidosMicro, totalPerdidos, efic };
  });

  return result;
}

document.getElementById("resumenTurnoClose")?.addEventListener("click", () => {
  if (!confirm("¿Ocultar el Resumen del Turno? No va a volver a aparecer hasta que se presione Borrar Todo.")) return;
  setResumenTurnoOculto(true);
  renderResumenTurno();
});

function renderResumenTurno() {
  const seccion = document.getElementById("resumenTurno");
  if (!seccion) return;

  if (isResumenTurnoOculto()) {
    seccion.style.display = "none";
    return;
  }

  const efic = calcEficienciaPorLinea();
  const durTurno = rangoInfo(document.getElementById("cgRango")?.value || "06-18").dur;
  const lineasResumen = LINEAS_PRODUCCION.filter(l => UMBRAL_EFICIENCIA_POR_LINEA[l] !== undefined);
  const lineasConDatos = lineasResumen.filter(l => {
    const e = efic[l];
    return e && (e.totalPerdidos > 0 || (e.disponible > 0 && e.disponible < durTurno));
  });

  seccion.style.display = lineasConDatos.length > 0 ? "" : "none";

  const body = seccion.querySelector(".resumen-body");
  if (!body) return;
  body.innerHTML = "";

  if (lineasConDatos.length === 0) return;

  // Tabla de eficiencia
  const tablaWrap = document.createElement("div");
  tablaWrap.className = "resumen-tabla-wrap";

  const tabla = document.createElement("table");
  tabla.className = "resumen-tabla";
  tabla.innerHTML = `<thead><tr>
    <th>Línea</th><th>Disp.</th><th>Nov.</th><th>No rep.</th><th>Total perd.</th><th>Eficiencia</th>
  </tr></thead>`;

  const tbody = document.createElement("tbody");
  lineasConDatos.forEach(linea => {
    const e = efic[linea];
    const umbral = UMBRAL_EFICIENCIA_POR_LINEA[linea] ?? 60;
    const cls = e.efic === null ? "" : e.efic >= umbral ? "efic-alta" : "efic-baja";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${linea}</strong></td>
      <td>${e.disponible} min</td>
      <td>${e.perdidosNov} min</td>
      <td>${e.perdidosMicro} min</td>
      <td>${e.totalPerdidos} min</td>
      <td class="resumen-efic ${cls}">${e.efic !== null ? e.efic + "%" : "—"}</td>
    `;
    tbody.appendChild(tr);
  });
  tabla.appendChild(tbody);
  tablaWrap.appendChild(tabla);
  body.appendChild(tablaWrap);

  // Gráfico
  renderGraficoParadas(body, efic, lineasConDatos);
}

function rrect(ctx, x, y, w, h, r) {
  if (w <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function eficBarColor(linea, pct) {
  if (pct === null) return "#aaa";
  const umbral = UMBRAL_EFICIENCIA_POR_LINEA[linea] ?? 60;
  return pct >= umbral ? "#388e3c" : "#c62828";
}

function renderGraficoParadas(container, efic, lineas) {
  if (_eficChart) { _eficChart.destroy(); _eficChart = null; }

  const wrap = document.createElement("div");
  wrap.className = "resumen-chart-wrap";
  wrap.style.height = (lineas.length * 58 + 48) + "px";

  const canvas = document.createElement("canvas");
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  const labels  = lineas.map(l => l.replace("LÍNEA ", "L"));
  const values  = lineas.map(l => efic[l].efic ?? 0);
  const colors  = lineas.map(l => eficBarColor(l, efic[l].efic));

  const pctLabelPlugin = {
    id: "pctLabel",
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      chart.data.datasets.forEach((ds, di) => {
        chart.getDatasetMeta(di).data.forEach((bar, idx) => {
          const val = ds.data[idx];
          const lbl = val + "%";
          ctx.save();
          ctx.font = "700 14px sans-serif";
          ctx.textBaseline = "middle";
          const tw = ctx.measureText(lbl).width;
          const barW = bar.x - bar.base;
          if (barW > tw + 24) {
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.textAlign = "right";
            ctx.shadowColor = "rgba(0,0,0,0.25)";
            ctx.shadowBlur = 2;
            ctx.fillText(lbl, bar.x - 10, bar.y);
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.textAlign = "left";
            ctx.fillText(lbl, bar.x + 8, bar.y);
          }
          ctx.restore();
        });
      });
    }
  };

  _eficChart = new Chart(canvas, {
    type: "bar",
    plugins: [pctLabelPlugin],
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        hoverBackgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 36,
      }]
    },
    options: {
      indexAxis: "y",
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 55, top: 4, bottom: 4 } },
      plugins: {
        legend:  { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: "rgba(255,255,255,0.1)", lineWidth: 1 },
          ticks: {
            callback: v => v + "%",
            font: { size: 11 },
            color: "rgba(255,255,255,0.6)",
            maxTicksLimit: 6,
          },
          border: { display: false },
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { weight: "700", size: 13 },
            color: "rgba(255,255,255,0.85)",
          },
          border: { display: false },
        }
      }
    }
  });
}