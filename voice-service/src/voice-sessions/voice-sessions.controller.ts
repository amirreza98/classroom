import { Controller, Post, Param, Req } from '@nestjs/common';
import { VoiceSessionsService } from './voice-sessions.service';

@Controller('voice')
export class VoiceSessionsController {
  constructor(private readonly voiceSessionsService: VoiceSessionsService) {}

  @Post('session/:bookId')
  async startSession(@Param('bookId') bookId: string, @Req() req: any) {
    const userId = req.headers['x-user-id'];
    return this.voiceSessionsService.createSession(bookId, userId);
  }
}