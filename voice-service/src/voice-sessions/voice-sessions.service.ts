import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VoiceSession, VoiceSessionDocument } from './voice-sessions.schema';
import { SegmentsService } from '../segments/segments.service';

@Injectable()
export class VoiceSessionsService {
  constructor(
    @InjectModel(VoiceSession.name)
    private voiceSessionModel: Model<VoiceSessionDocument>,
    private segmentsService: SegmentsService,
  ) {}

  async createSession(bookId: string, userId: string): Promise<VoiceSessionDocument> {
    const session = new this.voiceSessionModel({
      bookId: new Types.ObjectId(bookId),
      userId,
      status: 'active',
      startedAt: new Date(),
    });
    return session.save();
  }

  async endSession(sessionId: string): Promise<void> {
    await this.voiceSessionModel.findByIdAndUpdate(sessionId, {
      status: 'ended',
      endedAt: new Date(),
    });
  }

  async searchBook(bookId: string, query: string): Promise<string> {
    const segments = await this.segmentsService.searchSegments(bookId, query);
    if (!segments.length) return 'No relevant content found.';
    return segments.map(s => s.content).join('\n\n');
  }
}