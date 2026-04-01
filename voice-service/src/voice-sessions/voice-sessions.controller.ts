
import { Controller, Post, Param, Headers, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { VoiceSessionsService } from './voice-sessions.service';

@Controller('voice')
export class VoiceSessionsController {
  constructor(private readonly voiceSessionsService: VoiceSessionsService) {}
  @Post('session/:bookId')
  async startSession(
    @Param('bookId') bookId: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('x-user-id header is required');
    }
    if (!Types.ObjectId.isValid(bookId)) {
      throw new BadRequestException('Invalid bookId format');
    }
    return this.voiceSessionsService.createSession(bookId, userId);
  }
} 