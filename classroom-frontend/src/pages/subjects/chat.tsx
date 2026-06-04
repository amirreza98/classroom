import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useSession } from '@/lib/auth-client';
import { authHeader } from '@/lib/token';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

const BACKEND = import.meta.env.VITE_BACKEND_BASE_URL as string;

function initials(name?: string) {
    return (name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function SubjectChatPage() {
    const { subjectId } = useParams<{ subjectId: string }>();
    const navigate = useNavigate();
    const { data: session } = useSession();
    const userId = session?.user?.id;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [subjectName, setSubjectName] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const lastTimestampRef = useRef<string | null>(null);

    const scrollToBottom = useCallback(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const fetchMessages = useCallback(async (initial = false) => {
        try {
            const hdrs = await authHeader();
            const since = !initial && lastTimestampRef.current ? `&since=${encodeURIComponent(lastTimestampRef.current)}` : '';
            const url = `${BACKEND}chat/subjects/${subjectId}/messages?limit=50${since}`;
            const res = await fetch(url, { headers: hdrs });
            if (!res.ok) return;
            const data = await res.json();
            const incoming: ChatMessage[] = data.data ?? [];
            if (incoming.length === 0) return;

            if (initial) {
                setMessages(incoming);
            } else {
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const newOnes = incoming.filter(m => !existingIds.has(m.id));
                    return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
                });
            }
            lastTimestampRef.current = incoming[incoming.length - 1].createdAt;
        } finally {
            if (initial) setLoading(false);
        }
    }, [subjectId]);

    // Fetch subject name
    useEffect(() => {
        authHeader().then(hdrs =>
            fetch(`${BACKEND}subjects/${subjectId}`, { headers: hdrs })
                .then(r => r.json())
                .then(d => setSubjectName(d.data?.name ?? 'Subject'))
                .catch(() => {})
        );
    }, [subjectId]);

    useEffect(() => {
        fetchMessages(true);
        const interval = setInterval(() => fetchMessages(false), 3000);
        return () => clearInterval(interval);
    }, [fetchMessages]);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    const sendMessage = async () => {
        const text = content.trim();
        if (!text || sending) return;
        setSending(true);
        setContent('');
        try {
            const res = await fetch(`${BACKEND}chat/subjects/${subjectId}/messages`, {
                method: 'POST',
                headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text }),
            });
            if (res.ok) {
                const data = await res.json();
                const msg: ChatMessage = data.data;
                setMessages(prev => [...prev, msg]);
                lastTimestampRef.current = msg.createdAt;
                scrollToBottom();
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)]">
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-xl font-bold">{subjectName} — Chat</h2>
                    <p className="text-xs text-muted-foreground">Public chat hall for this subject</p>
                </div>
            </div>

            <div className="flex flex-col flex-1 border rounded-lg overflow-hidden bg-background">
                <ScrollArea className="flex-1 p-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1,2,3].map(i => (
                                <div key={i} className="flex gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                    <div className="space-y-1 flex-1">
                                        <Skeleton className="h-3 w-24" />
                                        <Skeleton className="h-10 w-2/3 rounded-lg" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                            No messages yet. Say hello!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map(msg => {
                                const isOwn = msg.userId === userId;
                                return (
                                    <div key={msg.id} className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
                                        {!isOwn && (
                                            <Avatar className="h-8 w-8 shrink-0">
                                                <AvatarImage src={msg.userImage} />
                                                <AvatarFallback className="text-xs">{initials(msg.userName)}</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={cn('flex flex-col gap-1 max-w-[70%]', isOwn && 'items-end')}>
                                            {!isOwn && (
                                                <span className="text-xs text-muted-foreground font-medium">{msg.userName}</span>
                                            )}
                                            <div className={cn(
                                                'px-3 py-2 rounded-2xl text-sm',
                                                isOwn
                                                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                                    : 'bg-muted rounded-tl-sm'
                                            )}>
                                                {msg.content}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>
                    )}
                </ScrollArea>

                <div className="border-t p-3 flex gap-2">
                    <Input
                        placeholder="Type a message..."
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        className="flex-1"
                    />
                    <Button size="icon" onClick={sendMessage} disabled={!content.trim() || sending}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
