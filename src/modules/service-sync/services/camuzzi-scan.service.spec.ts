import { CamuzziScanService, CamuzziMailData } from './camuzzi-scan.service';

// Create minimal mocks for constructor dependencies (not used by parseCamuzziEmail)
const mockSystemConfigService: any = {};
const mockServiceSyncService: any = {};
const mockClassificationService: any = {};
const mockAgentModel: any = {};

describe('CamuzziScanService.parseCamuzziEmail', () => {
  const svc = new CamuzziScanService(
    mockSystemConfigService,
    mockServiceSyncService,
    mockClassificationService,
    mockAgentModel,
  );

  it('parses a sample Camuzzi invoice email', () => {
    const subject =
      'Camuzzi te acerca tu factura. Nro. Cuenta: 9103/0-1309-0018934/3 del periodo 06/25';
    const html = `
      <html><body>
        <p>Nro. Cuenta: 9103/0-1309-0018934/3</p>
        <p>Factura <span>80015-32499326/0</span></p>
        <p>Total: $ 20.537,41</p>
        <p>Vencimiento: 01/12/2025</p>
        <p>Te acercamos la factura del suministro ubicado en: <strong>P MORENO 476</strong></p>
        <a href="https://oficinavirtual.camuzzigas.com.ar/deep-link?suministro=91030130900189343">PAGAR AHORA</a>
        <a href="https://factura.camuzzigas.com.ar/dms/public/document/invoice.pdf">Descargá tu factura</a>
      </body></html>
    `;

    const parsed: CamuzziMailData = svc.parseCamuzziEmail({
      subject,
      from: 'Camuzzi <factura@factura.camuzzigas.com.ar>',
      html,
      text: '',
    });

    expect(parsed.tipo).toBe('factura');
    expect(parsed.cuenta).toBe('9103/0-1309-0018934/3');
    expect(parsed.monto).toBeCloseTo(20537.41, 2);
    expect(parsed.vencimiento).toBe('01/12/2025');
    expect(parsed.direccion).toMatch(/P MORENO 476/);
  });

  it('parses when the cuenta is only in the subject', () => {
    const subject =
      'Camuzzi - Nro. Cuenta: 9103/0-1309-0018934/3 - Nueva factura disponible';
    const html = `
      <html><body>
        <p>Factura <span>80015-32499326/0</span></p>
        <p>Total: $ 20.537,41</p>
        <p>Vencimiento: 01/12/2025</p>
        <p>Te acercamos la factura del suministro ubicado en: <strong>P MORENO 476</strong></p>
        <a href="https://oficinavirtual.camuzzigas.com.ar/deep-link?suministro=91030130900189343">PAGAR AHORA</a>
        <a href="https://factura.camuzzigas.com.ar/dms/public/document/invoice.pdf">Descargá tu factura</a>
      </body></html>
    `;

    const service = new CamuzziScanService(
      null as any,
      null as any,
      null as any,
      null as any,
    );
    const parsed = service.parseCamuzziEmail({
      subject,
      from: 'Camuzzi <factura@factura.camuzzigas.com.ar>',
      html,
      text: '',
    });

    expect(parsed.tipo).toBe('factura');
    expect(parsed.cuenta).toBe('9103/0-1309-0018934/3');
    expect(parsed.monto).toBeCloseTo(20537.41, 2);
    expect(parsed.vencimiento).toBe('01/12/2025');
    expect(parsed.direccion).toContain('P MORENO 476');
  });

  it('parses the real example 1 (inicio corte) provided by user', () => {
    const subject = 'INICIO DEL PROCESO DE CORTE DE SUMINISTRO';
    const html = `
      <html><body>
        <p>Nos ponemos nuevamente en contacto para informarte que la Cuenta <span>N° 9103/0-04-04-0013178/8</span> correspondiente al suministro ubicado en la calle <strong>G MAYO 118</strong> sigue registrando facturas pendientes de pago.</p>
        <p>Importe total: <span>$65760.81</span></p>
        <a href="https://email.avisos.camuzzigas.com.ar/c/...">Oficina Virtual</a>
      </body></html>
    `;

    const parsed = svc.parseCamuzziEmail({
      subject,
      from: 'Camuzzi <postmaster@avisos.camuzzigas.com.ar>',
      html,
      text: '',
    });

    expect(parsed.tipo).toBe('corte');
    expect(parsed.cuenta).toBe('9103/0-04-04-0013178/8');
    expect(parsed.monto).toBeCloseTo(65760.81, 2);
    expect(parsed.direccion).toContain('G MAYO 118');
  });

  it('parses the real example 2 (factura subject contains cuenta and periodo)', () => {
    const subject =
      'Camuzzi te acerca tu factura. Nro. Cuenta: 9103/0-0809-0015901/6 del periodo 05/25 – liquidación 2 de 2';
    const html = `
      <html><body>
        <p>Te acercamos la factura del suministro ubicado en: <strong>VIVALDI 275</strong></p>
        <p>Total: <strong>$ 103.968,96</strong></p>
        <p>Vencimiento: <strong>02/12/2025</strong></p>
        <a href="https://oficinavirtual.camuzzigas.com.ar/deep-link?suministro=91030080900159016">PAGAR AHORA</a>
        <a href="https://factura.camuzzigas.com.ar/dms/public/document/.../invoice.pdf">Descargar</a>
      </body></html>
    `;

    const parsed = svc.parseCamuzziEmail({
      subject,
      from: 'Camuzzi <factura@factura.camuzzigas.com.ar>',
      html,
      text: '',
    });

    expect(parsed.tipo).toBe('factura');
    expect(parsed.cuenta).toBe('9103/0-0809-0015901/6');
    expect(parsed.monto).toBeCloseTo(103968.96, 2);
    expect(parsed.vencimiento).toBe('02/12/2025');
    expect(parsed.periodo).toBe('05/25');
  });

  it('parses the real example 3 (another factura)', () => {
    const subject =
      'Camuzzi te acerca tu factura. Nro. Cuenta: 9103/0-9406-0003281/5 del periodo 05/25 – liquidación 2 de 2';
    const html = `
      <html><body>
        <p>Te acercamos la factura del suministro ubicado en: <strong>G.RAWSON 631 Dº 013</strong></p>
        <p>Total: <strong>$ 71.921,85</strong></p>
        <p>Vencimiento: <strong>02/12/2025</strong></p>
        <a href="https://oficinavirtual.camuzzigas.com.ar/deep-link?suministro=91030940600032815">PAGAR AHORA</a>
        <a href="https://factura.camuzzigas.com.ar/dms/public/document/.../invoice.pdf">Descargar</a>
      </body></html>
    `;

    const parsed = svc.parseCamuzziEmail({
      subject,
      from: 'Camuzzi <factura@factura.camuzzigas.com.ar>',
      html,
      text: '',
    });

    expect(parsed.tipo).toBe('factura');
    expect(parsed.cuenta).toBe('9103/0-9406-0003281/5');
    expect(parsed.monto).toBeCloseTo(71921.85, 2);
    expect(parsed.vencimiento).toBe('02/12/2025');
  });
});
