import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, PhoneOff, ArrowLeft, Loader2, PhoneCall, ChevronUp, ChevronDown } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { cn } from "@/lib/utils";

const VOICE_SERVICE_URL = import.meta.env.VITE_VOICE_SERVICE_URL;

// ── Types ──────────────────────────────────────────────────────────────────
type CallState = "idle" | "connecting" | "ready" | "listening" | "processing" | "speaking";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: Date;
  pending?: boolean;
};

const STATE_LABEL: Record<CallState, string> = {
  idle:        "Ready to start",
  connecting:  "Connecting…",
  ready:       "Tap mic to speak",
  listening:   "Listening…",
  processing:  "Thinking…",
  speaking:    "Speaking…",
};

// ── Helpers ──────────────────────────────────────────────────────────────
function formatDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// ── Waveform bars ────────────────────────────────────────────────────────
function AiWaveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.85, 0.6, 0.9, 0.5];
  return (
    <>
      <style>{`
        @keyframes ai-wave {
          0%, 100% { transform: scaleY(0.12); }
          50%       { transform: scaleY(1); }
        }
      `}</style>
      <div className="flex items-end justify-center gap-1 h-10">
        {bars.map((peak, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-blue-400 origin-bottom"
            style={
              active
                ? {
                    height: `${peak * 40}px`,
                    animation: `ai-wave ${0.55 + i * 0.07}s ease-in-out infinite`,
                    animationDelay: `${i * 0.09}s`,
                  }
                : { height: "3px", transition: "height 0.3s" }
            }
          />
        ))}
      </div>
    </>
  );
}

function MicWaveform({ levels }: { levels: number[] }) {
  return (
    <div className="flex items-end justify-center gap-0.5 h-10">
      {levels.map((lvl, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-red-400"
          style={{ height: `${Math.max(3, lvl * 38)}px`, transition: "height 70ms" }}
        />
      ))}
    </div>
  );
}

// ── Central AI orb ───────────────────────────────────────────────────────
function AiOrb({ state }: { state: CallState }) {
  const isSpeaking   = state === "speaking";
  const isListening  = state === "listening";
  const isProcessing = state === "processing";

  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      <div className={cn(
        "absolute inset-0 rounded-full transition-all duration-700",
        isSpeaking  && "bg-blue-500/10 animate-ping",
        isListening && "bg-red-500/10 animate-ping",
      )} />
      <div className={cn(
        "absolute w-36 h-36 rounded-full transition-all duration-500",
        isSpeaking   && "bg-blue-500/15 animate-pulse",
        isListening  && "bg-red-500/15 animate-pulse",
        isProcessing && "bg-amber-500/10 animate-pulse",
      )} />
      <div className={cn(
        "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500",
        isSpeaking   && "bg-blue-600  shadow-[0_0_48px_rgba(59,130,246,0.55)]",
        isListening  && "bg-red-600   shadow-[0_0_48px_rgba(220,38,38,0.55)]",
        isProcessing && "bg-amber-600 shadow-[0_0_48px_rgba(217,119,6,0.45)]",
        !isSpeaking && !isListening && !isProcessing && "bg-slate-700 shadow-[0_0_24px_rgba(0,0,0,0.4)]",
      )}>
        {isProcessing && (
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
        )}
        <svg viewBox="0 0 24 24" className="w-11 h-11 text-white" fill="currentColor">
          <path d="M12 2a5 5 0 0 1 5 5v4a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5Zm-7 9a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V19h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-1.08A7 7 0 0 1 5 11Z" />
        </svg>
      </div>
    </div>
  );
}

// ── Typing dots ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
      <div className="flex items-center gap-1 py-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"
            style={{ animation: `dot-bounce 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </>
  );
}

// ── Message bubble ───────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5 px-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5",
        isUser ? "bg-slate-600 text-slate-200" : "bg-blue-600 text-white",
      )}>
        {isUser ? "U" : "AI"}
      </div>
      <div className="flex flex-col gap-0.5 max-w-[78%]">
        <div className={cn(
          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-slate-700 text-slate-100 rounded-tr-sm"
            : "bg-slate-800 border border-slate-700 text-slate-100 rounded-tl-sm",
        )}>
          {msg.pending && msg.text === "" ? <TypingDots /> : msg.text}
        </div>
        <span className={cn("text-[10px] text-slate-500", isUser ? "text-right" : "text-left")}>
          {msg.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────
export default function VoiceConversation() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { data: session } = useSession();

  const [callState, setCallState]           = useState<CallState>("idle");
  const [sessionId, setSessionId]           = useState<string | null>(null);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [duration, setDuration]             = useState(0);
  const [micLevels, setMicLevels]           = useState<number[]>(Array(18).fill(0));
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  const socketRef           = useRef<Socket | null>(null);
  const playCtxRef          = useRef<AudioContext | null>(null);
  const activeSourceRef     = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueRef       = useRef<Float32Array[]>([]);
  const isPlayingRef        = useRef(false);
  const durationRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef      = useRef<HTMLDivElement>(null);
  const callStateRef        = useRef<CallState>("idle");
  const pendingUserMsgIdRef = useRef<string | null>(null);
  const streamingAiMsgIdRef = useRef<string | null>(null);

  const micActiveRef = useRef(false);
  const micNodeRefs  = useRef<{
    stream: MediaStream;
    processor: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    silentGain: GainNode;
    animFrame: number;
    ctx: AudioContext;
  } | null>(null);

  useEffect(() => { callStateRef.current = callState; }, [callState]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (callState !== "idle" && callState !== "connecting") {
      durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      if (durationRef.current) clearInterval(durationRef.current);
      setDuration(0);
    }
    return () => { if (durationRef.current) clearInterval(durationRef.current); };
  }, [callState]);

  useEffect(() => {
    return () => {
      cleanupMic();
      socketRef.current?.disconnect();
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, []);

  // ── Mic cleanup ───────────────────────────────────────────────────────
  const cleanupMic = useCallback(() => {
    micActiveRef.current = false;
    if (micNodeRefs.current) {
      const { animFrame, processor, source, analyser, silentGain, stream, ctx } = micNodeRefs.current;
      cancelAnimationFrame(animFrame);
      processor.disconnect();
      source.disconnect();
      analyser.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach(t => t.stop());
      ctx.close().catch(() => {});
      micNodeRefs.current = null;
    }
    setMicLevels(Array(18).fill(0));
  }, []);

  // ── Stop AI audio immediately ─────────────────────────────────────────
  const stopAiAudio = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current  = false;
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch (_) {}
      activeSourceRef.current = null;
    }
  }, []);

  // ── Audio playback ────────────────────────────────────────────────────
  const playAudioQueue = useCallback(async (ctx: AudioContext) => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    setCallState("speaking");

    while (audioQueueRef.current.length > 0) {
      const float32 = audioQueueRef.current.shift()!;
      const buffer  = ctx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      activeSourceRef.current = source;
      source.buffer = buffer;
      source.connect(ctx.destination);

      await new Promise<void>(resolve => {
        source.onended = () => { activeSourceRef.current = null; resolve(); };
        source.start();
      });
    }

    isPlayingRef.current = false;
    setCallState("ready");
  }, []);

  const playAudioChunk = useCallback(async (base64Audio: string) => {
    try {
      if (!playCtxRef.current) {
        playCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx    = playCtxRef.current;
      const binary = atob(base64Audio);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const pcm = new Int16Array(bytes.buffer);
      const f32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i] / 32768;

      audioQueueRef.current.push(f32);
      playAudioQueue(ctx);
    } catch (e) {
      console.error("Playback error", e);
    }
  }, [playAudioQueue]);

  // ── Socket / call logic ───────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!session?.user || !bookId) return;
    setCallState("connecting");

    const socket = io(`${VOICE_SERVICE_URL}/voice`, {
      transports: ["polling", "websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("start-session", { bookId, userId: session.user.id });
    });

    socket.on("session-ready", (data: { sessionId: string }) => {
      setSessionId(data.sessionId);
      setCallState("ready");
    });

    socket.on("openai-event", (event: any) => {

      if (event.type === "conversation.item.input_audio_transcription.completed") {
        const transcript = event.transcript?.trim();
        if (transcript && pendingUserMsgIdRef.current) {
          setMessages(prev =>
            prev.map(m =>
              m.id === pendingUserMsgIdRef.current
                ? { ...m, text: transcript, pending: false }
                : m
            )
          );
          pendingUserMsgIdRef.current = null;
        }
      }

      if (event.type === "response.audio_transcript.delta" && event.delta) {
        setMessages(prev => {
          if (streamingAiMsgIdRef.current) {
            return prev.map(m =>
              m.id === streamingAiMsgIdRef.current
                ? { ...m, text: m.text + event.delta }
                : m
            );
          }
          const newId = uid();
          streamingAiMsgIdRef.current = newId;
          return [...prev, { id: newId, role: "assistant", text: event.delta, ts: new Date(), pending: true }];
        });
      }

      if (event.type === "response.audio_transcript.done") {
        if (streamingAiMsgIdRef.current) {
          setMessages(prev =>
            prev.map(m =>
              m.id === streamingAiMsgIdRef.current
                ? { ...m, text: event.transcript, pending: false }
                : m
            )
          );
          streamingAiMsgIdRef.current = null;
        } else {
          setMessages(prev => [...prev, { id: uid(), role: "assistant", text: event.transcript, ts: new Date() }]);
        }
        setTimeout(() => {
          setCallState(prev => prev === "processing" ? "ready" : prev);
        }, 300);
      }

      if (event.type === "response.audio.delta" && event.delta) {
        playAudioChunk(event.delta);
      }

      if (event.type === "response.done") {
        if (pendingUserMsgIdRef.current) {
          setMessages(prev =>
            prev.map(m =>
              m.id === pendingUserMsgIdRef.current
                ? { ...m, text: "🎤 (audio message)", pending: false }
                : m
            )
          );
          pendingUserMsgIdRef.current = null;
        }
        if (streamingAiMsgIdRef.current) {
          setMessages(prev =>
            prev.map(m =>
              m.id === streamingAiMsgIdRef.current ? { ...m, pending: false } : m
            )
          );
          streamingAiMsgIdRef.current = null;
        }
        setTimeout(() => {
          setCallState(prev =>
            prev === "processing" || prev === "speaking" ? "ready" : prev
          );
        }, 500);
      }
    });

    socket.on("disconnect", () => {
      setCallState("idle");
    });
  }, [session, bookId, playAudioChunk]);

  const endSession = useCallback(() => {
    stopAiAudio();
    if (playCtxRef.current) {
      playCtxRef.current.close().catch(() => {});
      playCtxRef.current = null;
    }
    if (sessionId) socketRef.current?.emit("end-session", { sessionId });
    cleanupMic();
    socketRef.current?.disconnect();
    setCallState("idle");
    setMessages([]);
    streamingAiMsgIdRef.current = null;
    pendingUserMsgIdRef.current = null;
    navigate("/voice");
  }, [sessionId, cleanupMic, stopAiAudio, navigate]);

  // ── Mic toggle ────────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const state = callStateRef.current;

    // ── BARGE-IN: user taps mic while AI is speaking ──────────────────
    // Cancel the AI, flush audio, then fall through to start recording
    if (state === "speaking") {
      socketRef.current?.emit("cancel-ai-response");
      stopAiAudio();
      // Dismiss any streaming AI bubble that was cut off mid-sentence
      if (streamingAiMsgIdRef.current) {
        setMessages(prev =>
          prev.map(m =>
            m.id === streamingAiMsgIdRef.current ? { ...m, pending: false } : m
          )
        );
        streamingAiMsgIdRef.current = null;
      }
      callStateRef.current = "ready";
      setCallState("ready");
      // Small tick so state settles before we open the mic
      await new Promise(r => setTimeout(r, 30));
    }

    if (callStateRef.current === "ready") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 24000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });

        const ctx      = new AudioContext({ sampleRate: 24000 });
        const source   = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;

        const processor = ctx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = e => {
          if (!micActiveRef.current) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const pcm16   = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          socketRef.current?.emit("send-audio", { audio: base64 });
        };

        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;

        source.connect(analyser);
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);

        const freqData = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!micActiveRef.current) return;
          analyser.getByteFrequencyData(freqData);
          const levels = Array.from({ length: 18 }, (_, i) => {
            const idx = Math.floor((i / 18) * freqData.length);
            return freqData[idx] / 255;
          });
          setMicLevels(levels);
          const nextFrame = requestAnimationFrame(tick);
          if (micNodeRefs.current) micNodeRefs.current.animFrame = nextFrame;
        };

        const animFrame = requestAnimationFrame(tick);
        micNodeRefs.current = { stream, processor, source, analyser, silentGain, animFrame, ctx };
        micActiveRef.current = true;

        setCallState("listening");
      } catch {
        setCallState("ready");
      }

    } else if (callStateRef.current === "listening") {
      cleanupMic();

      const msgId = uid();
      pendingUserMsgIdRef.current = msgId;
      setMessages(prev => [...prev, { id: msgId, role: "user", text: "", ts: new Date(), pending: true }]);

      socketRef.current?.emit("commit-audio");
      setCallState("processing");
    }
  }, [cleanupMic, stopAiAudio]);

  const isCallActive = callState !== "idle" && callState !== "connecting";
  const isListening  = callState === "listening";
  const isSpeaking   = callState === "speaking";

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={() => (isCallActive ? endSession() : navigate("/voice"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold text-slate-200">AI Voice Chat</span>
          {isCallActive && (
            <span className="text-xs text-slate-500 tabular-nums">{formatDuration(duration)}</span>
          )}
        </div>
        <div className={cn(
          "px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all duration-300",
          isListening  && "bg-red-500/20 text-red-300 border border-red-500/30",
          isSpeaking   && "bg-blue-500/20 text-blue-300 border border-blue-500/30",
          callState === "processing" && "bg-amber-500/20 text-amber-300 border border-amber-500/30",
          !isListening && !isSpeaking && callState !== "processing" && "bg-slate-800 text-slate-400 border border-slate-700",
        )}>
          {STATE_LABEL[callState]}
        </div>
      </div>

      {/* ── Central visual area ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 min-h-0">
        {!isCallActive ? (
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              <PhoneCall className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm">Start a voice conversation with your book</p>
            <Button
              size="lg"
              className="rounded-full h-14 px-10 gap-2 text-base bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40"
              onClick={startCall}
              disabled={callState === "connecting"}
            >
              {callState === "connecting"
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Connecting…</>
                : <><PhoneCall className="w-5 h-5" /> Start Call</>
              }
            </Button>
          </div>
        ) : (
          <>
            <AiOrb state={callState} />
            <div className="h-12 flex items-center justify-center">
              {isListening
                ? <MicWaveform levels={micLevels} />
                : <AiWaveform  active={isSpeaking} />
              }
            </div>
            <p className={cn(
              "text-sm font-medium tracking-wide transition-colors duration-300",
              isListening  && "text-red-400",
              isSpeaking   && "text-blue-400",
              callState === "processing" && "text-amber-400",
              callState === "ready"      && "text-slate-400",
            )}>
              {STATE_LABEL[callState]}
            </p>
          </>
        )}
      </div>

      {/* ── Transcript panel ─────────────────────────────────────── */}
      {isCallActive && (
        <div className={cn(
          "flex-shrink-0 border-t border-slate-800/60 bg-slate-900/70 backdrop-blur-sm transition-all duration-300",
          transcriptOpen ? "h-96" : "h-10",
        )}>
          <button
            className="w-full flex items-center justify-between px-4 h-10 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            onClick={() => setTranscriptOpen(o => !o)}
          >
            <span>Transcript{messages.length > 0 ? ` (${messages.length})` : ""}</span>
            {transcriptOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {transcriptOpen && (
            <ScrollArea className="h-[calc(100%-40px)]">
              <div className="flex flex-col gap-3 py-2 pb-3">
                {messages.length === 0 ? (
                  <p className="text-center text-xs text-slate-600 py-6">
                    Your conversation will appear here
                  </p>
                ) : (
                  messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────── */}
      {isCallActive && (
        <div className="flex-shrink-0 flex items-center justify-center gap-12 py-5 bg-slate-900/80 border-t border-slate-800/60">
          <div className="flex flex-col items-center gap-1.5">
            <button
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg focus:outline-none",
                isListening
                  ? "bg-red-600 hover:bg-red-500 shadow-red-900/50 ring-4 ring-red-500/25"
                  : callState === "speaking"
                    ? "bg-orange-600 hover:bg-orange-500 shadow-orange-900/50 ring-4 ring-orange-500/25"
                    : callState !== "ready"
                      ? "bg-slate-700 cursor-not-allowed opacity-40"
                      : "bg-slate-700 hover:bg-slate-600 shadow-slate-900/50",
              )}
              onClick={toggleMic}
              disabled={callState !== "ready" && callState !== "listening" && callState !== "speaking"}
            >
              {isListening
                ? <MicOff className="w-7 h-7 text-white" />
                : <Mic    className="w-7 h-7 text-white" />
              }
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {isListening ? "Done" : isSpeaking ? "Interrupt" : "Speak"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button
              className="w-16 h-16 rounded-full bg-red-700 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/50 transition-all duration-200 focus:outline-none"
              onClick={endSession}
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              End
            </span>
          </div>
        </div>
      )}
    </div>
  );
}