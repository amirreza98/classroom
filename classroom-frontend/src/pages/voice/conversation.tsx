import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, ArrowLeft, Loader2 } from "lucide-react";
import { io, Socket } from "socket.io-client";

const VOICE_SERVICE_URL = import.meta.env.VITE_VOICE_SERVICE_URL;

type Message = {
  role: "user" | "assistant";
  text: string;
};

export default function VoiceConversation() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { data: session } = useSession();

  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState("Click mic to start");

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      stopRecording();
      socketRef.current?.disconnect();
    };
  }, []);

  const connectToVoiceService = async () => {
    if (!session?.user || !bookId) return;
    if (socketRef.current?.connected) return; // prevent reconnection


    setStatus("Connecting...");

    const socket = io(`${VOICE_SERVICE_URL}/voice`, {
      transports: ["polling", "websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      socket.emit("start-session", {
        bookId,
        userId: session.user.id,
      });
    });

    socket.on("session-ready", (data: { sessionId: string }) => {
      console.log("Session ready:", data);
      setSessionId(data.sessionId);
      setConnected(true);
      setStatus("Connected — tap mic to speak");
    });

    socket.on("openai-event", (event: any) => {
      if (
        event.type === "conversation.item.created" &&
        event.item?.role === "user" &&
        event.item?.content?.[0]?.transcript
      ) {
        setMessages(prev => [
          ...prev,
          { role: "user", text: event.item.content[0].transcript },
        ]);
      }

      if (event.type === "response.audio_transcript.done") {
        setMessages(prev => [
          ...prev,
          { role: "assistant", text: event.transcript },
        ]);
      }

      if (event.type === "response.audio.delta" && event.delta) {
        playAudioChunk(event.delta);
      }
    });

    socket.on("session-ended", () => {
      setConnected(false);
      setStatus("Session ended");
    });

    socket.on("connect_error", (err) => {
      console.error("Connect error:", err.message);
      setStatus(`Connection error: ${err.message}`);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setConnected(false);
    });

    socket.on("error", (err: { message: string }) => {
      setStatus(`Error: ${err.message}`);
      setConnected(false);
    });
  };

  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  const playAudioQueue = async (ctx: AudioContext) => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const float32 = audioQueueRef.current.shift()!;
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      await new Promise<void>(resolve => {
        source.onended = () => resolve();
        source.start();
      });
    }
    
    isPlayingRef.current = false;
  };

  const playAudioChunk = async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const pcm = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) {
        float32[i] = pcm[i] / 32768;
      }

      audioQueueRef.current.push(float32);
      playAudioQueue(ctx);
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };

  const startRecording = async () => {
    if (!connected) {
      await connectToVoiceService();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
        }
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        console.log("Sending audio chunk, length:", base64.length); // add this
        socketRef.current?.emit("send-audio", { audio: base64 });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      mediaRecorderRef.current = { stream, processor, source } as any;
      setRecording(true);
      setStatus("Listening...");
    } catch (e) {
      setStatus("Microphone access denied");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current as any;
    if (recorder) {
      recorder.processor?.disconnect();
      recorder.source?.disconnect();
      recorder.stream?.getTracks().forEach((t: any) => t.stop());
      mediaRecorderRef.current = null;
    }
    if (recording) {
      socketRef.current?.emit("commit-audio");
      setRecording(false);
      setStatus("Processing...");
    }
  };

  const endSession = () => {
    if (sessionId) {
      socketRef.current?.emit("end-session", { sessionId });
    }
    socketRef.current?.disconnect();
    navigate("/voice");
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={endSession}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Voice Conversation</h1>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Your conversation will appear here
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          variant={recording ? "destructive" : "default"}
          className="rounded-full w-16 h-16"
          onClick={recording ? stopRecording : startRecording}
          disabled={status === "Connecting..." || status === "Processing..."}
        >
          {status === "Connecting..." || status === "Processing..." ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : recording ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          {recording ? "Tap to stop" : connected ? "Tap to speak" : "Tap to connect"}
        </p>
      </div>
    </div>
  );
}
