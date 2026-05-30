import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import express from "express";

import { enrollments, classes } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import { db } from "../db/index.js";

const router = express.Router();

// GET /enrollments?classId=X - get enrollments for a class with enrolled student info
router.get("/", async (req, res) => {
    try {
        const { classId, studentId, page = 1, limit = 50 } = req.query;

        if (!classId && !studentId) return res.status(400).json({ error: 'classId or studentId query parameter is required' });

        const currentPage = Math.max(1, Number.isFinite(+page) ? +page : 1);
        const limitPerPage = Math.min(Math.max(1, Number.isFinite(+limit) ? +limit : 50), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const whereClause = classId && studentId
            ? and(eq(enrollments.classId, Number(classId)), eq(enrollments.studentId, String(studentId)))
            : classId
            ? eq(enrollments.classId, Number(classId))
            : eq(enrollments.studentId, String(studentId));

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count ?? 0);

        const enrollmentsList = await db
            .select({
                ...getTableColumns(enrollments),
                student: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    role: user.role,
                }
            })
            .from(enrollments)
            .leftJoin(user, eq(enrollments.studentId, user.id))
            .where(whereClause)
            .orderBy(desc(enrollments.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: enrollmentsList,
            pagination: {
                page: currentPage, limit: limitPerPage, total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (e) {
        console.error(`GET /enrollments error: ${e}`);
        res.status(500).json({ error: 'Failed to get enrollments' });
    }
});

// POST /enrollments - enroll a student
router.post("/", async (req, res) => {
    try {
        const { classId, studentId } = req.body;

        if (!classId || !studentId) {
            return res.status(400).json({ error: 'classId and studentId are required' });
        }

        // Check class capacity
        const [classRecord] = await db
            .select({ capacity: classes.capacity })
            .from(classes)
            .where(eq(classes.id, Number(classId)));

        if (!classRecord) return res.status(404).json({ error: 'Class not found' });

        const enrolledCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(eq(enrollments.classId, Number(classId)));

        if (Number(enrolledCount[0]?.count) >= classRecord.capacity) {
            return res.status(409).json({ error: 'Class is at full capacity' });
        }

        const [created] = await db
            .insert(enrollments)
            .values({ classId: Number(classId), studentId })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        console.error(`POST /enrollments error: ${e}`);
        if (e?.code === '23505') return res.status(409).json({ error: 'Student is already enrolled in this class' });
        res.status(500).json({ error: 'Failed to enroll student' });
    }
});

// DELETE /enrollments/:id - unenroll a student
router.delete("/:id", async (req, res) => {
    try {
        const enrollmentId = Number(req.params.id);
        if (!Number.isFinite(enrollmentId)) return res.status(400).json({ error: 'Invalid enrollment ID' });

        const [deleted] = await db
            .delete(enrollments)
            .where(eq(enrollments.id, enrollmentId))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'Enrollment not found' });

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /enrollments/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to delete enrollment' });
    }
});

export default router;
