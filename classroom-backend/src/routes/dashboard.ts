import { count, eq, sql, desc } from "drizzle-orm";
import express from "express";

import { departments, subjects, classes, enrollments } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import { db } from "../db/index.js";

const router = express.Router();

// GET /dashboard/stats - overview counts
router.get("/stats", async (req, res) => {
    try {
        const [[userCount], [classCount], [subjectCount], [departmentCount], [enrollmentCount]] = await Promise.all([
            db.select({ count: count() }).from(user),
            db.select({ count: count() }).from(classes),
            db.select({ count: count() }).from(subjects),
            db.select({ count: count() }).from(departments),
            db.select({ count: count() }).from(enrollments),
        ]);

        // Active classes count
        const [activeClassCount] = await db
            .select({ count: count() })
            .from(classes)
            .where(eq(classes.status, 'active'));

        // Students count
        const [studentCount] = await db
            .select({ count: count() })
            .from(user)
            .where(eq(user.role, 'student'));

        const [teacherCount] = await db
            .select({ count: count() })
            .from(user)
            .where(eq(user.role, 'teacher'));

        res.status(200).json({
            data: {
                totalUsers: Number(userCount?.count ?? 0),
                totalClasses: Number(classCount?.count ?? 0),
                totalSubjects: Number(subjectCount?.count ?? 0),
                totalDepartments: Number(departmentCount?.count ?? 0),
                totalEnrollments: Number(enrollmentCount?.count ?? 0),
                activeClasses: Number(activeClassCount?.count ?? 0),
                totalStudents: Number(studentCount?.count ?? 0),
                totalTeachers: Number(teacherCount?.count ?? 0),
            }
        });
    } catch (e) {
        console.error(`GET /dashboard/stats error: ${e}`);
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
});

// GET /dashboard/charts - data for all charts
router.get("/charts", async (req, res) => {
    try {
        // 1. Enrollment trends - enrollments per month (last 6 months)
        const enrollmentTrends = await db.execute(sql`
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
                DATE_TRUNC('month', created_at) as month_date,
                COUNT(*) as count
            FROM enrollments
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month_date ASC
        `);

        // 2. Classes by department
        const classesByDept = await db.execute(sql`
            SELECT
                d.name as department,
                COUNT(c.id) as count
            FROM departments d
            LEFT JOIN subjects s ON s.department_id = d.id
            LEFT JOIN classes c ON c.subject_id = s.id
            GROUP BY d.id, d.name
            ORDER BY count DESC
            LIMIT 8
        `);

        // 3. Capacity status - classes grouped by fill percentage
        const capacityData = await db.execute(sql`
            SELECT
                CASE
                    WHEN enrolled_count = 0 THEN 'Empty'
                    WHEN enrolled_count::float / capacity < 0.5 THEN 'Low (<50%)'
                    WHEN enrolled_count::float / capacity < 0.8 THEN 'Medium (50-80%)'
                    WHEN enrolled_count::float / capacity < 1.0 THEN 'High (80-99%)'
                    ELSE 'Full'
                END as status,
                COUNT(*) as count
            FROM (
                SELECT c.id, c.capacity, COUNT(e.id) as enrolled_count
                FROM classes c
                LEFT JOIN enrollments e ON e.class_id = c.id
                GROUP BY c.id, c.capacity
            ) sub
            GROUP BY status
            ORDER BY count DESC
        `);

        // 4. User distribution by role
        const userDistribution = await db.execute(sql`
            SELECT role, COUNT(*) as count
            FROM "user"
            GROUP BY role
        `);

        // 5. Recent activity (recent enrollments)
        const recentActivity = await db
            .select({
                id: enrollments.id,
                createdAt: enrollments.createdAt,
                studentName: user.name,
                studentEmail: user.email,
                className: classes.name,
            })
            .from(enrollments)
            .leftJoin(user, eq(enrollments.studentId, user.id))
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .orderBy(desc(enrollments.createdAt))
            .limit(10);

        res.status(200).json({
            data: {
                enrollmentTrends: enrollmentTrends.rows.map(r => ({
                    month: r.month,
                    count: Number(r.count),
                })),
                classesByDepartment: classesByDept.rows.map(r => ({
                    department: r.department,
                    count: Number(r.count),
                })),
                capacityStatus: capacityData.rows.map(r => ({
                    status: r.status,
                    count: Number(r.count),
                })),
                userDistribution: userDistribution.rows.map(r => ({
                    role: r.role,
                    count: Number(r.count),
                })),
                recentActivity,
            }
        });
    } catch (e) {
        console.error(`GET /dashboard/charts error: ${e}`);
        res.status(500).json({ error: 'Failed to get chart data' });
    }
});

export default router;
