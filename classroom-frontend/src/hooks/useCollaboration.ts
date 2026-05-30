import * as Y from 'yjs';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const COLLABORATION_URL = import.meta.env.VITE_COLLABORATION_URL || 'http://localhost:8083';
const BACKEND_URL = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3001';

export function useCollaboration(classId: string, fileId: string) {
    const [content, setContent] = useState('');
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(1);
    const ydocRef = useRef<Y.Doc | null>(null);
    const clientRef = useRef<Client | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = useCallback((ydoc: Y.Doc) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(async () => {
            const state = Y.encodeStateAsUpdate(ydoc);
            try {
                await fetch(`${BACKEND_URL}collaboration/files/${fileId}/state`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ state: Array.from(state) }),
                });
            } catch {
                // silent — retried on next change
            }
        }, 2000);
    }, [fileId]);

    useEffect(() => {
        if (!classId || !fileId) return;

        const ydoc = new Y.Doc();
        const ytext = ydoc.getText('document');
        ydocRef.current = ydoc;

        const client = new Client({
            webSocketFactory: () => new SockJS(`${COLLABORATION_URL}/ws/collaboration`),
            onConnect: async () => {
                setConnected(true);

                // Load persisted state from backend
                try {
                    const res = await fetch(`${BACKEND_URL}collaboration/files/${fileId}/state`, {
                        credentials: 'include',
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.state?.length) {
                            Y.applyUpdate(ydoc, new Uint8Array(data.state), 'remote');
                        }
                    }
                } catch {
                    // no prior state — start fresh
                }

                client.subscribe(`/topic/collaboration/${classId}/${fileId}`, (message) => {
                    const update = new Uint8Array(JSON.parse(message.body));
                    Y.applyUpdate(ydoc, update, 'remote');
                });

                client.subscribe(`/topic/collaboration/${classId}/${fileId}/users`, (message) => {
                    const count = parseInt(message.body, 10);
                    if (!isNaN(count)) setOnlineUsers(count);
                });
            },
            onDisconnect: () => {
                setConnected(false);
                setOnlineUsers(1);
            },
        });

        client.activate();
        clientRef.current = client;

        ydoc.on('update', (update: Uint8Array, origin: unknown) => {
            if (origin === 'remote') return;
            if (client.connected) {
                client.publish({
                    destination: `/app/collaboration/${classId}/${fileId}/sync`,
                    body: JSON.stringify(Array.from(update)),
                });
            }
            scheduleSave(ydoc);
        });

        ytext.observe(() => {
            setContent(ytext.toString());
        });

        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            client.deactivate();
            ydoc.destroy();
            setContent('');
            setConnected(false);
            setOnlineUsers(1);
        };
    }, [classId, fileId, scheduleSave]);

    const updateContent = (newContent: string) => {
        const ydoc = ydocRef.current;
        if (!ydoc) return;
        const ytext = ydoc.getText('document');
        ydoc.transact(() => {
            ytext.delete(0, ytext.length);
            ytext.insert(0, newContent);
        });
    };

    return { content, connected, onlineUsers, updateContent };
}
