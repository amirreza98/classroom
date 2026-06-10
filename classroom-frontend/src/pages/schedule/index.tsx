import { useEffect, useState, useMemo } from "react";
import { authHeader } from "@/lib/token";
import { useNavigate } from "react-router";
import { useSession } from "@/lib/auth-client";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, CalendarDays, User, X } from "lucide-react";
import type { ClassDetails, Department, Enrollment, Subject } from "@/types";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL as string;

type ScheduleClass = ClassDetails & { enrollmentId?: number };

const statusVariant = (status: ClassDetails["status"]) =>
    status === "active" ? "default" : "secondary";

export default function SchedulePage() {
    const { data: session } = useSession();
    const navigate = useNavigate();
    const userRole = (session?.user as any)?.role as string | undefined;
    const [allClasses, setAllClasses] = useState<ScheduleClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Admin filter state
    const [departments, setDepartments] = useState<Department[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [filterDeptId, setFilterDeptId] = useState<number | null>(null);
    const [filterSubjectId, setFilterSubjectId] = useState<number | null>(null);

    useEffect(() => {
        if (!session?.user?.id) return;

        const fetchSchedule = async () => {
            setLoading(true);
            setError(null);
            try {
                const hdrs = await authHeader();
                if (userRole === 'admin') {
                    const res = await fetch(`${BASE_URL}classes?limit=100`, { headers: hdrs });
                    if (!res.ok) throw new Error("Failed to fetch classes");
                    const data: { data: ClassDetails[] } = await res.json();
                    setAllClasses(data.data ?? []);
                } else if (userRole === 'teacher') {
                    const res = await fetch(`${BASE_URL}classes?limit=100`, { headers: hdrs });
                    if (!res.ok) throw new Error("Failed to fetch classes");
                    const data: { data: ClassDetails[] } = await res.json();
                    setAllClasses((data.data ?? []).filter(c => c.teacherId === session.user.id));
                } else {
                    const enrollRes = await fetch(
                        `${BASE_URL}/enrollments?studentId=${session.user.id}`,
                        { headers: hdrs }
                    );
                    if (!enrollRes.ok) throw new Error("Failed to fetch enrollments");
                    const enrollData: { data: Enrollment[] } = await enrollRes.json();
                    const enrollments = enrollData.data ?? [];

                    const classResults = await Promise.all(
                        enrollments.map(async (enrollment) => {
                            const classRes = await fetch(
                                `${BASE_URL}classes/${enrollment.classId}`,
                                { headers: hdrs }
                            );
                            if (!classRes.ok) return null;
                            const classData: { data: ClassDetails } = await classRes.json();
                            return { ...classData.data, enrollmentId: enrollment.id } as ScheduleClass;
                        })
                    );
                    setAllClasses(classResults.filter((c): c is ScheduleClass => c !== null));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong");
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [session?.user?.id, userRole]);

    // Fetch departments + subjects for admin filter dropdowns
    useEffect(() => {
        if (userRole !== 'admin') return;
        const fetchMeta = async () => {
            const hdrs = await authHeader();
            const [deptRes, subjectRes] = await Promise.all([
                fetch(`${BASE_URL}departments?limit=100`, { headers: hdrs }),
                fetch(`${BASE_URL}subjects?limit=100`, { headers: hdrs }),
            ]);
            if (deptRes.ok) setDepartments((await deptRes.json()).data ?? []);
            if (subjectRes.ok) setSubjects((await subjectRes.json()).data ?? []);
        };
        fetchMeta();
    }, [userRole]);

    const subjectOptions = useMemo(
        () => filterDeptId !== null ? subjects.filter(s => s.departmentId === filterDeptId) : subjects,
        [subjects, filterDeptId]
    );

    const classes = useMemo(() => {
        if (userRole !== 'admin') return allClasses;
        if (filterSubjectId !== null) return allClasses.filter(c => c.subjectId === filterSubjectId);
        if (filterDeptId !== null) return allClasses.filter(c => c.subject?.departmentId === filterDeptId);
        return allClasses;
    }, [allClasses, userRole, filterDeptId, filterSubjectId]);

    const handleDeptChange = (val: string) => {
        setFilterDeptId(val === 'all' ? null : Number(val));
        setFilterSubjectId(null);
    };

    const handleSubjectChange = (val: string) => {
        setFilterSubjectId(val === 'all' ? null : Number(val));
    };

    const clearFilters = () => {
        setFilterDeptId(null);
        setFilterSubjectId(null);
    };

    const subtitle =
        userRole === 'admin' ? 'All classes in the system.' :
        userRole === 'teacher' ? 'Classes you are teaching.' :
        'Classes you are enrolled in.';

    const emptyMessage =
        userRole === 'admin' ? 'No classes match the selected filters.' :
        userRole === 'teacher' ? 'You are not assigned to any classes.' :
        'You are not enrolled in any classes. Ask your teacher for an invite code.';

    return (
        <ListView>
            <Breadcrumb />
            <h1 className="page-title">Schedules</h1>
            <div className="intro-row">
                <p className="text-muted-foreground">{subtitle}</p>
            </div>

            {userRole === 'admin' && !loading && (
                <div className="flex flex-wrap gap-3 items-center mt-2">
                    <Select value={filterDeptId?.toString() ?? 'all'} onValueChange={handleDeptChange}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map(d => (
                                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterSubjectId?.toString() ?? 'all'} onValueChange={handleSubjectChange}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Subjects</SelectItem>
                            {subjectOptions.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {(filterDeptId !== null || filterSubjectId !== null) && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="h-4 w-4 mr-1" />
                            Clear filters
                        </Button>
                    )}
                </div>
            )}

            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="flex flex-col">
                            <CardHeader>
                                <Skeleton className="h-5 w-3/4" />
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 flex-1">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-5 w-16 mt-1" />
                            </CardContent>
                            <CardFooter>
                                <Skeleton className="h-9 w-full" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {!loading && error && (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                    <p className="text-destructive font-medium">{error}</p>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                </div>
            )}

            {!loading && !error && classes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                    <CalendarDays className="h-12 w-12 text-muted-foreground" />
                    <p className="text-lg font-medium text-foreground">No classes yet</p>
                    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                </div>
            )}

            {!loading && !error && classes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {classes.map((cls) => (
                        <Card key={cls.id} className="flex flex-col border border-border shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-base leading-snug">{cls.name}</CardTitle>
                                    <Badge variant={statusVariant(cls.status)} className="shrink-0 capitalize">
                                        {cls.status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 flex-1 text-sm text-muted-foreground">
                                {cls.subject && (
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 shrink-0" />
                                        <span>{cls.subject.name}</span>
                                    </div>
                                )}
                                {cls.teacher && (
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 shrink-0" />
                                        <span>{cls.teacher.name}</span>
                                    </div>
                                )}
                                {Array.isArray(cls.schedules) && cls.schedules.length > 0 && (
                                    <div className="flex flex-col gap-1 mt-1">
                                        {cls.schedules.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <CalendarDays className="h-4 w-4 shrink-0" />
                                                <span>{s.day} · {s.startTime} - {s.endTime}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button
                                    className="w-full"
                                    disabled={cls.status !== "active"}
                                    onClick={() => navigate(`/schedule/class/${cls.id}`)}
                                >
                                    Join Class
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </ListView>
    );
}
