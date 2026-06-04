import { eq } from 'drizzle-orm';
import express from 'express';
import { enrollments, classes, subjects } from '../db/schema/index.js';
import { user } from '../db/schema/auth.js';
import { db } from '../db/index.js';

const router = express.Router();

// GET /student-dashboard/overview - enrolled classes with full details for the authenticated student
router.get('/overview', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const enrolledClasses = await db
            .select({
                enrollmentId: enrollments.id,
                paymentStatus: enrollments.paymentStatus,
                classId: classes.id,
                className: classes.name,
                classStatus: classes.status,
                classDescription: classes.description,
                classCapacity: classes.capacity,
                schedules: classes.schedules,
                subjectId: subjects.id,
                subjectName: subjects.name,
                subjectCode: subjects.code,
                subjectPrice: subjects.price,
                teacherName: user.name,
                teacherImage: user.image,
            })
            .from(enrollments)
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(eq(enrollments.studentId, req.user.id));

        res.status(200).json({ data: { enrolledClasses } });
    } catch (e) {
        console.error(`GET /student-dashboard/overview error: ${e}`);
        res.status(500).json({ error: 'Failed to get student dashboard data' });
    }
});

export default router;
