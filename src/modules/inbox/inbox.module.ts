import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { Message, MessageSchema } from './entities/message.entity';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
    EmailModule,
  ],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
