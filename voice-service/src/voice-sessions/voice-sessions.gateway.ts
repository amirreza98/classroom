import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { VoiceSessionsService } from './voice-sessions.service';
import WebSocket = require('ws');

// map to track each client's OpenAI WebSocket connection
const clientOpenAIMap = new Map<string, WebSocket>();
// map to track bookId per client
const clientBookMap = new Map<string, string>();

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'https://classroom-nine-omega.vercel.app',
    ],
    credentials: true,
  },
  namespace: 'voice',
})
export class VoiceSessionsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private configService: ConfigService,
    private voiceSessionsService: VoiceSessionsService,
  ) {}

  async handleDisconnect(client: Socket) {
    const openAIws = clientOpenAIMap.get(client.id);
    if (openAIws) {
      openAIws.close();
      clientOpenAIMap.delete(client.id);
    }
    clientBookMap.delete(client.id);
  }

  @SubscribeMessage('start-session')
  async handleStartSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookId: string; userId?: string },
  ) {
    console.log('EVENT RECEIVED');

    try {
      const { bookId } = data;
      // Prefer gateway-injected header over client-supplied payload
      const userId =
        (client.handshake.headers['x-user-id'] as string | undefined) ??
        data.userId;
      if (!userId) {
        client.emit('error', { message: 'Unauthorized' });
        return;
      }
      console.log('start-session received:', bookId, userId);

      const session = await this.voiceSessionsService.createSession(bookId, userId);
      console.log('session created:', session._id);

      clientBookMap.set(client.id, bookId);

      const openAIws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview',
        {
          headers: {
            Authorization: `Bearer ${this.configService.get('OPENAI_API_KEY')}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        },
      );

      clientOpenAIMap.set(client.id, openAIws);

      openAIws.on('open', async () => {
        const segmentsData = await this.voiceSessionsService.getBookContext(bookId);

        console.log(
          'CONTEXT SENT TO OPENAI:',
          JSON.stringify(segmentsData).substring(0, 500),
        );

        const contextString = Array.isArray(segmentsData)
          ? segmentsData.map((s) => s.content || s.text).join('\n')
          : segmentsData;

        openAIws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['audio', 'text'],
              instructions: `You are an AI reading assistant.
You MUST assume the user is referring to the book described below.
DO NOT ask which book the user means.

If the user asks general questions like "tell me about the book",
you MUST summarize the provided content.

BOOK CONTENT:

${contextString}

Rules:
- Always answer based ONLY on the book content above
- If information is missing, say "This is not covered in the provided content"
- Be concise and conversational
`,
              voice: 'alloy',

              // ── FIX 1: disable server VAD ─────────────────────────────
              // server_vad causes OpenAI to auto-detect speech and respond
              // immediately — this completely conflicts with push-to-talk.
              // With server_vad ON, OpenAI starts generating a response the
              // moment it detects silence, ignoring your manual commit-audio.
              // Setting to 'none' means OpenAI only responds when we
              // explicitly send input_audio_buffer.commit + response.create.
              turn_detection: null,

              // ── FIX 2: enable Whisper transcription ───────────────────
              // Without this, conversation.item.input_audio_transcription
              // .completed never fires and user transcript stays as dots.
              input_audio_transcription: {
                model: 'whisper-1',
              },
            },
          }),
        );

        client.emit('session-ready', { sessionId: session._id });
      });

      openAIws.on('message', (raw) => {
        const event = JSON.parse(raw.toString()) as {
          type: string;
          error?: { message: string };
        };
        console.log('[Gateway] OpenAI event:', event.type);

        if (event.type === 'error') {
          console.error('[Gateway] OpenAI realtime error:', event.error);
          client.emit('error', { message: event.error?.message });
          return;
        }

        client.emit('openai-event', event);
      });

      openAIws.on('error', (err) => {
        console.error('OpenAI WS error:', err.message);
        client.emit('error', { message: err.message });
      });

      openAIws.on('close', (code, reason) => {
        console.log('OpenAI WS closed:', code, reason.toString());
        client.emit('session-ended', {});
      });
    } catch (err) {
      console.error('handleStartSession error:', err.message);
      client.emit('error', { message: err.message });
    }
  }

  // ── FIX 3: send-audio — just append, never cancel ────────────────────
  // The old code sent response.cancel on EVERY audio chunk. This meant
  // every ~170ms packet was cancelling the AI mid-sentence, causing the
  // choppy/cutting audio. We only append here; cancellation only happens
  // if the user explicitly interrupts (cancel-ai-response event).
  @SubscribeMessage('send-audio')
  handleAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { audio: string },
  ) {
    const openAIws = clientOpenAIMap.get(client.id);
    if (!openAIws || openAIws.readyState !== WebSocket.OPEN) return;

    openAIws.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: data.audio,
      }),
    );
  }

  // ── commit-audio: user finished speaking, ask AI to respond ──────────
  @SubscribeMessage('commit-audio')
  handleCommitAudio(@ConnectedSocket() client: Socket) {
    const openAIws = clientOpenAIMap.get(client.id);
    if (!openAIws || openAIws.readyState !== WebSocket.OPEN) return;

    // Commit the buffer so OpenAI knows the utterance is complete,
    // then explicitly request a response. With turn_detection: null
    // OpenAI will NOT respond until these two messages are sent.
    openAIws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    openAIws.send(JSON.stringify({ type: 'response.create' }));
  }

  // ── cancel-ai-response: user wants to interrupt the AI mid-speech ────
  // This is the ONLY place response.cancel should be sent.
  @SubscribeMessage('cancel-ai-response')
  handleCancel(@ConnectedSocket() client: Socket) {
    const openAIws = clientOpenAIMap.get(client.id);
    if (openAIws && openAIws.readyState === WebSocket.OPEN) {
      openAIws.send(JSON.stringify({ type: 'response.cancel' }));
      // Also clear the input buffer so stale audio doesn't bleed into the next question
      openAIws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    }
  }

  @SubscribeMessage('end-session')
  async handleEndSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    await this.voiceSessionsService.endSession(data.sessionId);
    const openAIws = clientOpenAIMap.get(client.id);
    if (openAIws) {
      openAIws.close();
      clientOpenAIMap.delete(client.id);
    }
    clientBookMap.delete(client.id);
  }
}