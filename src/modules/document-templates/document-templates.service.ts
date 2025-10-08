import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentTemplate } from './entities/document-template.entity';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

@Injectable()
export class DocumentTemplatesService {
  constructor(
    @InjectModel(DocumentTemplate.name) private readonly docTemplateModel: Model<DocumentTemplate>,
  ) {}

  create(createDto: CreateDocumentTemplateDto) {
    const newTemplate = new this.docTemplateModel(createDto);
    return newTemplate.save();
  }

  findAll() {
    return this.docTemplateModel.find().exec();
  }

  findOne(id: string) {
    return this.docTemplateModel.findById(id).exec();
  }

  update(id: string, updateDto: UpdateDocumentTemplateDto) {
    return this.docTemplateModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  remove(id: string) {
    return this.docTemplateModel.findByIdAndDelete(id).exec();
  }
}
