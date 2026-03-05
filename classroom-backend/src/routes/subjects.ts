import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";

import { subjects, departments } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// GET /subjects - list with search + pagination
router.get("/", async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, Number.isFinite(+page) ? +page : 1);
        const limitPerPage = Math.max(1, Number.isFinite(+limit) ? +limit : 10);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(subjects.name, `%${search}%`),
                    ilike(subjects.code, `%${search}%`)
                )
            );
        }
        if (department) {
            const deptPattern = `%${String(department).replace(/[%_]/g, '\\$&')}%`;
            filterConditions.push(ilike(departments.name, deptPattern));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count ?? 0);

        const subjectsList = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments) }
            })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(subjects.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: subjectsList,
            pagination: {
                page: currentPage, limit: limitPerPage, total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (e) {
        console.error(`GET /subjects error: ${e}`);
        res.status(500).json({ error: 'Failed to get the subjects' });
    }
});

// GET /subjects/:id
router.get("/:id", async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) return res.status(400).json({ error: 'Invalid subject ID' });

        const [subject] = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments) }
            })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(eq(subjects.id, subjectId));

        if (!subject) return res.status(404).json({ error: 'Subject not found' });

        res.status(200).json({ data: subject });
    } catch (e) {
        console.error(`GET /subjects/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to get subject' });
    }
});

// POST /subjects
router.post("/", async (req, res) => {
    try {
        const { name, code, description, departmentId } = req.body;
        if (!name || !code || !departmentId) {
            return res.status(400).json({ error: 'name, code, and departmentId are required' });
        }

        const [created] = await db
            .insert(subjects)
            .values({ name, code, description, departmentId: Number(departmentId) })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        console.error(`POST /subjects error: ${e}`);
        if (e?.code === '23505') return res.status(409).json({ error: 'Subject code already exists' });
        res.status(500).json({ error: 'Failed to create subject' });
    }
});

// PUT /subjects/:id
router.put("/:id", async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) return res.status(400).json({ error: 'Invalid subject ID' });

        const { name, code, description, departmentId } = req.body;

        const [updated] = await db
            .update(subjects)
            .set({
                name,
                code,
                description,
                departmentId: departmentId ? Number(departmentId) : undefined,
            })
            .where(eq(subjects.id, subjectId))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Subject not found' });

        res.status(200).json({ data: updated });
    } catch (e: any) {
        console.error(`PUT /subjects/:id error: ${e}`);
        if (e?.code === '23505') return res.status(409).json({ error: 'Subject code already exists' });
        res.status(500).json({ error: 'Failed to update subject' });
    }
});

// DELETE /subjects/:id
router.delete("/:id", async (req, res) => {
    try {
        const subjectId = Number(req.params.id);
        if (!Number.isFinite(subjectId)) return res.status(400).json({ error: 'Invalid subject ID' });

        const [deleted] = await db
            .delete(subjects)
            .where(eq(subjects.id, subjectId))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'Subject not found' });

        res.status(200).json({ data: deleted });
    } catch (e: any) {
        console.error(`DELETE /subjects/:id error: ${e}`);
        if (e?.code === '23503') return res.status(409).json({ error: 'Cannot delete subject with existing classes' });
        res.status(500).json({ error: 'Failed to delete subject' });
    }
});

export default router;
