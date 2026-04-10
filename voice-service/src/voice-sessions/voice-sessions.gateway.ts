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
  cors: { origin: '*' },
  namespace: 'voice',
})
export class VoiceSessionsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private configService: ConfigService,
    private voiceSessionsService: VoiceSessionsService,
  ) {}

  // called when frontend disconnects
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
    @MessageBody() data: { bookId: string; userId: string },
    ) {
      console.log('EVENT RECEIVED'); // add this as first line

    try {
        const { bookId, userId } = data;
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

        openAIws.on('open', () => {
          console.log('[Gateway] OpenAI WebSocket opened for client:', client.id);

          openAIws.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['audio', 'text'],
              instructions: `You are an AI reading assistant. Always respond in English. Answer questions about the book content clearly and concisely.`,
              voice: 'alloy',
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
            },
          }));

          console.log('[Gateway] Emitting session-started to client:', client.id);
          client.emit('session-ready', { sessionId: session._id });
        });

        openAIws.on('message', (raw) => {
          const event = JSON.parse(raw.toString()) as { type: string; error?: { message: string } };
          console.log('[Gateway] OpenAI event:', event.type);

          if (event.type === 'error') {
            console.error('[Gateway] OpenAI realtime error:', event.error);
            client.emit('error', { message: event.error?.message });
            return;
          }

          // forward all events to frontend as openai-event so the client
          // can handle them with the original OpenAI event structure
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


  // frontend sends audio chunks here
  @SubscribeMessage('send-audio')
  handleAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { audio: string }, // base64 encoded PCM16
  ) {
    console.log('Audio chunk received, length:', data.audio?.length);
    const openAIws = clientOpenAIMap.get(client.id);
    if (!openAIws || openAIws.readyState !== WebSocket.OPEN) return;

    openAIws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: data.audio,
    }));
  }

  // frontend signals user stopped speaking
  @SubscribeMessage('commit-audio')
  handleCommitAudio(@ConnectedSocket() client: Socket) {
    const openAIws = clientOpenAIMap.get(client.id);
    if (!openAIws || openAIws.readyState !== WebSocket.OPEN) return;

    openAIws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    openAIws.send(JSON.stringify({ type: 'response.create' }));
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