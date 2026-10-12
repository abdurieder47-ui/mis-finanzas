const P = require('../parser.js');
const sms = `Bancolombia: Transferiste $20,000.00 desde tu cuenta *4321 a la cuenta *0000000987 el 02/10/2026 a las 17:32. Dudas? Llamanos al 018000931987. Estamos cerca.
Bancolombia: Recibiste una transferencia por $380,000 de CARLOS PEREZ en tu cuenta **4321, el 03/10/2026 a las 17:54. Si tienes dudas, hablemos: 018000931987. Siempre a tu lado.
Bancolombia: Pagaste $379,900.00 a GOU PAYMENTS S A EASPBV desde tu producto 4321 03/10/2026 18:02:27. ¿Dudas? Llamanos al 6045109095. Estamos cerca
Bancolombia: ANA MARIA GOMEZ RUIZ pagaste $42,500.00 por codigo QR desde tu cuenta *4321 a la llave 0011223344 el 03/10/2026 a las 21:14. Con codigo QR es facil y de una. Dudas al 018000912345
Bancolombia: Pagaste $10,000.00 a TU COMPRA SAS desde tu producto 4321 el 04/10/2026 11:12:35. ¿Dudas? Llamanos al 6045109095. Estamos cerca
Bancolombia: Ana, recibiste una transferencia de Ana Maria Gomez Ruiz por $100,000.00 en tu cuenta *4321 conectada a la llave @ANA123 el 04/10/2026 a las 20:33. Con llaves es facil y de una. Dudas al 018000912345
Bancolombia: Pagaste $165,000.00 a NU Compania de Financiamiento desde tu producto 4321 el 30/09/2026 08:46:12. ¿Dudas? Llamanos al 6045109095. Estamos cerca
Bancolombia: Recibiste una transferencia por $1,545,027 de EMPRESA EJEMPLO S.A.S en tu cuenta **4321, el 30/09/2026 a las 08:40. Si tienes dudas, hablemos: 018000931987. Siempre a tu lado.
Bancolombia: Recibiste una transferencia por $5,000 de MARTA RUIZ en tu cuenta **4321, el 29/08/2026 a las 19:55. Si tienes dudas, hablemos: 018000931987. Siempre a tu lado.
Bancolombia: Compraste $45,900.00 en EXITO LAURELES con tu T.Deb *4321, el 05/10/2026 a las 13:10. Si tienes dudas llamanos
Bancolombia: Retiraste $200,000.00 en CAJ BANCOLOMBIA ESTADIO de tu T.Deb *4321 el 06/10/2026 a las 10:00.
Bancolombia: Tu clave dinamica es 123456. No la compartas.`;
const msgs = P.dividirMensajes(sms);
console.log('mensajes:', msgs.length);
for (const m of msgs) {
  const r = P.parseSMS(m);
  console.log(r ? `${r.tipo.padEnd(7)} ${String(r.monto).padStart(9)} ${r.fecha} ${r.hora} [${r.medio}] ${r.contraparte} | cta ${r.cuenta}${r.titular ? ' | titular ' + r.titular : ''}${r.revisar ? ' | REVISAR' : ''}` : 'IGNORADO: ' + m.slice(0, 50));
}
