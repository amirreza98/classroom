import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VoiceSessionsController } from './voice-sessions.controller';
import { VoiceSessionsService } from './voice-sessions.service';
import { VoiceSessionsGateway } from './voice-sessions.gateway';
import { VoiceSession, VoiceSessionSchema } from './voice-sessions.schema';
import { SegmentsModule } from '../segments/segments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VoiceSession.name, schema: VoiceSessionSchema },
    ]),
    SegmentsModule,
  ],
  controllers: [VoiceSessionsController],
  providers: [VoiceSessionsService, VoiceSessionsGateway],
})
export class VoiceSessionsModule {}