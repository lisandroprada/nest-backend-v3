import { RedlinkScanService } from './redlink-scan.service';
import { TipoOperacion } from './entities/bank-movement.entity';

describe('RedlinkScanService parseEmail', () => {
  const service = new RedlinkScanService(
    // systemConfigService mock
    { findOneDecrypted: jest.fn() } as any,
    // bankingSyncService mock
    {} as any,
  );

  const sampleHtml = `<!DOCTYPE html>
<html lang="es">
<body>
<table width="100%"><tbody><tr><td>
<table width="560"><tbody>
<tr><td>
<table width="100%">
<tbody>
<tr><td>
<h1>Confirmación de acreditación de DEBIN</h1>
</td></tr>
<tr><td valign="top" align="left" style="padding-top:20px">
<p>Estimado  <span> NETRA SRL  </span>:</p>
</td></tr>
<tr>
<td style="font-size:1.1em;color:#666;line-height:1.3em; padding-bottom:20px" valign="top" align="left">
<p> Le informamos que se cursó con éxito la acreditación de Debin recibida el día <span> 12/11/2025 </span>   a las <span> 11:10:25 </span> .</p>
</td>
</tr>
</tbody></table>

<table align="center" cellpadding="0" cellspacing="0" width="100%" >
<tbody>
<tr>
<td>Identificador del Debin</td>
<td>XJ8G7V95DEDJKM049EMPYR</td>
</tr>
<tr>
<td>Concepto</td>
<td>VAR</td>
</tr>
<tr>
<td>Número de Comprobante</td>
<td></td>
</tr>
<tr>
<td>Importe</td>
<td>$ 137409.81</td>
</tr>
<tr>
<td>Fecha de Expiración</td>
<td></td>
</tr>
<tr>
<td>CBU Crédito </td>
<td>0830021801002035200010</td>
</tr>
<tr>
<td>CUIT del Pagador </td>
<td>30715421700</td>
</tr>
<tr>
<td>Nombre del Pagador </td>
<td>ALAU TECNOLOGIA S.A.U.</td>
</tr>
</tbody>
</table>
</td></tr></tbody></table>
</td></tr></tbody></table>
</body></html>`;

  it('should extract fields from Redlink DEBIN email', async () => {
    const email = {
      html: sampleHtml,
      subject: 'Debin Acreditado -  12/11/2025 11:10',
      date: new Date('2025-11-12T14:10:26.000Z'),
      messageId: 'test-1',
    };

    const parsed = await (service as any).parseEmail(email);
    expect(parsed).toBeTruthy();
    expect(parsed.tipo_operacion).toBe(TipoOperacion.INGRESO);
    expect(parsed.identificador_unico).toBe('XJ8G7V95DEDJKM049EMPYR');
    expect(parsed.monto).toBeCloseTo(137409.81, 2);
    // En ingreso: solo CBU Crédito (nuestra cuenta que recibe) como destino
    expect(parsed.cuenta_origen_cbu).toBeUndefined();
    expect(parsed.cuenta_destino_cbu).toBe('0830021801002035200010');
    expect(parsed.identificador_fiscal).toBe('30715421700');
    expect(parsed.nombre_tercero).toBe('ALAU TECNOLOGIA S.A.U.');
    expect(parsed.concepto_transaccion).toBe('VAR');
  });

  it('should extract fields from Redlink Transferencia Debitada (egreso) email', async () => {
    const egresoHtml = `<!DOCTYPE html><html lang="es"><body>
    <table><tr><td>
    <table>
    <tr><td>
    <table>
    <tbody>
    <tr><td>
    <h1>Débito de Transferencia</h1>
    </td></tr>
    <tr><td>
      <p>Le informamos que se cursó con éxito el débito de la Transferencia generado el día <span> 12/11/2025 </span> a las <span> 14:33:17 </span>.</p>
    </td></tr>
    </tbody>
    </table>
    <table width="100%"><tbody>
    <tr><td>Identificador de Transferencia</td><td>D4RO172VZEZ3GJO0NKJ3QE</td></tr>
    <tr><td>Concepto</td><td>ALQ</td></tr>
    <tr><td>Importe</td><td>$ 167454.73</td></tr>
    <tr><td>CBU Débito</td><td>0830021801002035200010</td></tr>
    <tr><td>CUIT del Destinatario</td><td>27170497738</td></tr>
    <tr><td>CBU Crédito</td><td>0000003100078520895864</td></tr>
    </tbody></table>
    </td></tr></table>
    </td></tr></table>
    </body></html>`;

    const email = {
      html: egresoHtml,
      subject: 'Transferencia Debitada -  12/11/2025 14:33',
      date: new Date('2025-11-12T17:33:18.000Z'),
      messageId: 'test-2',
    };

    const parsed = await (service as any).parseEmail(email);
    expect(parsed).toBeTruthy();
    expect(parsed.tipo_operacion).toBe(TipoOperacion.EGRESO);
    expect(parsed.identificador_unico).toBe('D4RO172VZEZ3GJO0NKJ3QE');
    expect(parsed.monto).toBeCloseTo(167454.73, 2);
    // En egreso: CBU Débito es nuestra cuenta (origen) y CBU Crédito es el destino
    expect(parsed.cuenta_origen_cbu).toBe('0830021801002035200010');
    expect(parsed.cuenta_destino_cbu).toBe('0000003100078520895864');
    expect(parsed.identificador_fiscal).toBe('27170497738');
    expect(parsed.concepto_transaccion).toBe('ALQ');
  });

  it('should extract fields from Redlink Transferencia format 2 (two-column layout)', async () => {
    // Este formato tiene dos tablas lado a lado: labels en columna izquierda, valores en derecha
    const egresoHtml2 = `<!DOCTYPE html><html lang="en"><body>
    <table border="0" width="400" cellpadding="0" cellspacing="0" align="center">
      <tr><td height="30"> </td></tr>
      <tr>
        <td width="225">
          <table border="0" width="225" cellpadding="1" cellspacing="0" align="left">
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">Transferiste a</td></tr>
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">Nº de transacción</td></tr>
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">CBU/CVU</td></tr>
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">CUIT/CUIL/CDI</td></tr>
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">Cuenta origen</td></tr>
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">Motivo</td></tr>
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">Concepto</td></tr>
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">Importe</td></tr>
            <tr><td style="font-size: 14px; font-weight: bold; padding-bottom: 8px;" align="left">Fecha y hora de la operación</td></tr>
          </table>
        </td>
        <td width="225">
          <table border="0" width="225" cellpadding="1" cellspacing="0" align="right">
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">IRALDE PAOLA JESSICA</td></tr>
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">132109006</td></tr>
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">0070348030004032227140</td></tr>
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">27-26544309-0</td></tr>
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">02100020352000101</td></tr>
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">ALQ</td></tr>
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">Nov25</td></tr>
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">$ 644.000,00</td></tr>
            <tr><td style="font-size: 14px; font-weight: normal; padding-bottom: 8px;" align="right">12/11/2025 18:36</td></tr>
          </table>
        </td>
      </tr>
    </table>
    </body></html>`;

    const email = {
      html: egresoHtml2,
      subject: 'Notificaciones: Aviso de transferencia realizada',
      date: new Date('2025-11-12T21:36:27.000Z'),
      messageId: 'test-3',
    };

    const parsed = await (service as any).parseEmail(email);
    expect(parsed).toBeTruthy();
    expect(parsed.tipo_operacion).toBe(TipoOperacion.EGRESO);
    expect(parsed.identificador_unico).toBe('132109006');
    expect(parsed.monto).toBeCloseTo(644000, 2);
    // En egreso: "Cuenta origen" es nuestro CBU y "CBU/CVU" es destino
    expect(parsed.cuenta_origen_cbu).toBe('02100020352000101');
    expect(parsed.cuenta_destino_cbu).toBe('0070348030004032227140');
    expect(parsed.identificador_fiscal).toBe('27265443090'); // normalizado sin guiones
    expect(parsed.nombre_tercero).toBe('IRALDE PAOLA JESSICA');
    expect(parsed.concepto_transaccion).toBe('ALQ');
  });
});
