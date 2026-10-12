'use strict';

/* ================= Datos ================= */
const KEY = 'misfinanzas.v1';
const CATEGORIAS_BASE = [
  { n: 'Salario y honorarios', i: '💼' }, { n: 'Otros ingresos', i: '💰' },
  { n: 'Mercado', i: '🛒' }, { n: 'Comida y restaurantes', i: '🍔' }, { n: 'Transporte', i: '🚗' },
  { n: 'Servicios', i: '💡' }, { n: 'Vivienda', i: '🏠' }, { n: 'Salud', i: '🩺' },
  { n: 'Compras', i: '🛍️' }, { n: 'Suscripciones', i: '📺' }, { n: 'Entretenimiento', i: '🎉' },
  { n: 'Educación', i: '📚' }, { n: 'Efectivo', i: '🏧' }, { n: 'Transferencias a terceros', i: '↗️' },
  { n: 'Pago de deudas', i: '💳' }, { n: 'Otros gastos', i: '📦' },
  { n: 'Entre mis cuentas', i: '🔁', excluir: true }, { n: 'Sin categoría', i: '❓' }
];

// Palabras clave → categoría (se aplican si no hay una regla aprendida).
const PALABRAS = [
  [/\bNU COMPANIA|FINANCIAMIENTO|TARJETA DE CREDITO|PRESTAMO|\bADDI\b|SISTECREDITO|CREDITO/, 'Pago de deudas'],
  [/EXITO|CARULLA|\bD1\b|\bARA\b|OLIMPICA|JUMBO|MERCA|SURTIMAX|ISIMO|PRICESMART|MAKRO|FRUVER/, 'Mercado'],
  [/RAPPI|IFOOD|MCDONALD|FRISBY|CREPES|RESTAUR|PIZZA|JUAN VALDEZ|STARBUCKS|KFC|BURGER|PANADER|DOMICILIOS/, 'Comida y restaurantes'],
  [/UBER|DIDI|CABIFY|INDRIVE|TERPEL|PRIMAX|\bESSO\b|TEXACO|BIOMAX|PEAJE|METRO|PARQUEADERO|FLYPASS|CIVICA/, 'Transporte'],
  [/\bEPM\b|CLARO|MOVISTAR|\bTIGO\b|\bETB\b|\bUNE\b|ACUEDUCTO|CODENSA|ENEL|VANTI|GASES|AIRE S A|EMCALI/, 'Servicios'],
  [/NETFLIX|SPOTIFY|APPLE|GOOGLE|AMAZON PRIME|DISNEY|HBO|\bMAX\b|YOUTUBE|CHATGPT|OPENAI|ANTHROPIC|ICLOUD/, 'Suscripciones'],
  [/DROGUER|FARMA|CRUZ VERDE|PASTEUR|LOCATEL|CLINICA|HOSPITAL|EPS\b|SURA|ODONTO/, 'Salud'],
  [/FALABELLA|ZARA|ARTURO CALLE|MERCADO ?LIBRE|AMAZON|TEMU|SHEIN|HOMECENTER|ALKOSTO|KTRONIX|FLAMINGO/, 'Compras'],
  [/CINE|PROCINAL|CINEMARK|CINECOLOMBIA|TUBOLETA|ETICKET|BAR\b|DISCO/, 'Entretenimiento'],
  [/UNIVERSIDAD|COLEGIO|PLATZI|UDEMY|COURSERA|ICETEX/, 'Educación'],
  [/ARRIENDO|INMOBILIARIA|ADMINISTRACION|CONJUNTO|PROPIEDAD HORIZONTAL/, 'Vivienda']
];

let S = cargar();
let UI = { tab: 'inicio', mes: mesActual(), filtro: 'todos', busqueda: '' };

function estadoVacio() {
  return { v: 1, txs: [], deudas: [], reglas: {}, hashes: {}, categorias: CATEGORIAS_BASE.slice(), config: { titular: '' } };
}
function cargar() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return Object.assign(estadoVacio(), s);
  } catch (e) { /* almacenamiento no disponible */ }
  return estadoVacio();
}
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('⚠️ No se pudo guardar. Haz una copia de seguridad.'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ================= Utilidades ================= */
const $ = (sel, el = document) => el.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('es-CO');
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function hoy() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function mesActual() { return hoy().slice(0, 7); }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = ym => { const [y, m] = ym.split('-'); return `${MESES[+m - 1]} ${y}`; };
function moverMes(ym, d) { let [y, m] = ym.split('-').map(Number); m += d; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, '0')}`; }
function fechaLarga(f) {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}
const cat = n => S.categorias.find(c => c.n === n) || { n, i: '🏷️' };
const excluida = n => !!cat(n).excluir;
const titleCase = s => s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (a, b, c) => b + c.toUpperCase());

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ================= Inteligencia: categorizar ================= */
const claveRegla = tx => tx.tipo + ':' + norm(tx.contraparte);

function esTitular(nombre) {
  const a = norm(S.config.titular).split(' ').filter(w => w.length > 2);
  const b = norm(nombre).split(' ').filter(w => w.length > 2);
  if (a.length < 2 || b.length < 2) return false;
  const comunes = b.filter(w => a.includes(w)).length;
  return comunes >= Math.min(3, b.length);
}

function deudaPara(tx) {
  if (tx.tipo !== 'gasto') return null;
  const c = norm(tx.contraparte);
  return S.deudas.find(d => !d.cerrada && tx.fecha >= d.fechaInicio &&
    d.claves.split(',').map(norm).filter(Boolean).some(k => c.includes(k))) || null;
}

function categorizar(tx) {
  if (tx.contraparte && esTitular(tx.contraparte)) return 'Entre mis cuentas';
  const d = deudaPara(tx);
  if (d) { tx.deudaId = d.id; return 'Pago de deudas'; }
  const regla = S.reglas[claveRegla(tx)];
  if (regla) return regla;
  const c = norm(tx.contraparte);
  if (tx.tipo === 'gasto') for (const [re, n] of PALABRAS) if (re.test(c)) return n;
  if (tx.medio === 'retiro') return 'Efectivo';
  if (tx.tipo === 'ingreso') return 'Otros ingresos';
  if (tx.medio === 'transferencia') return 'Transferencias a terceros';
  return 'Sin categoría';
}

// Cuando el usuario corrige una categoría, se aprende y se aplica a los movimientos parecidos.
function aprender(tx, categoria) {
  if (!tx.contraparte) return 0;
  const k = claveRegla(tx);
  S.reglas[k] = categoria;
  let n = 0;
  for (const o of S.txs) {
    if (o.id !== tx.id && !o.catManual && !o.deudaId && claveRegla(o) === k && o.categoria !== categoria) {
      o.categoria = categoria; o.revisar = false; n++;
    }
  }
  return n;
}

/* ================= Importación ================= */
// Convierte un SMS en movimiento (sin guardarlo). null si no es un movimiento.
function crearTx(msg, h) {
  const p = Parser.parseSMS(msg);
  if (!p) return null;
  if (p.titular && !S.config.titular) S.config.titular = titleCase(p.titular);
  const tx = {
    id: uid(), hash: h, origen: 'sms', banco: p.banco,
    fecha: p.fecha || hoy(), hora: p.hora, tipo: p.tipo, medio: p.medio, monto: p.monto,
    contraparte: p.contraparte, cuenta: p.cuenta, revisar: p.revisar, nota: '', raw: p.raw, deudaId: null
  };
  tx.categoria = categorizar(tx);
  return tx;
}

// El atajo puede guardar el mismo SMS dos veces: primero tal cual (respaldo) y luego con
// " ##cat=<categoría elegida en la lista>". Se unen por hash y gana la categoría elegida.
const NO_REGISTRAR = /^no registrar$/i, DESPUES = /^decidir despu[eé]s$/i;
function partirMensajes(texto) {
  const porHash = new Map();
  for (const trozo of Parser.dividirMensajes(texto)) {
    const m = trozo.match(/^([\s\S]*?)\s*##cat=\s*(.*)$/);
    const msg = m ? m[1] : trozo, cat = m ? m[2].trim() : '';
    if (msg.length < 10) continue;
    const h = Parser.hash(msg);
    const prev = porHash.get(h);
    if (!prev) porHash.set(h, { msg, h, cat });
    else if (cat) prev.cat = cat;
  }
  return [...porHash.values()];
}
function categoriaElegida(nombre) {
  if (!nombre || DESPUES.test(nombre)) return null;
  const c = S.categorias.find(x => norm(x.n) === norm(nombre));
  if (c) return c.n;
  S.categorias.splice(S.categorias.length - 2, 0, { n: nombre, i: '🏷️' });
  return nombre;
}

function importarTexto(texto) {
  const res = { nuevos: 0, repetidos: 0, ignorados: [], descartados: 0 };
  for (const { msg, h, cat } of partirMensajes(texto)) {
    if (S.hashes[h]) { res.repetidos++; continue; }
    if (NO_REGISTRAR.test(cat)) { S.hashes[h] = 1; res.descartados++; continue; }
    const tx = crearTx(msg, h);
    if (!tx) { res.ignorados.push(msg); continue; }
    const elegida = categoriaElegida(cat);
    if (elegida) {
      if (elegida !== tx.categoria && tx.contraparte) { tx.catManual = true; aprender(tx, elegida); }
      if (elegida !== 'Pago de deudas') tx.deudaId = null;
      tx.categoria = elegida; tx.revisar = false;
    }
    S.txs.push(tx); S.hashes[h] = 1; res.nuevos++;
  }
  guardar();
  return res;
}

/* ===== Llegada directa desde Atajos: ...#sms=<texto> abre una pantalla de confirmación ===== */
let pendientes = [];

function revisarEnlace() {
  const m = location.hash.match(/^#sms=(.*)$/s);
  if (!m) return;
  let texto = m[1];
  try { texto = decodeURIComponent(texto); } catch (_) { /* ya venía decodificado */ }
  history.replaceState(null, '', location.pathname); // no dejar el SMS en el historial
  for (const { msg, h } of partirMensajes(texto)) {
    if (S.hashes[h] || pendientes.some(p => p.hash === h)) continue;
    pendientes.push(crearTx(msg, h) || { hash: h, noReconocido: true, raw: Parser.limpiar(msg) });
  }
  if (pendientes.length) mostrarPendiente();
  else if (m[1]) toast('Ese movimiento ya estaba registrado');
}

function mostrarPendiente() {
  const t = pendientes[0];
  if (!t) { cerrarHoja(); render(); return; }
  const quedan = pendientes.length > 1 ? `<p class="muted center small">${pendientes.length - 1} más después de este</p>` : '';
  if (t.noReconocido) {
    abrirHoja(`<div class="nuevo">
      <div class="big">🤔</div><h2>No reconocí este mensaje</h2>
      <p class="raw">${esc(t.raw)}</p>
      <button class="btn" data-pend-manual>Registrarlo a mano</button>
      <button class="btn sec" data-pend-descartar>No es un movimiento</button>${quedan}</div>`, true);
    return;
  }
  const ing = t.tipo === 'ingreso';
  abrirHoja(`<form id="fPend" class="nuevo">
    <span class="pill ${ing ? 'pos' : 'neg'}">${ing ? '⬇️ Te entró plata' : '⬆️ Salió plata'}</span>
    <div class="montoGrande ${ing ? 'pos' : 'neg'}">${ing ? '+' : '-'}${fmt(t.monto)}</div>
    <h2>${esc(t.contraparte ? titleCase(t.contraparte) : 'Movimiento')}</h2>
    <p class="muted">${fechaLarga(t.fecha)}${t.hora ? ' · ' + t.hora : ''} · Bancolombia</p>
    <label>Categoría<select name="categoria">${opcionesCat(t.categoria)}</select></label>
    ${t.tipo === 'gasto' && S.deudas.some(d => !d.cerrada) ? `<label>Abono a deuda<select name="deudaId">${opcionesDeuda(t.deudaId)}</select></label>` : ''}
    <label>Nota (opcional)<input name="nota" placeholder="Ej: almuerzo con amigos"></label>
    <button class="btn grande" type="submit">✓ Guardar</button>
    <button class="btn sec" type="button" data-pend-descartar>Descartar</button>
    <details><summary class="muted small">Ver SMS</summary><p class="raw">${esc(t.raw)}</p></details>
    ${quedan}</form>`, true);
}

function guardarPendiente(form) {
  const t = pendientes.shift();
  const f = new FormData(form);
  const sugerida = t.categoria;
  t.categoria = f.get('categoria');
  if (f.has('deudaId')) t.deudaId = f.get('deudaId') || null;
  t.nota = (f.get('nota') || '').trim();
  t.revisar = false;
  S.txs.push(t); S.hashes[t.hash] = 1;
  let msg = '✅ Guardado';
  if (t.categoria !== sugerida && t.contraparte) { t.catManual = true; aprender(t, t.categoria); msg = '✅ Guardado. La próxima vez lo sugeriré así'; }
  guardar(); toast(msg); mostrarPendiente();
}

function mostrarResultado(res) {
  const box = $('#resultado');
  box.innerHTML = `
    <div class="card">
      <div class="stats3">
        <div><b class="pos">${res.nuevos}</b><span>nuevos</span></div>
        <div><b>${res.repetidos}</b><span>ya estaban</span></div>
        <div><b class="${res.ignorados.length ? 'warn' : ''}">${res.ignorados.length}</b><span>no reconocidos</span></div>
      </div>
      ${res.ignorados.length ? `<details><summary>Ver mensajes no reconocidos</summary>${res.ignorados.map(m => `<p class="raw">${esc(m)}</p>`).join('')}<p class="muted small">Si alguno es un movimiento real, mándame el texto para enseñarle a la app ese formato, o regístralo a mano.</p></details>` : ''}
    </div>`;
  if (res.nuevos) toast(`✅ ${res.nuevos} movimiento${res.nuevos > 1 ? 's' : ''} importado${res.nuevos > 1 ? 's' : ''}`);
}

/* ================= Cálculos ================= */
const delMes = ym => S.txs.filter(t => t.fecha.startsWith(ym));
function resumen(ym) {
  let ing = 0, gas = 0; const porCat = {};
  for (const t of delMes(ym)) {
    if (excluida(t.categoria)) continue;
    if (t.tipo === 'ingreso') ing += t.monto;
    else { gas += t.monto; porCat[t.categoria] = (porCat[t.categoria] || 0) + t.monto; }
  }
  return { ing, gas, porCat };
}
const pagosDeuda = d => S.txs.filter(t => t.deudaId === d.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
function saldoDeuda(d) {
  const pagado = pagosDeuda(d).reduce((s, t) => s + t.monto, 0);
  const cargos = (d.cargos || []).reduce((s, c) => s + c.monto, 0);
  const total = d.montoInicial + cargos;
  return { total, pagado, saldo: Math.max(0, total - pagado) };
}
const porRevisar = () => S.txs.filter(t => t.revisar || t.categoria === 'Sin categoría');

/* ================= Render ================= */
function render() {
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === UI.tab));
  $('#mesbar').hidden = !['inicio', 'movimientos'].includes(UI.tab);
  $('#mesNombre').textContent = nombreMes(UI.mes);
  const v = { inicio: vInicio, movimientos: vMovimientos, deudas: vDeudas, importar: vImportar, ajustes: vAjustes }[UI.tab];
  $('#vista').innerHTML = v();
  $('#titulo').textContent = { inicio: 'Mis finanzas', movimientos: 'Movimientos', deudas: 'Deudas', importar: 'Importar', ajustes: 'Ajustes' }[UI.tab];
}

function filaTx(t) {
  const c = cat(t.categoria);
  const signo = t.tipo === 'ingreso' ? '+' : '-';
  return `<button class="tx" data-tx="${t.id}">
    <span class="ico">${c.i}</span>
    <span class="txm"><b>${esc(t.contraparte ? titleCase(t.contraparte) : '(sin descripción)')}</b>
      <small>${esc(t.categoria)}${t.deudaId ? ' · ' + esc((S.deudas.find(d => d.id === t.deudaId) || {}).nombre || '') : ''}${t.revisar || t.categoria === 'Sin categoría' ? ' · <em class="warn">revisar</em>' : ''}</small></span>
    <span class="monto ${t.tipo === 'ingreso' ? 'pos' : ''} ${excluida(t.categoria) ? 'excl' : ''}">${signo}${fmt(t.monto)}</span>
  </button>`;
}

function vInicio() {
  const r = resumen(UI.mes);
  const bal = r.ing - r.gas;
  const cats = Object.entries(r.porCat).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;
  const rev = porRevisar().length;
  const ult = delMes(UI.mes).sort((a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || ''))).slice(0, 5);
  const deudasAct = S.deudas.filter(d => !d.cerrada);
  const totalDeuda = deudasAct.reduce((s, d) => s + saldoDeuda(d).saldo, 0);

  if (!S.txs.length && !S.deudas.length) return `
    <div class="card vacio">
      <div class="big">👋</div>
      <h2>Empecemos</h2>
      <p>Importa tus mensajes de Bancolombia para ver tus ingresos y gastos.</p>
      <button class="btn" data-ir="importar">Importar mensajes</button>
    </div>`;

  return `
    <div class="card hero">
      <span class="muted">Balance del mes</span>
      <div class="balance ${bal >= 0 ? 'pos' : 'neg'}">${fmt(bal)}</div>
      <div class="dos">
        <div><span class="muted">Ingresos</span><b class="pos">${fmt(r.ing)}</b></div>
        <div><span class="muted">Gastos</span><b class="neg">${fmt(r.gas)}</b></div>
      </div>
    </div>
    ${rev ? `<button class="aviso" data-revisar>❓ <b>${rev}</b> movimiento${rev > 1 ? 's' : ''} por revisar <span>›</span></button>` : ''}
    ${cats.length ? `<h3>¿En qué se fue la plata?</h3><div class="card">${cats.map(([n, v]) => `
      <div class="barra"><div class="bl"><span>${cat(n).i} ${esc(n)}</span><b>${fmt(v)}</b></div>
      <div class="bt"><div style="width:${Math.max(3, v / max * 100)}%"></div></div>
      <small class="muted">${Math.round(v / r.gas * 100)}% de los gastos</small></div>`).join('')}</div>` : ''}
    ${deudasAct.length ? `<h3>Deudas</h3><button class="card fila" data-ir="deudas">
      <span>💳 ${deudasAct.length} deuda${deudasAct.length > 1 ? 's' : ''} activa${deudasAct.length > 1 ? 's' : ''}</span><b class="neg">${fmt(totalDeuda)}</b></button>
      ${proximosPagos()}` : ''}
    ${ult.length ? `<h3>Últimos movimientos</h3><div class="card lista">${ult.map(filaTx).join('')}</div>` : `<p class="muted center">No hay movimientos en ${nombreMes(UI.mes)}.</p>`}`;
}

function proximosPagos() {
  const ym = mesActual(), dia = new Date().getDate();
  const items = S.deudas.filter(d => !d.cerrada && d.diaPago).map(d => {
    const pagadoMes = pagosDeuda(d).some(t => t.fecha.startsWith(ym));
    return { d, pagadoMes, faltan: d.diaPago - dia };
  }).filter(x => !x.pagadoMes).sort((a, b) => a.faltan - b.faltan);
  if (!items.length) return '';
  return `<div class="card">${items.map(x => `<div class="fila"><span>${esc(x.d.nombre)} · cuota ${fmt(x.d.cuota || 0)}</span>
    <small class="${x.faltan < 0 ? 'neg' : x.faltan <= 3 ? 'warn' : 'muted'}">${x.faltan < 0 ? 'vencida hace ' + -x.faltan + ' d' : x.faltan === 0 ? 'vence hoy' : 'en ' + x.faltan + ' días'}</small></div>`).join('')}</div>`;
}

function vMovimientos() {
  let lista = UI.filtro === 'revisar' ? porRevisar() : delMes(UI.mes);
  if (UI.filtro === 'gasto' || UI.filtro === 'ingreso') lista = lista.filter(t => t.tipo === UI.filtro);
  if (UI.busqueda) {
    const q = norm(UI.busqueda);
    lista = S.txs.filter(t => norm(t.contraparte + ' ' + t.categoria + ' ' + t.nota).includes(q));
  }
  lista.sort((a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || '')));
  const grupos = {};
  for (const t of lista) (grupos[t.fecha] = grupos[t.fecha] || []).push(t);
  const chip = (k, l) => `<button class="chip ${UI.filtro === k ? 'on' : ''}" data-filtro="${k}">${l}</button>`;
  return `
    <input class="buscar" type="search" placeholder="Buscar en todos los meses…" value="${esc(UI.busqueda)}" id="buscar">
    <div class="chips">${chip('todos', 'Todos')}${chip('gasto', 'Gastos')}${chip('ingreso', 'Ingresos')}${chip('revisar', 'Por revisar')}</div>
    ${Object.keys(grupos).length ? Object.entries(grupos).map(([f, ts]) => `
      <div class="dia"><span>${fechaLarga(f)}</span></div>
      <div class="card lista">${ts.map(filaTx).join('')}</div>`).join('')
      : `<p class="muted center">${UI.filtro === 'revisar' ? '🎉 Nada por revisar.' : 'Sin movimientos.'}</p>`}
    <button class="fab" data-nuevo-tx aria-label="Agregar movimiento">＋</button>`;
}

function vDeudas() {
  const act = S.deudas.filter(d => !d.cerrada), cer = S.deudas.filter(d => d.cerrada);
  const total = act.reduce((s, d) => s + saldoDeuda(d).saldo, 0);
  const tarjeta = d => {
    const s = saldoDeuda(d), pct = s.total ? Math.min(100, s.pagado / s.total * 100) : 0;
    return `<button class="card deuda" data-deuda="${d.id}">
      <div class="fila"><b>${esc(d.nombre)}</b><b class="${d.cerrada ? 'pos' : 'neg'}">${d.cerrada ? 'Pagada' : fmt(s.saldo)}</b></div>
      <div class="bt"><div class="ok" style="width:${pct}%"></div></div>
      <div class="fila"><small class="muted">Pagado ${fmt(s.pagado)} de ${fmt(s.total)}</small><small class="muted">${d.cuota ? 'Cuota ' + fmt(d.cuota) : ''}${d.diaPago ? ' · día ' + d.diaPago : ''}</small></div>
    </button>`;
  };
  return `
    ${act.length ? `<div class="card hero"><span class="muted">Total que debes</span><div class="balance neg">${fmt(total)}</div></div>` : ''}
    ${act.map(tarjeta).join('') || `<div class="card vacio"><div class="big">💳</div><p>Registra tus deudas. Cuando llegue un SMS de un pago a esa entidad, la app lo descuenta sola.</p></div>`}
    ${cer.length ? `<h3>Pagadas</h3>${cer.map(tarjeta).join('')}` : ''}
    <button class="btn" data-nueva-deuda>＋ Agregar deuda</button>`;
}

function vImportar() {
  return `
    <div class="card">
      <h2>📥 Importar desde Atajos</h2>
      <p class="muted">Elige el archivo <b>movimientos-banco.txt</b> en iCloud Drive › Atajos. Los mensajes que ya estaban no se duplican.</p>
      <label class="btn">Elegir archivo<input type="file" accept=".txt,text/plain" id="archivo" hidden></label>
    </div>
    <div class="card">
      <h2>📋 Pegar mensajes</h2>
      <p class="muted">Copia uno o varios SMS de Bancolombia y pégalos aquí.</p>
      <textarea id="pegado" rows="5" placeholder="Bancolombia: Pagaste $10,000.00 a …"></textarea>
      <button class="btn" data-procesar>Procesar</button>
    </div>
    <div id="resultado"></div>
    <button class="btn sec" data-nuevo-tx>✍️ Registrar movimiento a mano</button>
    <details class="card guia" ${S.txs.length ? '' : 'open'}>
      <summary><b>⚙️ Configurar la captura automática (una sola vez)</b></summary>
      <ol>
        <li>App <b>Atajos</b> › <b>Automatización</b> › <b>＋</b> › <b>Mensaje</b> › “El mensaje contiene” <code>Bancolombia</code> › <b>Ejecutar de inmediato</b>.</li>
        <li><b>Recibir mensajes como entrada</b>, luego <b>Texto</b> con <code>---</code> + <b>Entrada de atajo › Contenido</b>, luego <b>Anexar al final del archivo de texto</b> (ruta <code>movimientos-banco.txt</code>, Crear línea nueva activado). Es el respaldo.</li>
        <li><b>Texto</b> con una categoría por línea (las mismas de la app, más <code>Decidir después</code> y <code>No registrar</code>).</li>
        <li><b>Dividir texto</b> por <b>Nuevas líneas</b>.</li>
        <li><b>Elegir de la lista</b> (Texto dividido); en <b>Solicitud</b> pon la variable <b>Contenido</b> para ver el SMS.</li>
        <li><b>Texto</b>: <code>---</code> + <b>Contenido</b> + <code> ##cat=</code> + <b>Elemento elegido</b>.</li>
        <li><b>Anexar al final del archivo de texto</b> con ese último Texto, a <code>movimientos-banco.txt</code>.</li>
      </ol>
      <p class="muted small">Con cada SMS aparece la lista encima de lo que estés usando. Cuando quieras ver todo aquí, toca <b>Elegir archivo</b>: entran ya categorizados.</p>
      <p class="muted small">Tip: el archivo guarda todo el historial, así que aunque borres la app puedes volver a importarlo.</p>
    </details>`;
}

function vAjustes() {
  const reglas = Object.entries(S.reglas);
  return `
    <div class="card">
      <h2>👤 Tu nombre</h2>
      <p class="muted small">Sirve para reconocer transferencias entre tus propias cuentas (no cuentan como ingreso ni gasto). Se detecta solo con los pagos QR.</p>
      <input id="titular" value="${esc(S.config.titular)}" placeholder="Nombre completo como aparece en el banco">
    </div>
    <div class="card">
      <h2>🧠 Lo que la app aprendió (${reglas.length})</h2>
      ${reglas.length ? reglas.sort().map(([k, v]) => `<div class="fila"><span class="small">${k.startsWith('ingreso') ? '⬇️' : '⬆️'} ${esc(titleCase(k.split(':')[1]))} → <b>${esc(v)}</b></span><button class="x" data-borrar-regla="${esc(k)}">✕</button></div>`).join('')
      : '<p class="muted small">Cuando corrijas la categoría de un movimiento, la app la recordará para los siguientes del mismo comercio o persona.</p>'}
    </div>
    <div class="card">
      <h2>🏷️ Categorías</h2>
      <div class="tags">${S.categorias.map(c => `<span class="tag">${c.i} ${esc(c.n)}${CATEGORIAS_BASE.some(b => b.n === c.n) ? '' : ` <button class="x" data-borrar-cat="${esc(c.n)}">✕</button>`}</span>`).join('')}</div>
      <div class="inline"><input id="nuevaCat" placeholder="Nueva categoría"><button class="btn mini" data-agregar-cat>Agregar</button></div>
    </div>
    <div class="card">
      <h2>☁️ Sincronización automática</h2>
      <p class="muted small">El atajo envía cada movimiento clasificado a tu repositorio <b>privado</b> de GitHub y la app lo trae sola al abrirse.</p>
      <label class="small muted">Repositorio<input id="ghRepo" value="${esc(S.config.repo || REPO_DEFECTO)}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <label class="small muted">Clave de acceso (token)<input id="ghToken" type="password" placeholder="${leerToken() ? '•••••••• (guardada)' : 'github_pat_…'}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <button class="btn" data-gh-probar>Guardar y probar conexión</button>
      <button class="btn sec" data-gh-sync>🔄 Sincronizar ahora</button>
      <button class="btn sec" data-gh-todo>Recuperar todo el historial desde GitHub</button>
      <p class="muted small center" id="ghEstado">${S.config.ultimaSync ? 'Última sincronización: ' + new Date(S.config.ultimaSync).toLocaleString('es-CO') : 'Aún no se ha sincronizado'}</p>
    </div>
    <div class="card">
      <h2>💾 Copia de seguridad</h2>
      <p class="muted small">Tus datos solo viven en este celular. Guarda una copia en iCloud de vez en cuando.</p>
      <button class="btn sec" data-exportar>Exportar copia (.json)</button>
      <button class="btn sec" data-csv>Exportar movimientos (.csv para Excel)</button>
      <label class="btn sec">Restaurar copia<input type="file" accept=".json,application/json" id="restaurar" hidden></label>
      <button class="btn peligro" data-borrar-todo>Borrar todos los datos</button>
    </div>
    <p class="muted center small">Mis Finanzas · ${S.txs.length} movimientos · ${S.deudas.length} deudas</p>`;
}

/* ================= Hojas (formularios) ================= */
function abrirHoja(html, completa = false) {
  const d = $('#hoja');
  $('#hojaCuerpo').innerHTML = html;
  d.classList.toggle('completa', completa);
  if (!d.open) d.showModal();
}
const cerrarHoja = () => $('#hoja').close();
const opcionesCat = sel => S.categorias.map(c => `<option ${c.n === sel ? 'selected' : ''}>${esc(c.n)}</option>`).join('');
const opcionesDeuda = sel => `<option value="">— Ninguna —</option>` + S.deudas.filter(d => !d.cerrada || d.id === sel).map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.nombre)}</option>`).join('');

function hojaTx(t) {
  const nuevo = !t;
  t = t || { id: '', tipo: 'gasto', monto: '', fecha: hoy(), hora: '', contraparte: '', categoria: 'Sin categoría', deudaId: '', nota: '' };
  abrirHoja(`
    <h2>${nuevo ? 'Nuevo movimiento' : 'Editar movimiento'}</h2>
    <form id="fTx" data-id="${t.id}">
      <div class="seg"><label><input type="radio" name="tipo" value="gasto" ${t.tipo === 'gasto' ? 'checked' : ''}><span>Gasto</span></label>
        <label><input type="radio" name="tipo" value="ingreso" ${t.tipo === 'ingreso' ? 'checked' : ''}><span>Ingreso</span></label></div>
      <label>Monto<input name="monto" inputmode="numeric" required value="${t.monto ? Math.round(t.monto).toLocaleString('es-CO') : ''}" placeholder="$0"></label>
      <label>Descripción / comercio<input name="contraparte" value="${esc(t.contraparte)}" placeholder="Ej: Éxito, Arriendo, Juan"></label>
      <div class="inline"><label>Fecha<input type="date" name="fecha" value="${t.fecha}" required></label>
        <label>Hora<input type="time" name="hora" value="${t.hora || ''}"></label></div>
      <label>Categoría<select name="categoria">${opcionesCat(t.categoria)}</select></label>
      <label>Abono a deuda<select name="deudaId">${opcionesDeuda(t.deudaId)}</select></label>
      <label>Nota<input name="nota" value="${esc(t.nota)}"></label>
      ${t.raw ? `<details><summary class="muted small">Ver SMS original</summary><p class="raw">${esc(t.raw)}</p></details>` : ''}
      <button class="btn" type="submit">Guardar</button>
      ${nuevo ? '' : `<button class="btn peligro" type="button" data-borrar-tx="${t.id}">Eliminar</button>`}
      <button class="btn sec" type="button" data-cerrar>Cancelar</button>
    </form>`);
}

function guardarTx(form) {
  const f = new FormData(form);
  const monto = parseFloat(String(f.get('monto')).replace(/[^\d]/g, ''));
  if (!monto) return toast('Escribe un monto válido');
  const id = form.dataset.id;
  let t = S.txs.find(x => x.id === id);
  const antes = t ? t.categoria : null;
  if (!t) { t = { id: uid(), origen: 'manual', medio: 'manual', banco: 'Manual', revisar: false }; S.txs.push(t); }
  Object.assign(t, {
    tipo: f.get('tipo'), monto, contraparte: f.get('contraparte').trim(), fecha: f.get('fecha'),
    hora: f.get('hora') || null, categoria: f.get('categoria'), deudaId: f.get('deudaId') || null, nota: f.get('nota').trim(), revisar: false
  });
  let msg = 'Guardado';
  if (antes !== null && antes !== t.categoria) {
    t.catManual = true;
    const n = aprender(t, t.categoria);
    msg = n ? `Guardado. También apliqué “${t.categoria}” a ${n} movimiento${n > 1 ? 's' : ''} parecido${n > 1 ? 's' : ''}` : 'Guardado. La próxima vez lo reconoceré solo';
  }
  guardar(); cerrarHoja(); render(); toast(msg);
}

function hojaDeuda(d) {
  const nueva = !d;
  d = d || { id: '', nombre: '', claves: '', montoInicial: '', cuota: '', diaPago: '', fechaInicio: hoy() };
  abrirHoja(`
    <h2>${nueva ? 'Nueva deuda' : 'Editar deuda'}</h2>
    <form id="fDeuda" data-id="${d.id}">
      <label>Nombre<input name="nombre" required value="${esc(d.nombre)}" placeholder="Ej: Tarjeta Nu, Préstamo carro"></label>
      <label>Saldo que debes hoy<input name="montoInicial" inputmode="numeric" required value="${d.montoInicial ? Math.round(d.montoInicial).toLocaleString('es-CO') : ''}" placeholder="$0"></label>
      <div class="inline"><label>Cuota mensual<input name="cuota" inputmode="numeric" value="${d.cuota ? Math.round(d.cuota).toLocaleString('es-CO') : ''}" placeholder="$0"></label>
        <label>Día de pago<input name="diaPago" type="number" min="1" max="31" value="${d.diaPago || ''}"></label></div>
      <label>¿Cómo aparece en el SMS cuando le pagas?<input name="claves" value="${esc(d.claves)}" placeholder="Ej: NU Compania, Bancolombia Libre"></label>
      <p class="muted small">Separa varias palabras con comas. Ejemplo: en “Pagaste $165,000.00 a <b>NU Compania de Financiamiento</b>”, escribe <code>NU Compania</code>.</p>
      <label>Contar pagos desde<input type="date" name="fechaInicio" value="${d.fechaInicio}"></label>
      <button class="btn" type="submit">Guardar</button>
      <button class="btn sec" type="button" data-cerrar>Cancelar</button>
    </form>`);
}

function guardarDeuda(form) {
  const f = new FormData(form);
  const num = k => parseFloat(String(f.get(k) || '').replace(/[^\d]/g, '')) || 0;
  const id = form.dataset.id;
  let d = S.deudas.find(x => x.id === id);
  if (!d) { d = { id: uid(), cargos: [], cerrada: false }; S.deudas.push(d); }
  Object.assign(d, { nombre: f.get('nombre').trim(), montoInicial: num('montoInicial'), cuota: num('cuota'), diaPago: num('diaPago') || null, claves: f.get('claves').trim(), fechaInicio: f.get('fechaInicio') || hoy() });
  // Vincula pagos que ya estaban registrados.
  let n = 0;
  for (const t of S.txs) if (!t.deudaId && t.tipo === 'gasto' && deudaPara(t) === d) { t.deudaId = d.id; t.categoria = 'Pago de deudas'; n++; }
  guardar(); cerrarHoja(); render();
  toast(n ? `Deuda guardada. Encontré ${n} pago${n > 1 ? 's' : ''} ya registrado${n > 1 ? 's' : ''}` : 'Deuda guardada');
}

function hojaDetalleDeuda(d) {
  const s = saldoDeuda(d), pagos = pagosDeuda(d);
  const movs = [...pagos.map(t => ({ f: t.fecha, txt: 'Pago' + (t.contraparte ? ' · ' + titleCase(t.contraparte) : ''), m: -t.monto, tx: t.id })),
    ...(d.cargos || []).map(c => ({ f: c.fecha, txt: c.nota || 'Cargo', m: c.monto, cargo: c.id }))].sort((a, b) => b.f.localeCompare(a.f));
  abrirHoja(`
    <h2>${esc(d.nombre)}</h2>
    <div class="dos"><div><span class="muted">Saldo</span><b class="neg">${fmt(s.saldo)}</b></div><div><span class="muted">Pagado</span><b class="pos">${fmt(s.pagado)}</b></div></div>
    ${d.claves ? `<p class="muted small">Reconoce pagos que digan: <b>${esc(d.claves)}</b></p>` : '<p class="warn small">Sin palabras clave: los pagos no se reconocerán solos.</p>'}
    <div class="inline">
      <button class="btn mini" data-pago-deuda="${d.id}">＋ Pago manual</button>
      <button class="btn mini sec" data-cargo-deuda="${d.id}">＋ Nuevo cargo</button>
    </div>
    <div class="lista">${movs.map(m => `<div class="fila mov"><span><small class="muted">${m.f}</small><br>${esc(m.txt)}</span>
      <span><b class="${m.m < 0 ? 'pos' : 'neg'}">${m.m < 0 ? '-' : '+'}${fmt(Math.abs(m.m))}</b>${m.cargo ? ` <button class="x" data-borrar-cargo="${d.id}:${m.cargo}">✕</button>` : ''}</span></div>`).join('') || '<p class="muted small">Aún no hay pagos.</p>'}</div>
    <button class="btn sec" data-editar-deuda="${d.id}">Editar</button>
    <button class="btn sec" data-cerrar-deuda="${d.id}">${d.cerrada ? 'Reabrir deuda' : 'Marcar como pagada'}</button>
    <button class="btn peligro" data-borrar-deuda="${d.id}">Eliminar deuda</button>
    <button class="btn sec" data-cerrar>Cerrar</button>`);
}

function descargar(nombre, contenido, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= Eventos ================= */
document.addEventListener('click', e => {
  const el = e.target.closest('button, [data-ir]');
  if (!el) return;
  const ds = el.dataset;
  if (ds.tab) { UI.tab = ds.tab; UI.busqueda = ''; render(); window.scrollTo(0, 0); }
  else if (ds.ir) { UI.tab = ds.ir; render(); }
  else if (ds.mes) { UI.mes = moverMes(UI.mes, +ds.mes); render(); }
  else if ('revisar' in ds) { UI.tab = 'movimientos'; UI.filtro = 'revisar'; render(); }
  else if (ds.filtro) { UI.filtro = ds.filtro; UI.busqueda = ''; render(); }
  else if (ds.tx) hojaTx(S.txs.find(t => t.id === ds.tx));
  else if ('nuevoTx' in ds) hojaTx(null);
  else if ('cerrar' in ds) cerrarHoja();
  else if ('pendDescartar' in ds) { S.hashes[pendientes.shift().hash] = 1; guardar(); mostrarPendiente(); }
  else if ('pendManual' in ds) {
    const t = pendientes.shift(); S.hashes[t.hash] = 1; guardar();
    hojaTx(null); $('#fTx').nota.value = t.raw.slice(0, 120);
  }
  else if (ds.borrarTx) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    S.txs = S.txs.filter(t => t.id !== ds.borrarTx); guardar(); cerrarHoja(); render(); toast('Eliminado');
  }
  else if ('procesar' in ds) {
    const txt = $('#pegado').value;
    if (!txt.trim()) return toast('Pega al menos un mensaje');
    const res = importarTexto(txt); $('#pegado').value = ''; mostrarResultado(res);
  }
  else if ('nuevaDeuda' in ds) hojaDeuda(null);
  else if (ds.deuda) hojaDetalleDeuda(S.deudas.find(d => d.id === ds.deuda));
  else if (ds.editarDeuda) hojaDeuda(S.deudas.find(d => d.id === ds.editarDeuda));
  else if (ds.cerrarDeuda) { const d = S.deudas.find(x => x.id === ds.cerrarDeuda); d.cerrada = !d.cerrada; guardar(); cerrarHoja(); render(); }
  else if (ds.borrarDeuda) {
    if (!confirm('¿Eliminar esta deuda? Los pagos quedan como movimientos normales.')) return;
    S.txs.forEach(t => { if (t.deudaId === ds.borrarDeuda) t.deudaId = null; });
    S.deudas = S.deudas.filter(d => d.id !== ds.borrarDeuda); guardar(); cerrarHoja(); render();
  }
  else if (ds.pagoDeuda) {
    const d = S.deudas.find(x => x.id === ds.pagoDeuda);
    hojaTx(null);
    const f = $('#fTx'); f.categoria.value = 'Pago de deudas'; f.deudaId.value = d.id; f.contraparte.value = d.nombre; f.monto.value = d.cuota ? Math.round(d.cuota).toLocaleString('es-CO') : '';
  }
  else if (ds.cargoDeuda) {
    const d = S.deudas.find(x => x.id === ds.cargoDeuda);
    const v = parseFloat((prompt('Monto del nuevo cargo (compra, intereses, etc.):') || '').replace(/[^\d]/g, ''));
    if (!v) return;
    const nota = prompt('Descripción (opcional):') || 'Cargo';
    (d.cargos = d.cargos || []).push({ id: uid(), fecha: hoy(), monto: v, nota });
    guardar(); hojaDetalleDeuda(d); render();
  }
  else if (ds.borrarCargo) {
    const [did, cid] = ds.borrarCargo.split(':'); const d = S.deudas.find(x => x.id === did);
    d.cargos = d.cargos.filter(c => c.id !== cid); guardar(); hojaDetalleDeuda(d); render();
  }
  else if (ds.borrarRegla) { delete S.reglas[ds.borrarRegla]; guardar(); render(); }
  else if (ds.borrarCat) {
    S.categorias = S.categorias.filter(c => c.n !== ds.borrarCat);
    S.txs.forEach(t => { if (t.categoria === ds.borrarCat) t.categoria = 'Sin categoría'; });
    guardar(); render();
  }
  else if ('agregarCat' in ds) {
    const n = $('#nuevaCat').value.trim();
    if (!n || S.categorias.some(c => c.n.toLowerCase() === n.toLowerCase())) return toast('Escribe un nombre nuevo');
    S.categorias.splice(S.categorias.length - 2, 0, { n, i: '🏷️' }); guardar(); render();
  }
  else if ('exportar' in ds) descargar(`mis-finanzas-${hoy()}.json`, JSON.stringify(S), 'application/json');
  else if ('csv' in ds) {
    const filas = [['Fecha', 'Hora', 'Tipo', 'Monto', 'Descripción', 'Categoría', 'Deuda', 'Nota']].concat(
      S.txs.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(t => [t.fecha, t.hora || '', t.tipo, t.monto, t.contraparte, t.categoria, (S.deudas.find(d => d.id === t.deudaId) || {}).nombre || '', t.nota]));
    descargar(`movimientos-${hoy()}.csv`, '﻿' + filas.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  }
  else if ('borrarTodo' in ds) {
    if (prompt('Esto borra TODO. Escribe BORRAR para confirmar.') !== 'BORRAR') return;
    S = estadoVacio(); guardar(); render(); toast('Datos borrados');
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'fTx') guardarTx(e.target);
  if (e.target.id === 'fDeuda') guardarDeuda(e.target);
  if (e.target.id === 'fPend') guardarPendiente(e.target);
});

document.addEventListener('input', e => {
  if (e.target.id === 'buscar') {
    UI.busqueda = e.target.value;
    const pos = e.target.selectionStart; render();
    const b = $('#buscar'); b.focus(); b.setSelectionRange(pos, pos);
  }
  if (e.target.inputMode === 'numeric') {
    const v = e.target.value.replace(/[^\d]/g, '');
    e.target.value = v ? (+v).toLocaleString('es-CO') : '';
  }
});

document.addEventListener('change', async e => {
  if (e.target.id === 'archivo' && e.target.files[0]) {
    mostrarResultado(importarTexto(await e.target.files[0].text()));
    e.target.value = '';
  }
  if (e.target.id === 'restaurar' && e.target.files[0]) {
    try {
      const s = JSON.parse(await e.target.files[0].text());
      if (s.v !== 1 || !Array.isArray(s.txs)) throw 0;
      if (!confirm(`¿Reemplazar tus datos actuales por la copia (${s.txs.length} movimientos)?`)) return;
      S = Object.assign(estadoVacio(), s); guardar(); render(); toast('Copia restaurada');
    } catch (_) { toast('Ese archivo no es una copia válida'); }
  }
  if (e.target.id === 'titular') {
    S.config.titular = e.target.value.trim();
    let n = 0;
    for (const t of S.txs) if (!t.catManual && t.contraparte && esTitular(t.contraparte) && t.categoria !== 'Entre mis cuentas') { t.categoria = 'Entre mis cuentas'; n++; }
    guardar(); toast(n ? `Nombre guardado. ${n} movimiento(s) marcados como “Entre mis cuentas”` : 'Nombre guardado');
  }
});

$('#hoja').addEventListener('click', e => { if (e.target.id === 'hoja' && !e.target.classList.contains('completa')) cerrarHoja(); });
$('#hoja').addEventListener('cancel', e => { if (pendientes.length) e.preventDefault(); });
window.addEventListener('hashchange', revisarEnlace);

/* ================= Sincronización con GitHub (issues de un repo privado) ================= */
// El atajo crea un issue por SMS (cuerpo: "---<SMS> ##cat=<categoría>"). La app los importa y los cierra;
// los cerrados quedan como respaldo y se pueden recuperar con "Recuperar todo".
const REPO_DEFECTO = 'abdurieder47-ui/mis-finanzas-datos';
const KEY_TOKEN = 'misfinanzas.token'; // aparte de S para que no salga en las copias exportadas
function leerToken() { try { return localStorage.getItem(KEY_TOKEN) || ''; } catch (_) { return ''; } }
const repoGH = () => S.config.repo || REPO_DEFECTO;
let sincronizando = false;

async function gh(ruta, opciones = {}) {
  const r = await fetch('https://api.github.com/repos/' + repoGH() + ruta, Object.assign({}, opciones, {
    headers: { Authorization: 'Bearer ' + leerToken(), Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }
  }));
  if (r.status === 401) throw new Error('La clave de acceso no es válida o venció');
  if (r.status === 404) throw new Error('No encuentro el repositorio o la clave no tiene permiso sobre él');
  if (r.status === 403) throw new Error('La clave no tiene permiso de Issues (lectura y escritura)');
  if (!r.ok) throw new Error('GitHub respondió ' + r.status);
  return r.json();
}

async function sincronizar({ manual = false, todo = false } = {}) {
  if (!leerToken()) { if (manual) toast('Primero guarda tu clave de acceso'); return; }
  if (sincronizando || !navigator.onLine) return;
  sincronizando = true;
  try {
    const issues = [];
    for (let page = 1; ; page++) {
      const lote = await gh(`/issues?state=${todo ? 'all' : 'open'}&per_page=100&page=${page}&sort=created&direction=asc`);
      issues.push(...lote.filter(i => !i.pull_request && i.body));
      if (lote.length < 100) break;
    }
    const res = importarTexto(issues.map(i => i.body).join('\n'));
    // Ya quedaron guardados en el celular: se cierran para no volver a descargarlos.
    await Promise.all(issues.filter(i => i.state === 'open').map(i =>
      gh('/issues/' + i.number, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) }).catch(() => {})));
    S.config.ultimaSync = new Date().toISOString(); guardar();
    if (res.nuevos) { render(); toast(`🔄 ${res.nuevos} movimiento${res.nuevos > 1 ? 's' : ''} nuevo${res.nuevos > 1 ? 's' : ''}`); }
    else if (manual) { render(); toast('Todo al día'); }
  } catch (e) {
    if (manual) toast('⚠️ ' + e.message);
  } finally { sincronizando = false; }
}

async function probarGH() {
  const repo = $('#ghRepo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const token = $('#ghToken').value.trim();
  S.config.repo = repo; guardar();
  if (token) try { localStorage.setItem(KEY_TOKEN, token); } catch (_) { return toast('No se pudo guardar la clave'); }
  try {
    const info = await fetch('https://api.github.com/repos/' + repo, { headers: { Authorization: 'Bearer ' + leerToken(), Accept: 'application/vnd.github+json' } });
    if (!info.ok) throw new Error(info.status === 401 ? 'La clave no es válida' : 'No encuentro el repositorio con esa clave');
    if (!(await info.json()).private) { toast('⚠️ Ese repositorio es PÚBLICO: cualquiera vería tus movimientos. Hazlo privado.'); return; }
    await gh('/issues?per_page=1');
    toast('✅ Conectado a tu repositorio privado'); $('#ghToken').value = '';
    await sincronizar({ manual: true }); render();
  } catch (e) { toast('⚠️ ' + e.message); }
}

document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if ('ghProbar' in b.dataset) probarGH();
  if ('ghSync' in b.dataset) sincronizar({ manual: true });
  if ('ghTodo' in b.dataset) sincronizar({ manual: true, todo: true });
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
window.addEventListener('online', () => sincronizar());

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
render();
revisarEnlace();
sincronizar();
