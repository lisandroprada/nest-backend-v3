import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AccountingEntriesService } from '../src/modules/accounting-entries/accounting-entries.service';
import { AccountingEntry } from '../src/modules/accounting-entries/entities/accounting-entry.entity';
import { PaginationService } from '../src/common/pagination/pagination.service';
import { FinancialAccountsService } from '../src/modules/financial-accounts/financial-accounts.service';

/**
 * Este test valida que getEstadoCuentaByAgente
 * - clasifica DEBE/HABER por partida del asiento (no por rol global)
 * - calcula el "monto_recaudado_disponible" proporcional a lo cobrado del locatario
 */

describe('Estado de Cuenta por Asiento/Partida', () => {
  let service: AccountingEntriesService;
  let accountingEntryModel: any;

  const AGENTE_LOCATARIO = 'AGT-LOCATARIO-A';
  const AGENTE_LOCADOR = 'AGT-LOCADOR-B';
  const AGENTE_INMOBILIARIA = 'AGT-INMO-C';

  // Asiento base: debe=1000 (pagado 600), haber locador=900, haber inmo=100
  const sampleAsientos = [
    {
      _id: 'ASIENTO-1',
      tipo_asiento: 'Alquiler',
      fecha_imputacion: new Date('2025-11-01T00:00:00Z'),
      fecha_vencimiento: new Date('2025-11-11T00:00:00Z'),
      estado: 'PAGADO_PARCIAL',
      partidas: [
        {
          descripcion: 'Alquiler 11/2025',
          debe: 1000,
          haber: 0,
          agente_id: AGENTE_LOCATARIO,
          monto_pagado_acumulado: 600,
        },
        {
          descripcion: 'Crédito por alquiler 11/2025',
          debe: 0,
          haber: 900,
          agente_id: AGENTE_LOCADOR,
          monto_liquidado: 0,
        },
        {
          descripcion: 'Honorarios por alquiler 11/2025',
          debe: 0,
          haber: 100,
          agente_id: AGENTE_INMOBILIARIA,
          monto_liquidado: 0,
        },
      ],
    },
  ];

  beforeEach(async () => {
    accountingEntryModel = {
      // getEstadoCuentaByAgente usa .find(match).sort().exec()
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(sampleAsientos),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingEntriesService,
        {
          provide: getModelToken(AccountingEntry.name),
          useValue: accountingEntryModel,
        },
        { provide: PaginationService, useValue: { paginate: jest.fn() } },
        {
          provide: FinancialAccountsService,
          useValue: { updateBalance: jest.fn(), getAccountById: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AccountingEntriesService>(AccountingEntriesService);
  });

  it('locatario: devuelve partidas DEBE con saldo pendiente correcto', async () => {
    const resp = await service.getEstadoCuentaByAgente(AGENTE_LOCATARIO, {});
    const movimientosDebe = resp.movimientos.filter(
      (m) => m.tipo_partida === 'DEBE',
    );

    expect(movimientosDebe.length).toBe(1);
    expect(movimientosDebe[0].monto_original).toBe(1000);
    expect(movimientosDebe[0].monto_pagado).toBe(600);
    expect(movimientosDebe[0].saldo_pendiente).toBe(400);

    expect(resp.resumen.total_debe).toBe(1000);
    expect(resp.resumen.total_pagado_debe).toBe(600);
    expect(resp.resumen.saldo_pendiente_debe).toBe(400);
  });

  it('locador: devuelve partidas HABER con proporcional correcto', async () => {
    const resp = await service.getEstadoCuentaByAgente(AGENTE_LOCADOR, {});
    const movimientosHaber = resp.movimientos.filter(
      (m) => m.tipo_partida === 'HABER',
    );

    // Cobrado inquilino = 600, total haber = 1000, proporcion locador = 900/1000 = 0.9
    // monto_liquidable = 600 * 0.9 = 540
    expect(movimientosHaber.length).toBe(1);
    expect(movimientosHaber[0].haber).toBe(900);
    expect(movimientosHaber[0].monto_cobrado_inquilino).toBe(600);
    expect(Number(movimientosHaber[0].proporcion.toFixed(4))).toBe(90); // en %
    expect(movimientosHaber[0].monto_liquidable).toBe(540);
    expect(movimientosHaber[0].monto_recaudado_disponible).toBe(540);

    expect(resp.resumen.total_haber).toBe(900);
    expect(resp.resumen.saldo_disponible_haber).toBe(540);
  });

  it('inmobiliaria: devuelve partidas HABER de honorarios con proporcional correcto', async () => {
    const resp = await service.getEstadoCuentaByAgente(AGENTE_INMOBILIARIA, {});
    const movimientosHaber = resp.movimientos.filter(
      (m) => m.tipo_partida === 'HABER',
    );

    // proporcion inmo = 100/1000 = 0.1 -> liquidable = 600 * 0.1 = 60
    expect(movimientosHaber.length).toBe(1);
    expect(movimientosHaber[0].haber).toBe(100);
    expect(movimientosHaber[0].monto_cobrado_inquilino).toBe(600);
    expect(Number(movimientosHaber[0].proporcion.toFixed(4))).toBe(10); // en %
    expect(movimientosHaber[0].monto_liquidable).toBe(60);
    expect(movimientosHaber[0].monto_recaudado_disponible).toBe(60);

    expect(resp.resumen.total_haber).toBe(100);
    expect(resp.resumen.saldo_disponible_haber).toBe(60);
  });
});
