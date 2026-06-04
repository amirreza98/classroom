import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import express from "express";

import { enrollments, classes, subjects, payments } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import { db } from "../db/index.js";
import { stripe } from "../config/stripe.js";
import { publishEvent } from "../kafka.js";

const router = express.Router();

// GET /enrollments?classId=X - get enrollments for a class with enrolled student info
router.get("/", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    // Students can only query their own enrollments
    const { classId, studentId, page = 1, limit = 50 } = req.query;
    if (req.user.role === 'student' && studentId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
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
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'student') return res.status(403).json({ error: 'Forbidden' });
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

// POST /enrollments/self-enroll - student self-enrollment with optional Stripe payment
router.post("/self-enroll", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can self-enroll' });
    try {
        const { classId, inviteCode } = req.body;
        if (!classId) return res.status(400).json({ error: 'classId is required' });

        // Fetch class with subject price
        const [classRecord] = await db
            .select({
                id: classes.id,
                name: classes.name,
                capacity: classes.capacity,
                inviteCode: classes.inviteCode,
                subjectId: classes.subjectId,
                subjectName: subjects.name,
                subjectPrice: subjects.price,
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .where(eq(classes.id, Number(classId)));

        if (!classRecord) return res.status(404).json({ error: 'Class not found' });
        if (inviteCode && classRecord.inviteCode !== inviteCode) {
            return res.status(403).json({ error: 'Invalid invite code' });
        }

        // Check capacity
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(enrollments)
            .where(eq(enrollments.classId, Number(classId)));
        if (Number(count) >= classRecord.capacity) {
            return res.status(409).json({ error: 'Class is at full capacity' });
        }

        const price = parseFloat(classRecord.subjectPrice ?? '0');

        if (price > 0) {
            // Paid enrollment — create Stripe Checkout session
            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        unit_amount: Math.round(price * 100),
                        product_data: { name: classRecord.subjectName ?? classRecord.name },
                    },
                    quantity: 1,
                }],
                success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
                metadata: { classId: String(classRecord.id), studentId: req.user.id, subjectId: String(classRecord.subjectId) },
            });

            const [enrollment] = await db
                .insert(enrollments)
                .values({ classId: Number(classId), studentId: req.user.id, paymentStatus: 'pending' })
                .returning();

            await db.insert(payments).values({
                enrollmentId: enrollment.id,
                studentId: req.user.id,
                stripeSessionId: session.id,
                amount: String(price),
                currency: 'usd',
                status: 'pending',
            });

            return res.status(200).json({ data: { requiresPayment: true, checkoutUrl: session.url } });
        }

        // Free enrollment
        const [enrollment] = await db
            .insert(enrollments)
            .values({ classId: Number(classId), studentId: req.user.id, paymentStatus: 'free' })
            .returning();

        publishEvent('student.actions', {
            event: 'student.enrolled',
            studentId: req.user.id,
            classId: classRecord.id,
            subjectId: classRecord.subjectId,
            timestamp: new Date().toISOString(),
        });

        res.status(201).json({ data: { requiresPayment: false, enrollment } });
    } catch (e: any) {
        console.error(`POST /enrollments/self-enroll error: ${e}`);
        if (e?.code === '23505') return res.status(409).json({ error: 'Already enrolled in this class' });
        res.status(500).json({ error: 'Failed to enroll' });
    }
});

// DELETE /enrollments/:id - unenroll a student
router.delete("/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'student') return res.status(403).json({ error: 'Forbidden' });
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
