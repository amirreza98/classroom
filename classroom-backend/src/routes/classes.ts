import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { classes, departments, subjects } from '../db/schema/app.js';
import { user } from '../db/schema/auth.js';
import { producer } from '../kafka.js'

const router = express.Router();

// GET /classes - list with search, filter, pagination
router.get("/", async (req, res) => {
    try {
        const { search, subject, teacher, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(classes.name, `%${search}%`),
                    ilike(classes.inviteCode, `%${search}%`)
                )
            );
        }

        if (subject) {
            const subjectPattern = `%${String(subject).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(subjects.name, subjectPattern));
        }

        if (teacher) {
            const teacherPattern = `%${String(teacher).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(user.name, teacherPattern));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const classesList = await db
            .select({
                ...getTableColumns(classes),
                subject: { ...getTableColumns(subjects) },
                teacher: { ...getTableColumns(user) }
            })
            .from(classes)
            .leftJoin(subjects, eq(classes.subjectId, subjects.id))
            .leftJoin(user, eq(classes.teacherId, user.id))
            .where(whereClause)
            .orderBy(desc(classes.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: classesList,
            pagination: {
                page: currentPage, limit: limitPerPage, total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (e) {
        console.error(`GET /classes error: ${e}`);
        res.status(500).json({ error: 'Failed to get classes' });
    }
});

// GET /classes/:id
router.get('/:id', async (req, res) => {
    const classId = Number(req.params.id);

    if (!Number.isFinite(classId)) return res.status(400).json({ error: 'No Class found.' });

    const [classDetails] = await db
        .select({
            ...getTableColumns(classes),
            subject: { ...getTableColumns(subjects) },
            department: { ...getTableColumns(departments) },
            teacher: { ...getTableColumns(user) }
        })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(user, eq(classes.teacherId, user.id))
        .leftJoin(departments, eq(subjects.departmentId, departments.id))
        .where(eq(classes.id, classId));

    if (!classDetails) return res.status(404).json({ error: 'No Class found.' });

    res.status(200).json({ data: classDetails });
});

// POST /classes
router.post('/', async (req, res) => {
    try {
        const [createdClass] = await db
            .insert(classes)
            .values({ ...req.body, inviteCode: Math.random().toString(36).substring(2, 9), schedules: [] })
            .returning({ id: classes.id });

        if (!createdClass) throw Error;

        res.status(201).json({ data: createdClass });

        // fire and forget — don't let Kafka failure affect the response
        try {
            await producer.send({
                topic: 'student.actions',
                messages: [{
                    value: JSON.stringify({
                        event: 'class.created',
                        classId: createdClass.id,
                        timestamp: new Date().toISOString()
                    })
                }]
            });
            console.log('Event published: class.created');
        } catch (kafkaError) {
            console.error('Kafka publish failed:', kafkaError);
        }

    } catch (e) {
        console.error(`POST /classes error ${e}`);
        res.status(500).json({ error: e });
    }
});

// PUT /classes/:id
router.put('/:id', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID' });

        const { name, description, subjectId, teacherId, capacity, status, bannerUrl, bannerCldPubId } = req.body;

        const [updated] = await db
            .update(classes)
            .set({
                name,
                description,
                subjectId: subjectId ? Number(subjectId) : undefined,
                teacherId,
                capacity: capacity ? Number(capacity) : undefined,
                status,
                bannerUrl,
                bannerCldPubId,
            })
            .where(eq(classes.id, classId))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Class not found' });

        res.status(200).json({ data: updated });
    } catch (e) {
        console.error(`PUT /classes/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to update class' });
    }
});

// DELETE /classes/:id
router.delete('/:id', async (req, res) => {
    try {
        const classId = Number(req.params.id);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID' });

        const [deleted] = await db
            .delete(classes)
            .where(eq(classes.id, classId))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'Class not found' });

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /classes/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to delete class' });
    }
});

export default router;
