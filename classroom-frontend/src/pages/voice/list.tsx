import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useSession } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookOpen, Plus, Loader2, Headphones, Trash2 } from "lucide-react";

const VOICE_SERVICE_URL = import.meta.env.VITE_VOICE_SERVICE_URL;

type Book = {
  _id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  isProcessed: boolean;
  createdAt: string;
};

export default function VoiceList() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", author: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (!session?.user) return;
    setDeletingId(bookId);
    try {
      await fetch(`${VOICE_SERVICE_URL}/api/books/${bookId}`, {
        method: "DELETE",
        headers: { "x-user-id": session.user.id },
      });
      fetchBooks();
    } catch (err) {
      console.error("Failed to delete book", err);
    } finally {
      setDeletingId(null);
    }
  };

  const fetchBooks = async () => {
    if (!session?.user) return;
    try {
      const res = await fetch(`${VOICE_SERVICE_URL}/api/books`, {
        headers: { "x-user-id": session.user.id },
      });
      const data = await res.json();
      setBooks(data);
    } catch (e) {
      console.error("Failed to fetch books", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [session]);

  useEffect(() => {
    const hasUnprocessed = books.some(book => !book.isProcessed);

    if (!hasUnprocessed) return;

    const interval = setInterval(() => {
      fetchBooks();
    }, 3000); // poll every 3 seconds

    return () => clearInterval(interval);
  }, [books]);

  const handleUpload = async () => {
    if (!pdfFile || !form.title || !form.author || !session?.user) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("author", form.author);
    formData.append("pdf", pdfFile);
    if (coverFile) formData.append("cover", coverFile);

    try {
      const res = await fetch(`${VOICE_SERVICE_URL}/api/books`, {
        method: "POST",
        headers: { "x-user-id": session.user.id },
        body: formData,
      });

      if (res.ok) {
        setOpen(false);
        setForm({ title: "", author: "" });
        setPdfFile(null);
        setCoverFile(null);
        fetchBooks();
      }
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Voice Library</h1>
          <p className="text-muted-foreground mt-1">
            Upload books and have voice conversations with them
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Book
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload a Book</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  placeholder="Book title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Author</Label>
                <Input
                  placeholder="Author name"
                  value={form.author}
                  onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PDF File</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cover Image (optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={e => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploading || !pdfFile || !form.title || !form.author}
              >
                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-40 bg-muted rounded mb-3" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">No books yet</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Upload your first book to start a voice conversation
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map(book => (
            <Card
              key={book._id}
              className="cursor-pointer hover:shadow-md transition-shadow relative group"
              onClick={() => navigate(`/voice/${book._id}`)}
            >
              <button
                onClick={(e) => handleDelete(e, book._id)}
                disabled={deletingId === book._id}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-background/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                {deletingId === book._id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
              </button>
              <CardContent className="p-4">
                <div className="h-40 bg-muted rounded mb-3 flex items-center justify-center overflow-hidden">
                  {book.coverImageUrl ? (
                    <img
                      src={book.coverImageUrl}
                      alt={book.title}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <BookOpen className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-semibold truncate">{book.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                <div className="flex items-center gap-1 mt-2">
                  <div className={`w-2 h-2 rounded-full ${book.isProcessed ? "bg-green-500" : "bg-amber-500"}`} />
                  <span className="text-xs text-muted-foreground">
                    {book.isProcessed ? "Ready" : "Processing..."}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}