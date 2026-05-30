interface Props {
    content: string;
    connected: boolean;
    updateContent: (val: string) => void;
    readOnly?: boolean;
}

export function CollaborationEditor({ content, connected, updateContent, readOnly = false }: Props) {
    return (
        <div className="flex flex-col gap-2 h-full">
            <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-xs text-muted-foreground">
                    {connected ? 'Live — changes sync instantly' : 'Connecting...'}
                </span>
            </div>

            <textarea
                value={content}
                onChange={(e) => updateContent(e.target.value)}
                readOnly={readOnly}
                placeholder="Start typing — all students see this in real time..."
                className="flex-1 w-full resize-none rounded-md border border-input bg-transparent px-4 py-3 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
        </div>
    );
}
