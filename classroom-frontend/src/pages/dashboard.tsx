import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
    Users, BookOpen, GraduationCap, Building2,
    TrendingUp, UserCheck, Activity, AlertCircle
} from "lucide-react";
import { BACKEND_BASE_URL } from "@/constants";
import { DashboardStats, ChartDataPoint } from "@/types";

const PIE_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444"];
const ROLE_COLORS: Record<string, string> = {
    admin: "#f97316",
    teacher: "#3b82f6",
    student: "#22c55e",
};

type ActivityItem = {
    id: number;
    studentName: string;
    studentEmail: string;
    className: string;
    createdAt: string;
};

type ChartData = {
    enrollmentTrends: ChartDataPoint[];
    classesByDepartment: ChartDataPoint[];
    capacityStatus: ChartDataPoint[];
    userDistribution: ChartDataPoint[];
    recentActivity: ActivityItem[];
};

const StatCard = ({
    title, value, icon: Icon, subtitle, color = "text-foreground"
}: {
    title: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    subtitle?: string;
    color?: string;
}) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className={`h-5 w-5 ${color}`} />
        </CardHeader>
        <CardContent>
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </CardContent>
    </Card>
);

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [charts, setCharts] = useState<ChartData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [statsRes, chartsRes] = await Promise.all([
                    fetch(`${BACKEND_BASE_URL}dashboard/stats`, { credentials: "include" }),
                    fetch(`${BACKEND_BASE_URL}dashboard/charts`, { credentials: "include" }),
                ]);

                if (!statsRes.ok || !chartsRes.ok) throw new Error("Failed to fetch dashboard data");

                const statsJson = await statsRes.json();
                const chartsJson = await chartsRes.json();

                setStats(statsJson.data);
                setCharts(chartsJson.data);
            } catch (e) {
                console.error(e);
                setError("Failed to load dashboard data");
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader className="pb-2">
                                <div className="h-4 bg-muted rounded w-24" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 bg-muted rounded w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <Card className="border-destructive">
                    <CardContent className="pt-6 flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground mt-1">Overview of your classroom management system</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Users"
                    value={stats?.totalUsers ?? 0}
                    icon={Users}
                    subtitle={`${stats?.totalStudents ?? 0} students · ${stats?.totalTeachers ?? 0} teachers`}
                    color="text-blue-500"
                />
                <StatCard
                    title="Total Classes"
                    value={stats?.totalClasses ?? 0}
                    icon={GraduationCap}
                    subtitle={`${stats?.activeClasses ?? 0} active`}
                    color="text-orange-500"
                />
                <StatCard
                    title="Total Subjects"
                    value={stats?.totalSubjects ?? 0}
                    icon={BookOpen}
                    color="text-green-500"
                />
                <StatCard
                    title="Departments"
                    value={stats?.totalDepartments ?? 0}
                    icon={Building2}
                    color="text-purple-500"
                />
                <StatCard
                    title="Total Enrollments"
                    value={stats?.totalEnrollments ?? 0}
                    icon={UserCheck}
                    color="text-pink-500"
                />
                <StatCard
                    title="Active Classes"
                    value={stats?.activeClasses ?? 0}
                    icon={Activity}
                    subtitle="Currently running"
                    color="text-emerald-500"
                />
                <StatCard
                    title="Students"
                    value={stats?.totalStudents ?? 0}
                    icon={Users}
                    color="text-cyan-500"
                />
                <StatCard
                    title="Teachers"
                    value={stats?.totalTeachers ?? 0}
                    icon={TrendingUp}
                    color="text-amber-500"
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Enrollment Trends (Last 6 Months)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {charts?.enrollmentTrends && charts.enrollmentTrends.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={charts.enrollmentTrends}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316" }} name="Enrollments" />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No enrollment data available</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Classes by Department</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {charts?.classesByDepartment && charts.classesByDepartment.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={charts.classesByDepartment}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                    <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3b82f6" name="Classes" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No department data available</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Class Capacity Status</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        {charts?.capacityStatus && charts.capacityStatus.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={charts.capacityStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                        {charts.capacityStatus.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No capacity data available</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">User Distribution by Role</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {charts?.userDistribution && charts.userDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={charts.userDistribution} dataKey="count" nameKey="role" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label={({ role, count }) => `${role}: ${count}`}>
                                        {charts.userDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={ROLE_COLORS[entry.role as string] ?? PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No user data available</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Activity Feed */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Enrollments
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {charts?.recentActivity && charts.recentActivity.length > 0 ? (
                        <div className="space-y-3">
                            {charts.recentActivity.map((item) => (
                                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                            {item.studentName?.charAt(0)?.toUpperCase() ?? "?"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{item.studentName}</p>
                                            <p className="text-xs text-muted-foreground">{item.studentEmail}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant="secondary" className="text-xs">{item.className}</Badge>
                                        <p className="text-xs text-muted-foreground mt-1">{new Date(item.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
