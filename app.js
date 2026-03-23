/* =========================
   InformePorTurno — LOCAL (sin Firebase)
   - Persistencia: localStorage por dispositivo
   - PDF: html2canvas + jsPDF (CDN)
   ========================= */

// No-op para compatibilidad con llamadas existentes
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

/* ======== Cronograma ======== */
const CG_STATE_KEY = 'cronograma_v1';

const cg = {
  rango: '06-18',
  toMin(hhmm) { const [h,m]=hhmm.split(':').map(Number); return h*60+(m||0); },
  relMin(hhmm, rango) {
    const m = this.toMin(hhmm);
    if (rango === '06-18') return m - 6*60;
    return (m >= 18*60) ? (m - 18*60) : (m + (24*60 - 18*60));
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
  const horas = [];

  if (rango === '06-18') {
    for (let h = 6; h < 18; h++) horas.push(h);
    window.cgStartHour = 6;
  } else {
    for (let i = 0; i < 12; i++) horas.push((18 + i) % 24);
    window.cgStartHour = 18;
  }

  const total = horas.length;
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

// ¿Estoy en modo lectura?
function isLectura() {
  const btn = document.getElementById("modeBtn");
  return !!btn && btn.classList.contains("is-lectura");
}

function updateBarDeleteVisibility(show) {
  document.querySelectorAll(".cg-bar .cg-bar-close").forEach(btn => {
    btn.classList.toggle("is-hidden", !show);
  });
}

function removeCorrida(linea, inicio, fin, sabor) {
  const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
  const next  = saved.filter(c => !(c.linea==linea && c.inicio==inicio && c.fin==fin && c.sabor==sabor));
  localStorage.setItem("corridas", JSON.stringify(next));
}

function cgAddBar(linea, inicio, fin, sabor, restored = false) {
  const lane = document.querySelector(`.cg-lane[data-linea="${linea}"]`);
  if (!lane) return;

  const rangeText = `${inicio}|${fin}`;

  // Eliminar duplicados por seguridad
  Array.from(lane.querySelectorAll(".cg-bar")).forEach(b => {
    if (b.dataset.timeRange === rangeText && b.dataset.sabor === sabor) b.remove();
  });

  const [iniH, iniM] = inicio.split(":").map(Number);
  const [finH, finM] = fin.split(":").map(Number);
  const iniMin = iniH * 60 + iniM;
  const finMin = finH * 60 + finM;

  const total = 12 * 60;
  const startRange = (window.cgStartHour ?? 6) * 60;

  let startMin, endMin;
  const wrap = (startRange + total) % 1440 > startRange;

  if (wrap) {
    startMin = iniMin - startRange;
    endMin   = finMin - startRange;
  } else {
    startMin = (iniMin >= startRange) ? iniMin - startRange : (1440 - startRange) + iniMin;
    endMin   = (finMin >= startRange) ? finMin - startRange : (1440 - startRange) + finMin;
  }

  startMin = Math.max(0, startMin);
  endMin   = Math.min(total, endMin);

  const left = (startMin / total) * 100;
  const width = Math.max(1, ((endMin - startMin) / total) * 100);

  const bar = document.createElement("div");
  bar.className = "cg-bar";
  bar.dataset.timeRange = rangeText;
  bar.dataset.sabor = sabor;
  bar.dataset.linea = linea;

  bar.style.left = `${left}%`;
  bar.style.width = `${width}%`;

  const btn = document.createElement("button");
  btn.className = "cg-bar-close";
  btn.textContent = "×";
  if (isLectura()) btn.classList.add("is-hidden");

  btn.addEventListener("click", () => {
    bar.remove();
    removeCorrida(linea, inicio, fin, sabor);
  });

  bar.appendChild(btn);
  bar.appendChild(document.createTextNode(sabor));
  lane.appendChild(bar);

  if (!restored) {
    const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
    saved.push({ linea, inicio, fin, sabor });
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
  document.querySelectorAll('.cg-lane').forEach(l => l.innerHTML='');
  const saved = JSON.parse(localStorage.getItem("corridas") || "[]");
  saved.forEach(c => cgAddBar(c.linea, c.inicio, c.fin, c.sabor, true));
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

  if (rango === '06-18') {
    if (iniH < 6 || iniH >= 18 || finH < 6 || finH > 18) {
      alert("⚠️ Los horarios deben estar entre 06:00 y 18:00.");
      return;
    }
  } else {
    const validoInicio = (iniH >= 18 && iniH <= 23) || (iniH >= 0 && iniH < 6);
    const validoFin    = (finH >= 18 && finH <= 23) || (finH >= 0 && finH <= 6);
    if (!validoInicio || !validoFin) {
      alert("⚠️ Los horarios deben estar entre 18:00 y 06:00.");
      return;
    }
  }

  cgAddBar(linea, ini, fin, sabor);
  form.reset();
});

/* =========================
   NOVEDADES (localStorage)
   ========================= */
const FORM_KEY = "novedades_v1";

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

function buildNvHoraOptions(){
  const sel = document.getElementById("nvHora");
  const rangoSel = document.getElementById("cgRango");
  if (!sel || !rangoSel) return;

  const rango = rangoSel.value;
  const opts = [];
  if (rango === "06-18"){
    for (let h=6; h<18; h++){
      const v = String(h).padStart(2,"0") + ":00";
      opts.push(`<option value="${v}">${v}</option>`);
    }
  } else {
    for (let h=18; h<=23; h++){
      const v = String(h).padStart(2,"0") + ":00";
      opts.push(`<option value="${v}">${v}</option>`);
    }
    for (let h=0; h<=6; h++){
      const v = String(h).padStart(2,"0") + ":00";
      opts.push(`<option value="${v}">${v}</option>`);
    }
  }

  const prev = sel.value;
  sel.innerHTML = opts.join("");
  const still = Array.from(sel.options).some(o => o.value === prev);
  sel.value = still ? prev : (sel.options[0]?.value || "");
}

document.addEventListener("DOMContentLoaded", () => {
  buildNvHoraOptions();
  renderNovedades();
});

document.getElementById("cgRango")?.addEventListener("change", () => {
  buildNvHoraOptions();
  renderNovedades();
});

let NV_EDITING = false;

function rangoActual() {
  return document.getElementById("cgRango")?.value === "18-06" ? "18-06" : "06-18";
}
function horaEnPuntoValida(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [h, m] = hhmm.split(":").map(Number);
  if (m !== 0) return false;
  if (rangoActual() === "06-18") return h >= 6 && h <= 18;
  return (h >= 18 && h <= 23) || (h >= 0 && h <= 6);
}
function ordenHoraParaRango(hora) {
  if (!hora) return 999;
  const h = parseInt(hora.split(":")[0], 10);
  const rango = rangoActual();
  if (rango === "06-18") {
    if (h >= 6 && h <= 18) return h - 6;
    return 999;
  }
  if (rango === "18-06") {
    if (h >= 18 && h <= 23) return h - 18;
    if (h >= 0 && h <= 6)   return h + 6;
    return 999;
  }
  return h;
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
    const linea = li.closest(".linea-card")?.querySelector("h3")?.textContent.trim() || "";
    const originalHeight = Math.max(60, Math.round(li.getBoundingClientRect().height));

    const horaActual = li.dataset.hora || li.querySelector("b")?.textContent.replace(/:$/, "").trim() || "06:00";
    const textoActual = li.dataset.texto || li.querySelector(".nv-text")?.textContent || "";

    li.dataset.originalLinea = linea;
    li.dataset.originalHora  = horaActual;
    li.dataset.originalTexto = textoActual;

    li.classList.add("editing");
    li.innerHTML = "";

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

    li.appendChild(inHora);
    li.appendChild(ta);
  });
}

function saveNvEdits() {
  if (!NV_EDITING) return;

  const items = Array.from(document.querySelectorAll(".linea-card li.editing"));
  const list = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");

  for (const li of items) {
    const inHora = li.querySelector('input[type="time"]');
    const ta     = li.querySelector('textarea');
    if (!inHora || !ta) continue;

    const oldLinea = li.dataset.originalLinea || "";
    const oldHora  = li.dataset.originalHora  || "";
    const oldTexto = li.dataset.originalTexto || "";

    const newHora  = (inHora.value || "").trim();
    const newTexto = (ta.value || "").trim();

    if (!newTexto) { alert("Hay una novedad sin descripción."); ta.focus(); return; }
    if (!horaEnPuntoValida(newHora)) { alert("Hay una hora fuera de la franja o no es 'en punto'."); inHora.focus(); return; }

    const idx = list.findIndex(nv => nv.linea === oldLinea && nv.hora === oldHora && nv.texto === oldTexto);
    if (idx !== -1) list[idx] = { linea: oldLinea, hora: newHora, texto: newTexto };
    else list.push({ linea: oldLinea, hora: newHora, texto: newTexto });
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
  const lectura = document.getElementById("modeBtn")?.classList.contains("is-lectura");
  if (bar) bar.style.display = lectura ? "none" : "flex";

  document.querySelectorAll(".linea-card ul").forEach(u => u.innerHTML = "");

  const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  sortNovedadesArray(saved);

  saved.forEach(({ linea, hora, texto }) => {
    const card = Array.from(document.querySelectorAll(".linea-card"))
      .find(c => c.querySelector("h3")?.textContent.trim() === linea);
    if (!card) return;

    const ul = card.querySelector("ul");
    const li = document.createElement("li");
    li.dataset.linea = linea;
    li.dataset.hora  = hora;
    li.dataset.texto = texto;

    const b = document.createElement("b");
    b.textContent = `${hora}:`;

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "flex-start";
    wrap.style.gap = "8px";

    const spanTxt = document.createElement("span");
    spanTxt.className = "nv-text";
    spanTxt.textContent = texto;
    spanTxt.style.flex = "1 1 auto";

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "nv-del";
    btnDel.textContent = "×";
    btnDel.title = "Eliminar novedad";
    btnDel.style.flex = "0 0 auto";
    btnDel.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("¿Eliminar esta novedad?")) deleteNovedad(linea, hora, texto);
    });
    if (lectura) btnDel.style.display = "none";

    wrap.appendChild(spanTxt);
    wrap.appendChild(btnDel);

    li.appendChild(b);
    li.appendChild(wrap);
    ul?.appendChild(li);
  });
}

function clearNovedades() {
  if (!confirm("¿Borrar todas las novedades guardadas?")) return;
  localStorage.removeItem(FORM_KEY);
  document.querySelectorAll(".linea-card ul").forEach(u => u.innerHTML = "");
}

function addNovedad(linea, hora, texto) {
  const saved = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  saved.push({ linea, hora, texto });
  sortNovedadesArray(saved);
  localStorage.setItem(FORM_KEY, JSON.stringify(saved));
  renderNovedades();
}

function deleteNovedad(linea, hora, texto) {
  const list = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
  const idx = list.findIndex(nv => nv.linea === linea && nv.hora === hora && nv.texto === texto);
  if (idx !== -1) {
    list.splice(idx, 1);
    localStorage.setItem(FORM_KEY, JSON.stringify(list));
  }
  renderNovedades();
}

formNovedad?.addEventListener("submit", e => {
  e.preventDefault();

  const selHora = document.getElementById("nvHora");
  if (selHora && selHora.tagName.toLowerCase() === "select" && selHora.options.length === 0) buildNvHoraOptions();

  const linea = (nvLinea?.value || "").trim();
  const hora  = (document.getElementById("nvHora")?.value || "").trim();
  const texto = (nvTexto?.value || "").trim();

  const rango = document.getElementById("cgRango")?.value || "06-18";

  if (!linea || !hora || !texto) { alert("Por favor completá todos los campos."); return; }
  if (!/^\d{2}:00$/.test(hora)) { alert("Usá horas en punto (HH:00)."); return; }

  const h = parseInt(hora.split(":")[0], 10);
  let valido = false;
  if (rango === "06-18" && h >= 6 && h < 18) valido = true;
  if (rango === "18-06" && (h >= 18 || h < 6)) valido = true;
  if (!valido) { alert("⚠️ La hora ingresada está fuera del rango seleccionado."); return; }

  addNovedad(linea, hora, texto);
  formNovedad.reset();
  buildNvHoraOptions();
  renderNovedades();
});

nvClear?.addEventListener("click", () => clearNovedades());
cgClearBtn?.addEventListener("click", () => cgClear());

/* =========================
   TABLA PRINCIPAL (localStorage)
   ========================= */
const TABLA_KEY = "tabla_produccion_v1";
const TABLA_FILTRO_KEY = "tabla_filtrar_completas_v1";

document.addEventListener("DOMContentLoaded", () => {
  restoreTabla();
  document.querySelectorAll(".tabla-produccion td[contenteditable]").forEach(td => td.addEventListener("input", saveTabla));
});

function saveTabla() {
  const filas = [];
  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    const linea = tr.querySelector("th")?.textContent.trim() || "";
    const celdas = Array.from(tr.querySelectorAll("td")).map(td => td.textContent.trim());
    filas.push({ linea, celdas });
  });
  localStorage.setItem(TABLA_KEY, JSON.stringify(filas));
  resaltarCeldasConDatos();
}

function resaltarCeldasConDatos() {
  document.querySelectorAll(".tabla-produccion tbody td").forEach(td => {
    const texto = td.textContent.trim();
    td.classList.toggle("has-data", texto.length > 0);
  });
}

function restoreTabla() {
  const saved = JSON.parse(localStorage.getItem(TABLA_KEY) || "[]");
  saved.forEach(({ linea, celdas }) => {
    const fila = Array.from(document.querySelectorAll(".tabla-produccion tbody tr"))
      .find(tr => tr.querySelector("th")?.textContent.trim() === linea);
    if (fila) {
      const tds = fila.querySelectorAll("td");
      for (let i = 0; i < tds.length; i++) tds[i].textContent = (celdas && celdas[i]) ? celdas[i] : "";
    }
  });
  resaltarCeldasConDatos();

  const onlyCompletedStored = localStorage.getItem(TABLA_FILTRO_KEY) === "true";
  const onlyCompleted = document.getElementById("modeBtn")?.classList.contains("is-lectura") ? true : onlyCompletedStored;
  aplicarFiltroFilasCompletadas(onlyCompleted);
}

function filaTieneContenido(tr) {
  const celdas = Array.from(tr.querySelectorAll("td")).map(td => td.textContent.trim());
  return celdas.some(txt => txt.length > 0);
}

function aplicarFiltroFilasCompletadas(onlyCompleted) {
  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    const visible = !onlyCompleted || filaTieneContenido(tr);
    tr.style.display = visible ? "" : "none";
  });
  localStorage.setItem(TABLA_FILTRO_KEY, onlyCompleted ? "true" : "false");
}

let TABLE_EDITING = false;

function setTableEditing(on) {
  TABLE_EDITING = !!on;
  document.querySelectorAll(".tabla-produccion tbody td").forEach(td => {
    td.setAttribute("contenteditable", on ? "true" : "false");
    td.classList.toggle("is-editing", on);
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
    tn: document.getElementById("tn")?.value || "",
    fecha: document.getElementById("fecha")?.value || "",
    dia: document.getElementById("dia")?.value || ""
  };
  localStorage.setItem(ENC_KEY, JSON.stringify(data));
}
function restoreEncabezado() {
  const saved = JSON.parse(localStorage.getItem(ENC_KEY) || "{}");
  if (saved.turno) document.getElementById("turno").value = saved.turno;
  if (saved.tn) document.getElementById("tn").value = saved.tn;
  if (saved.fecha) document.getElementById("fecha").value = saved.fecha;
  if (saved.dia) document.getElementById("dia").value = saved.dia;
}
function clearEncabezado() {
  localStorage.removeItem(ENC_KEY);
  if (document.getElementById("turno")) document.getElementById("turno").value = "";
  if (document.getElementById("tn")) document.getElementById("tn").value = "";
  if (document.getElementById("fecha")) document.getElementById("fecha").value = "";
  if (document.getElementById("dia")) document.getElementById("dia").value = "";
}

["turno","tn","fecha","dia"].forEach(id => document.getElementById(id)?.addEventListener("change", saveEncabezado));
document.addEventListener("DOMContentLoaded", restoreEncabezado);

document.getElementById("cgClear")?.addEventListener("click", clearEncabezado);
document.getElementById("nvClear")?.addEventListener("click", clearEncabezado);

/* =========================
   PDF
   ========================= */
const btnInforme = document.getElementById("btnInforme");

function toggleBotoneras(visible) {
  const secciones = document.querySelectorAll('.cg-form, .form-novedad, .acciones, button');
  secciones.forEach(el => el.style.display = visible ? '' : 'none');
}

btnInforme?.addEventListener("click", async () => {
  toggleBotoneras(false);

  btnInforme.classList.add("is-busy");
  btnInforme.setAttribute("aria-busy", "true");
  btnInforme.disabled = true;

  try {
    await new Promise(r => setTimeout(r, 600));

    const area = document.body;
    const canvas = await html2canvas(area, { scale: 2 });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const imgData = canvas.toDataURL("image/png");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH  = (canvas.height * pageW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(imgData, "PNG", 0, 0, pageW, imgH);
    } else {
      let y = 0;
      while (y < imgH) {
        pdf.addImage(imgData, "PNG", 0, -y * (pageH / imgH), pageW, imgH);
        y += pageH;
        if (y < imgH - 10) pdf.addPage();
      }
    }

    pdf.save("informe-produccion.pdf");
  } finally {
    toggleBotoneras(true);
    btnInforme.classList.remove("is-busy");
    btnInforme.removeAttribute("aria-busy");
    btnInforme.disabled = false;
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
    ];
    selectors.forEach(sel => document.querySelectorAll(sel).forEach(el => {
      if (el.id === "modeBtn" || el.closest("#modeBtn")) return;
      el.style.display = show ? "" : "none";
    }));

    ["turno", "tn", "fecha"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !show;
    });
  }

  function applyMode(mode) {
    const lectura = mode === "lectura";
    modeBtn.classList.toggle("is-lectura", lectura);
    showEditUI(!lectura);
    updateBarDeleteVisibility(!lectura);
    if (lectura) setTableEditing(false);
    localStorage.setItem(MODE_KEY, mode);
    renderNovedades();
  }

  modeBtn.onclick = () => {
    const newMode = modeBtn.classList.contains("is-lectura") ? "carga" : "lectura";
    applyMode(newMode);
  };

  applyMode(localStorage.getItem(MODE_KEY) || "carga");
})();

/* Labels móviles en celdas (como ya tenías) */
document.addEventListener("DOMContentLoaded", () => {
  const labels = [
    "Sabor 1", "Formato 1", "Velocidad nominal 1",
    "Sabor 2", "Formato 2", "Velocidad nominal 2"
  ];
  document.querySelectorAll(".tabla-produccion tbody tr").forEach(tr => {
    tr.querySelectorAll("td").forEach((td, i) => td.setAttribute("data-label", labels[i] || ""));
  });
});