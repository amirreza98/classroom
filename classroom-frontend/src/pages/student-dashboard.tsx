import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '@/lib/auth-client';
import { authHeader } from '@/lib/token';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, CalendarDays, MessageSquare, User, DollarSign, Activity, GraduationCap } from 'lucide-react';
import type { StudentEnrolledClass, Payment, StudentAnalyticsStats } from '@/types';

const BACKEND = import.meta.env.VITE_BACKEND_BASE_URL as string;

function formatCurrency(amount: string) {
    return Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function paymentBadge(status: string) {
    if (status === 'paid') return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
    if (status === 'pending') return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="secondary">Free</Badge>;
}

export default function StudentDashboard() {
    const { data: session } = useSession();
    const navigate = useNavigate();
    const userId = session?.user?.id;

    const [classes, setClasses] = useState<StudentEnrolledClass[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [analytics, setAnalytics] = useState<StudentAnalyticsStats | null>(null);
    const [recentEvents, setRecentEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [joinOpen, setJoinOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [joinClassId, setJoinClassId] = useState('');
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState('');

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const hdrs = await authHeader();
            const [overviewRes, paymentsRes, statsRes, recentRes] = await Promise.allSettled([
                fetch(`${BACKEND}student-dashboard/overview`, { headers: hdrs }),
                fetch(`${BACKEND}payments/my`, { headers: hdrs }),
                fetch(`${BACKEND}analytics/student/${userId}/stats`, { headers: hdrs }),
                fetch(`${BACKEND}analytics/student/${userId}/recent?limit=10`, { headers: hdrs }),
            ]);

            if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
                const d = await overviewRes.value.json();
                setClasses(d.data?.enrolledClasses ?? []);
            }
            if (paymentsRes.status === 'fulfilled' && paymentsRes.value.ok) {
                const d = await paymentsRes.value.json();
                setPayments(d.data ?? []);
            }
            if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
                const d = await statsRes.value.json();
                setAnalytics(d);
            }
            if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
                const d = await recentRes.value.json();
                setRecentEvents(d.data ?? []);
            }
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleJoin = async () => {
        setJoinError('');
        if (!joinClassId) { setJoinError('Class ID is required'); return; }
        setJoining(true);
        try {
            const res = await fetch(`${BACKEND}enrollments/self-enroll`, {
                method: 'POST',
                headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: Number(joinClassId), inviteCode: inviteCode || undefined }),
            });
            const data = await res.json();
            if (!res.ok) { setJoinError(data.error ?? 'Failed to join class'); return; }
            if (data.data?.requiresPayment) {
                window.location.href = data.data.checkoutUrl;
            } else {
                setJoinOpen(false);
                setInviteCode('');
                setJoinClassId('');
                fetchData();
            }
        } finally {
            setJoining(false);
        }
    };

    const statItems = analytics?.stats ? [
        { label: 'Classes Joined', value: analytics.stats['student.enrolled'] ?? 0, icon: GraduationCap },
        { label: 'Logins', value: analytics.stats['student.login'] ?? 0, icon: User },
        { label: 'Collaboration Sessions', value: analytics.stats['student.collaboration.join'] ?? 0, icon: Activity },
        { label: 'Voice Sessions', value: analytics.stats['student.voice.start'] ?? 0, icon: BookOpen },
    ] : [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">My Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Welcome back, {session?.user?.name}</p>
                </div>
                <Button onClick={() => setJoinOpen(true)}>
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Join a Class
                </Button>
            </div>

            <Tabs defaultValue="classes">
                <TabsList>
                    <TabsTrigger value="classes">My Classes</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                </TabsList>

                {/* My Classes */}
                <TabsContent value="classes" className="mt-4">
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>)}
                        </div>
                    ) : classes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                            <CalendarDays className="h-12 w-12 text-muted-foreground" />
                            <p className="font-medium text-muted-foreground">Not enrolled in any classes yet.</p>
                            <Button onClick={() => setJoinOpen(true)}>Join a Class</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {classes.map(cls => (
                                <Card key={cls.enrollmentId} className="flex flex-col">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <CardTitle className="text-base leading-snug">{cls.className}</CardTitle>
                                            <Badge variant={cls.classStatus === 'active' ? 'default' : 'secondary'} className="shrink-0 capitalize">
                                                {cls.classStatus}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-2 flex-1 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 shrink-0" />
                                            <span>{cls.subjectName}</span>
                                            {Number(cls.subjectPrice) > 0 && (
                                                <span className="ml-auto text-xs text-green-700 font-medium">{formatCurrency(cls.subjectPrice)}</span>
                                            )}
                                        </div>
                                        {cls.teacherName && (
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 shrink-0" />
                                                <span>{cls.teacherName}</span>
                                            </div>
                                        )}
                                        {cls.schedules && cls.schedules.length > 0 && (
                                            <div className="flex flex-col gap-1">
                                                {cls.schedules.map((s, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <CalendarDays className="h-4 w-4 shrink-0" />
                                                        <span>{s.day} · {s.startTime} – {s.endTime}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="mt-1">{paymentBadge(cls.paymentStatus)}</div>
                                    </CardContent>
                                    <CardFooter className="pt-0 flex gap-2">
                                        <Button
                                            className="flex-1"
                                            disabled={cls.classStatus !== 'active'}
                                            onClick={() => navigate(`/schedule/class/${cls.classId}`)}
                                        >
                                            Join Class
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            title="Subject Chat"
                                            onClick={() => navigate(`/subjects/${cls.subjectId}/chat`)}
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Activity */}
                <TabsContent value="activity" className="mt-4">
                    {loading ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {statItems.map(({ label, value, icon: Icon }) => (
                                    <Card key={label}>
                                        <CardContent className="p-4 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                <Icon className="h-4 w-4" />
                                                <span>{label}</span>
                                            </div>
                                            <p className="text-3xl font-bold">{value}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            {recentEvents.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y">
                                            {recentEvents.map((e: any) => (
                                                <div key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                                                    <span className="font-medium capitalize">{e.eventType?.replace('student.', '').replace('.', ' ')}</span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {new Date(e.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            {!analytics && !loading && (
                                <p className="text-center text-muted-foreground py-10">No activity data yet. Start using the platform!</p>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* Payments */}
                <TabsContent value="payments" className="mt-4">
                    {loading ? (
                        <Skeleton className="h-48 w-full" />
                    ) : payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
                            <DollarSign className="h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground">No payment records yet.</p>
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="border-b bg-muted/40">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-medium">Subject</th>
                                                <th className="text-left px-4 py-3 font-medium">Class</th>
                                                <th className="text-left px-4 py-3 font-medium">Amount</th>
                                                <th className="text-left px-4 py-3 font-medium">Status</th>
                                                <th className="text-left px-4 py-3 font-medium">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {payments.map(p => (
                                                <tr key={p.id}>
                                                    <td className="px-4 py-3">{p.subject?.name ?? '—'}</td>
                                                    <td className="px-4 py-3">{p.class?.name ?? '—'}</td>
                                                    <td className="px-4 py-3 font-medium">{formatCurrency(p.amount)}</td>
                                                    <td className="px-4 py-3">{paymentBadge(p.status)}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Join Class Dialog */}
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Join a Class</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Class ID</label>
                            <Input
                                placeholder="Enter class ID"
                                value={joinClassId}
                                onChange={e => setJoinClassId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Invite Code (optional)</label>
                            <Input
                                placeholder="Enter invite code"
                                value={inviteCode}
                                onChange={e => setInviteCode(e.target.value)}
                            />
                        </div>
                        {joinError && <p className="text-sm text-destructive">{joinError}</p>}
                        <Button onClick={handleJoin} disabled={joining}>
                            {joining ? 'Joining...' : 'Join Class'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
