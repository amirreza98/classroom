import { desc, eq, sql } from 'drizzle-orm';
import express from 'express';
import { payments, enrollments, classes, subjects } from '../db/schema/index.js';
import { db } from '../db/index.js';

const router = express.Router();

// GET /payments/my - student's own payment history
router.get('/my', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const records = await db
            .select({
                id: payments.id,
                enrollmentId: payments.enrollmentId,
                studentId: payments.studentId,
                stripeSessionId: payments.stripeSessionId,
                amount: payments.amount,
                currency: payments.currency,
                status: payments.status,
                createdAt: payments.createdAt,
                class: { id: classes.id, name: classes.name },
                subject: { id: subjects.id, name: subjects.name, price: subjects.price },
            })
            .from(payments)
            .leftJoin(enrollments, eq(payments.enrollmentId, enrollments.id))
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .where(eq(payments.studentId, req.user.id))
            .orderBy(desc(payments.createdAt));

        res.status(200).json({ data: records });
    } catch (e) {
        console.error(`GET /payments/my error: ${e}`);
        res.status(500).json({ error: 'Failed to get payment records' });
    }
});

// GET /payments - admin: all payments with pagination
router.get('/', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { page = 1, limit = 20 } = req.query;
        const currentPage = Math.max(1, Number(page));
        const limitPerPage = Math.min(Math.max(1, Number(limit)), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(payments);
        const records = await db
            .select({
                id: payments.id,
                studentId: payments.studentId,
                amount: payments.amount,
                currency: payments.currency,
                status: payments.status,
                createdAt: payments.createdAt,
                class: { id: classes.id, name: classes.name },
                subject: { id: subjects.id, name: subjects.name },
            })
            .from(payments)
            .leftJoin(enrollments, eq(payments.enrollmentId, enrollments.id))
            .leftJoin(classes, eq(enrollments.classId, classes.id))
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .orderBy(desc(payments.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: records,
            pagination: { page: currentPage, limit: limitPerPage, total: Number(count), totalPages: Math.ceil(Number(count) / limitPerPage) },
        });
    } catch (e) {
        console.error(`GET /payments error: ${e}`);
        res.status(500).json({ error: 'Failed to get payments' });
    }
});

export default router;
