import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useOne } from '@refinedev/core';
import { ClassDetails } from '@/types';
import { useCollaboration } from '@/hooks/useCollaboration';
import { CollaborationEditor } from '@/components/CollaborationEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ArrowLeft, FileText, Plus, Trash2, Users } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3001';

type CollabFile = {
    id: string;
    name: string;
    classId: number;
    createdAt?: string;
};

export default function CollaboratePage() {
    const { classId } = useParams<{ classId: string }>();
    const navigate = useNavigate();

    const [files, setFiles] = useState<CollabFile[]>([]);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [showNewFileInput, setShowNewFileInput] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const { data: classData, isLoading: isClassLoading } = useOne<ClassDetails>({
        resource: 'classes',
        id: classId!,
    });
    const classDetails = classData?.data;

    const selectedFile = files.find(f => f.id === selectedFileId) ?? null;

    const { content, connected, onlineUsers, updateContent } = useCollaboration(
        classId ?? '',
        selectedFileId ?? ''
    );

    useEffect(() => {
        if (!classId) return;
        setIsLoadingFiles(true);
        fetch(`${BACKEND}/api/collaboration/classes/${classId}/files`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setFiles(Array.isArray(data) ? data : (data.files ?? [])))
            .catch(() => {})
            .finally(() => setIsLoadingFiles(false));
    }, [classId]);

    const handleCreateFile = async () => {
        const name = newFileName.trim();
        if (!name || !classId) return;
        setIsCreating(true);
        try {
            const res = await fetch(`${BACKEND}/api/collaboration/classes/${classId}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                const file: CollabFile = await res.json();
                setFiles(prev => [...prev, file]);
                setSelectedFileId(file.id);
                setNewFileName('');
                setShowNewFileInput(false);
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteFile = async (fileId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const res = await fetch(`${BACKEND}/api/collaboration/files/${fileId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (res.ok) {
            setFiles(prev => prev.filter(f => f.id !== fileId));
            if (selectedFileId === fileId) setSelectedFileId(null);
        }
    };

    return (
        <div className="flex flex-col gap-4 pb-4">
            <div className="flex items-center gap-2 -ml-2">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-2xl font-bold">Collaboration</h2>
            </div>

            <div
                className="flex border rounded-lg overflow-hidden bg-background"
                style={{ height: 'calc(100vh - 11rem)' }}
            >
                {/* Left sidebar */}
                <aside className="w-[250px] shrink-0 flex flex-col border-r">
                    <div className="px-4 py-3 border-b">
                        {isClassLoading ? (
                            <Skeleton className="h-4 w-32" />
                        ) : (
                            <p className="font-semibold text-sm truncate">
                                {classDetails?.name ?? 'Class'}
                            </p>
                        )}
                    </div>

                    <div className="px-2 py-2 border-b">
                        {showNewFileInput ? (
                            <div className="flex gap-1">
                                <Input
                                    autoFocus
                                    placeholder="filename.js"
                                    value={newFileName}
                                    onChange={e => setNewFileName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleCreateFile();
                                        if (e.key === 'Escape') {
                                            setShowNewFileInput(false);
                                            setNewFileName('');
                                        }
                                    }}
                                    className="h-7 text-xs"
                                />
                                <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs shrink-0"
                                    onClick={handleCreateFile}
                                    disabled={isCreating || !newFileName.trim()}
                                >
                                    {isCreating ? '…' : 'Add'}
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-7 text-xs gap-1.5"
                                onClick={() => setShowNewFileInput(true)}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New File
                            </Button>
                        )}
                    </div>

                    <ScrollArea className="flex-1">
                        {isLoadingFiles ? (
                            <div className="p-2 space-y-1">
                                {[1, 2, 3].map(i => (
                                    <Skeleton key={i} className="h-8 w-full rounded-md" />
                                ))}
                            </div>
                        ) : files.length === 0 ? (
                            <p className="p-4 text-xs text-muted-foreground text-center">
                                No files yet. Create one above.
                            </p>
                        ) : (
                            <div className="p-1 space-y-px">
                                {files.map(file => (
                                    <button
                                        key={file.id}
                                        onClick={() => setSelectedFileId(file.id)}
                                        className={cn(
                                            'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left group transition-colors',
                                            'hover:bg-muted',
                                            selectedFileId === file.id && 'bg-primary/10 text-primary font-medium'
                                        )}
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{file.name}</span>
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-transparent"
                                            onClick={e => handleDeleteFile(file.id, e)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </aside>

                {/* Main area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {selectedFile ? (
                        <>
                            {/* Top bar */}
                            <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">{selectedFile.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    <Users className="h-3.5 w-3.5" />
                                    <span>{onlineUsers} online</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden p-4">
                                <CollaborationEditor
                                    content={content}
                                    connected={connected}
                                    updateContent={updateContent}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center space-y-3">
                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                                    <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
                                </div>
                                <div>
                                    <p className="font-medium text-muted-foreground">
                                        Select or create a file
                                    </p>
                                    <p className="text-sm text-muted-foreground opacity-70 mt-1">
                                        Pick a file from the sidebar to start collaborating
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
