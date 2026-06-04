import { useState, useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { authHeader } from '@/lib/token';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import UploadWidget from '@/components/upload-widget';
import { Loader2, User } from 'lucide-react';
import type { UploadWidgetValue } from '@/types';

const BACKEND = import.meta.env.VITE_BACKEND_BASE_URL as string;

export default function ProfilePage() {
    const { data: session, refetch } = useSession();
    const user = session?.user as any;

    const [name, setName] = useState('');
    const [profileImage, setProfileImage] = useState<UploadWidgetValue | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name ?? '');
            if (user.image && user.imageCldPubId) {
                setProfileImage({ url: user.image, publicId: user.imageCldPubId });
            }
        }
    }, [user?.id]);

    const handleSave = async () => {
        if (!user?.id) return;
        if (name.trim().length < 2) { setError('Name must be at least 2 characters'); return; }
        setError('');
        setSaving(true);
        try {
            const res = await fetch(`${BACKEND}users/${user.id}`, {
                method: 'PUT',
                headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    image: profileImage?.url ?? user.image,
                    imageCldPubId: profileImage?.publicId ?? user.imageCldPubId,
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                setError(d.error ?? 'Failed to save profile');
                return;
            }
            setSaved(true);
            refetch();
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const initials = (name || user?.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="flex flex-col gap-6 max-w-xl">
            <div>
                <h1 className="text-3xl font-bold">My Profile</h1>
                <p className="text-muted-foreground mt-1">Manage your account details</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Profile Settings
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6 flex flex-col gap-6">
                    {/* Avatar preview */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={profileImage?.url ?? user?.image} alt={name} />
                            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-1">
                            <p className="font-medium">{name || user?.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
                            <p className="text-sm text-muted-foreground">{user?.email}</p>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Display Name</label>
                        <Input
                            placeholder="Your full name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Profile Picture</label>
                        <UploadWidget
                            value={profileImage}
                            onChange={setProfileImage}
                        />
                        {profileImage && (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setProfileImage(null)}>
                                Remove photo
                            </Button>
                        )}
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {saved && <p className="text-sm text-green-600">Profile saved!</p>}

                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
