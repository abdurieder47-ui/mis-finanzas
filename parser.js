// Reconocedor de SMS bancarios. Por ahora: Bancolombia.
// Funciona en el navegador (window.Parser) y en Node (module.exports) para pruebas.
(function (root) {
  'use strict';

  const MONTO = '\\$\\s?([\\d.,]+)';

  // "$1,545,027" -> 1545027 ; "$379,900.00" -> 379900 ; "$1.545.027,50" -> 1545027.5
  function parseMonto(s) {
    s = s.replace(/[.,]$/, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/\.\d{3}(\.|$)/.test(s) && !/,/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  function parseFecha(txt) {
    const d = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D{1,8}(\d{1,2}):(\d{2}))?/);
    if (!d) return { fecha: null, hora: null };
    const fecha = `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
    const hora = d[4] ? `${d[4].padStart(2, '0')}:${d[5]}` : null;
    return { fecha, hora };
  }

  function limpiar(s) {
    return (s || '').replace(/\s+/g, ' ').replace(/[\s,.;:]+$/, '').trim();
  }

  // Cada patrón: regex + cómo interpretar los grupos.
  const PATRONES = [
    { // Recibiste una transferencia por $380,000 de CARLOS PEREZ en tu cuenta **4321
      re: new RegExp(`recibiste una transferencia por ${MONTO} de (.+?) en tu cuenta \\*+(\\d+)`, 'i'),
      f: m => ({ tipo: 'ingreso', medio: 'transferencia', monto: m[1], contraparte: m[2], cuenta: m[3] })
    },
    { // Ana, recibiste una transferencia de Ana Maria Gomez Ruiz por $100,000.00 en tu cuenta *4321
      re: new RegExp(`recibiste una transferencia de (.+?) por ${MONTO} en tu cuenta \\*+(\\d+)`, 'i'),
      f: m => ({ tipo: 'ingreso', medio: 'transferencia', monto: m[2], contraparte: m[1], cuenta: m[3] })
    },
    { // Recibiste un pago (de nomina) por $X de EMPRESA en tu cuenta *4321
      re: new RegExp(`recibiste (?:un|el) (?:pago|abono|deposito|dep[oó]sito)[^$]*?${MONTO} de (.+?) en tu cuenta \\*+(\\d+)`, 'i'),
      f: m => ({ tipo: 'ingreso', medio: 'pago', monto: m[1], contraparte: m[2], cuenta: m[3] })
    },
    { // Transferiste $20,000.00 desde tu cuenta *4321 a la cuenta *XXXX339
      re: new RegExp(`transferiste ${MONTO} desde tu cuenta \\*+(\\d+) a la cuenta \\*?([\\w*]+)`, 'i'),
      f: m => ({ tipo: 'gasto', medio: 'transferencia', monto: m[1], cuenta: m[2], contraparte: 'Cuenta *' + m[3].replace(/\D/g, '').slice(-4) })
    },
    { // Transferiste $X a NOMBRE desde tu cuenta *4321
      re: new RegExp(`transferiste ${MONTO} a (.+?) desde tu cuenta \\*+(\\d+)`, 'i'),
      f: m => ({ tipo: 'gasto', medio: 'transferencia', monto: m[1], contraparte: m[2], cuenta: m[3] })
    },
    { // ANA MARIA GOMEZ RUIZ pagaste $42,500.00 por codigo QR desde tu cuenta *4321 a la llave 0011223344
      re: new RegExp(`(?:^|:)\\s*([^:]*?)\\s*pagaste ${MONTO} por c[oó]digo QR desde tu cuenta \\*+(\\d+) a la llave (\\S+)`, 'i'),
      f: m => ({ tipo: 'gasto', medio: 'qr', monto: m[2], cuenta: m[3], contraparte: 'Pago QR llave ' + limpiar(m[4]), titular: limpiar(m[1]) })
    },
    { // Pagaste $379,900.00 a GOU PAYMENTS S A EASPBV desde tu producto 4321
      re: new RegExp(`pagaste ${MONTO} a (.+?) desde tu (?:producto|cuenta|t\\.?\\s?deb\\w*|t\\.?\\s?cred\\w*)\\s*\\**(\\d+)`, 'i'),
      f: m => ({ tipo: 'gasto', medio: 'pago', monto: m[1], contraparte: m[2], cuenta: m[3] })
    },
    { // Compraste $45,000.00 en EXITO con tu T.Deb *4321
      re: new RegExp(`compraste ${MONTO} en (.+?) con tu [^*\\d]*\\**(\\d+)`, 'i'),
      f: m => ({ tipo: 'gasto', medio: 'compra', monto: m[1], contraparte: m[2], cuenta: m[3] })
    },
    { // Retiraste $200,000.00 en CAJERO X de tu cuenta *4321
      re: new RegExp(`retiraste ${MONTO} (?:en|de) (.+?) (?:de|desde) tu [^*\\d]*\\**(\\d+)`, 'i'),
      f: m => ({ tipo: 'gasto', medio: 'retiro', monto: m[1], contraparte: m[2], cuenta: m[3] })
    }
  ];

  const PAL_INGRESO = /(recibiste|te consignaron|consignaci[oó]n|abono|te enviaron|te transfirieron|reembolso|devoluci[oó]n)/i;
  const PAL_GASTO = /(pagaste|compraste|transferiste|retiraste|d[eé]bito|cobro|se debit|avance|enviaste)/i;

  // Devuelve null si el texto no parece un movimiento (ej: códigos de seguridad).
  function parseSMS(texto) {
    const raw = limpiar(texto);
    if (!raw || !/\$\s?\d/.test(raw)) return null;
    if (/(clave|c[oó]digo de (seguridad|verificaci[oó]n)|OTP)\b/i.test(raw) && !PAL_GASTO.test(raw) && !PAL_INGRESO.test(raw)) return null;

    const banco = /bancolombia/i.test(raw) ? 'Bancolombia' : 'Otro';
    const { fecha, hora } = parseFecha(raw);

    for (const p of PATRONES) {
      const m = raw.match(p.re);
      if (m) {
        const r = p.f(m);
        const monto = parseMonto(r.monto);
        if (monto == null) continue;
        return {
          banco, fecha, hora, monto,
          tipo: r.tipo, medio: r.medio,
          contraparte: limpiar(r.contraparte),
          cuenta: r.cuenta || null,
          titular: r.titular || null,
          revisar: false, raw
        };
      }
    }

    // Respaldo: se detectó un monto y una palabra clave, pero no el formato exacto.
    const mm = raw.match(new RegExp(MONTO));
    const monto = mm ? parseMonto(mm[1]) : null;
    if (monto == null) return null;
    const ing = PAL_INGRESO.test(raw), gas = PAL_GASTO.test(raw);
    if (!ing && !gas) return null;
    return {
      banco, fecha, hora, monto,
      tipo: gas && !ing ? 'gasto' : (ing && !gas ? 'ingreso' : 'gasto'),
      medio: 'otro', contraparte: '', cuenta: (raw.match(/\*+(\d{3,})/) || [])[1] || null,
      titular: null, revisar: true, raw
    };
  }

  // Un archivo/pegado puede traer muchos SMS: se separan por líneas "---" o por cada "Bancolombia:".
  function dividirMensajes(texto) {
    return texto
      .split(/\s*-{3,}\s*|(?=Bancolombia\s*:)/i)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  function hash(s) {
    s = limpiar(s).toLowerCase();
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + s.length.toString(36);
  }

  const API = { parseSMS, dividirMensajes, parseMonto, hash, limpiar };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Parser = API;
})(this);
