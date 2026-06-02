import { and, desc, eq, ilike, sql } from "drizzle-orm";
import express from "express";

import { departments, subjects } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// GET /departments - list with search + pagination
router.get("/", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, Number.isFinite(+page) ? +page : 1);
        const limitPerPage = Math.min(Math.max(1, Number.isFinite(+limit) ? +limit : 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        if (search) {
            filterConditions.push(
                ilike(departments.name, `%${search}%`)
            );
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count ?? 0);

        const departmentsList = await db
            .select()
            .from(departments)
            .where(whereClause)
            .orderBy(desc(departments.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: departmentsList,
            pagination: {
                page: currentPage, limit: limitPerPage, total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (e) {
        console.error(`GET /departments error: ${e}`);
        res.status(500).json({ error: 'Failed to get departments' });
    }
});

// GET /departments/:id
router.get("/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const departmentId = Number(req.params.id);
        if (!Number.isFinite(departmentId)) return res.status(400).json({ error: 'Invalid department ID' });

        const [department] = await db
            .select()
            .from(departments)
            .where(eq(departments.id, departmentId));

        if (!department) return res.status(404).json({ error: 'Department not found' });

        res.status(200).json({ data: department });
    } catch (e) {
        console.error(`GET /departments/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to get department' });
    }
});

// POST /departments
router.post("/", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const { code, name, description } = req.body;
        if (!code || !name) return res.status(400).json({ error: 'Code and name are required' });

        const [created] = await db
            .insert(departments)
            .values({ code, name, description })
            .returning();

        res.status(201).json({ data: created });
    } catch (e: any) {
        console.error(`POST /departments error: ${e}`);
        if (e?.code === '23505') return res.status(409).json({ error: 'Department code already exists' });
        res.status(500).json({ error: 'Failed to create department' });
    }
});

// PUT /departments/:id
router.put("/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const departmentId = Number(req.params.id);
        if (!Number.isFinite(departmentId)) return res.status(400).json({ error: 'Invalid department ID' });

        const { code, name, description } = req.body;

        const [updated] = await db
            .update(departments)
            .set({ code, name, description })
            .where(eq(departments.id, departmentId))
            .returning();

        if (!updated) return res.status(404).json({ error: 'Department not found' });

        res.status(200).json({ data: updated });
    } catch (e: any) {
        console.error(`PUT /departments/:id error: ${e}`);
        if (e?.code === '23505') return res.status(409).json({ error: 'Department code already exists' });
        res.status(500).json({ error: 'Failed to update department' });
    }
});

// DELETE /departments/:id
router.delete("/:id", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const departmentId = Number(req.params.id);
        if (!Number.isFinite(departmentId)) return res.status(400).json({ error: 'Invalid department ID' });

        // Check if department has subjects
        const subjectCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(subjects)
            .where(eq(subjects.departmentId, departmentId));

        if (Number(subjectCount[0]?.count) > 0) {
            return res.status(409).json({ error: 'Cannot delete department with existing subjects' });
        }

        const [deleted] = await db
            .delete(departments)
            .where(eq(departments.id, departmentId))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'Department not found' });

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /departments/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to delete department' });
    }
});

export default router;
