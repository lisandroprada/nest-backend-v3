import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Valuation } from './entities/valuation.entity';
import { CreateValuationDto } from './dto/create-valuation.dto';
import { UpdateValuationDto } from './dto/update-valuation.dto';
import { AccountingEntriesService } from '../accounting-entries/accounting-entries.service';
import { PropertiesService } from '../properties/properties.service';

@Injectable()
export class ValuationsService {
  constructor(
    @InjectModel(Valuation.name) private readonly valuationModel: Model<Valuation>,
    private readonly accountingEntriesService: AccountingEntriesService,
    private readonly propertiesService: PropertiesService,
  ) {}

  async create(createDto: CreateValuationDto, userId: string): Promise<Valuation> {
    const { propiedad_original_id, clientes_solicitantes_ids, honorario_facturar } = createDto;

    let snapshot = createDto.datos_propiedad_snapshot;
    if (propiedad_original_id) {
      const property = await this.propertiesService.findOne(propiedad_original_id);
      if (!property) {
        throw new NotFoundException(`Property with ID ${propiedad_original_id} not found.`);
      }
      snapshot = property.toObject(); // Create a snapshot of the existing property
    }

    // Create a debit entry for each client
    const debitPartidas = clientes_solicitantes_ids.map(clienteId => ({
      cuenta_id: new Types.ObjectId('placeholder_for_cxc_servicios_id'), // Placeholder for 'Cuentas por Cobrar - Servicios'
      descripcion: `Honorarios por tasación`,
      debe: honorario_facturar / clientes_solicitantes_ids.length, // Split the fee among clients
      haber: 0,
      agente_id: new Types.ObjectId(clienteId),
    }));

    const creditPartida = {
      cuenta_id: new Types.ObjectId('placeholder_for_ing_tasac_id'), // Placeholder for 'Ingresos por Tasación'
      descripcion: 'Ingreso por honorarios de tasación',
      debe: 0,
      haber: honorario_facturar,
    };

    const accountingEntry = await this.accountingEntriesService.create({
      descripcion: 'Honorarios por servicio de tasación',
      tipo_asiento: 'TASACION',
      fecha_vencimiento: new Date().toISOString(),
      partidas: [...debitPartidas, creditPartida],
      usuario_creacion_id: new Types.ObjectId(userId),
      usuario_modificacion_id: new Types.ObjectId(userId),
    });

    const newValuation = new this.valuationModel({
      ...createDto,
      datos_propiedad_snapshot: snapshot,
      asiento_debito_id: accountingEntry._id,
    });

    return newValuation.save();
  }

  findAll() {
    return this.valuationModel.find().exec();
  }

  findOne(id: string) {
    return this.valuationModel.findById(id).populate('asiento_debito_id').exec();
  }

  update(id: string, updateDto: UpdateValuationDto) {
    return this.valuationModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.valuationModel.findByIdAndDelete(id).exec();
  }

  async generateReportAndSend(id: string) {
    // Placeholder for PDF generation and sending email
    const valuation = await this.findOne(id);
    if (!valuation) {
      throw new NotFoundException(`Valuation with ID ${id} not found.`);
    }
    await this.valuationModel.findByIdAndUpdate(id, { estado_tasacion: 'ENTREGADA' });
    return { message: 'Report generated and sent (Placeholder)', valuation };
  }
}
