import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import express from "express";

import { user } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// GET /users - list with search, role filter, pagination
router.get("/", async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, Number.isFinite(+page) ? +page : 1);
        const limitPerPage = Math.max(1, Number.isFinite(+limit) ? +limit : 10);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`)
                )
            );
        }

        if (role) {
            filterConditions.push(eq(user.role, role as 'student' | 'teacher' | 'admin'));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count ?? 0);

        const usersList = await db
            .select()
            .from(user)
            .where(whereClause)
            .orderBy(desc(user.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: usersList,
            pagination: {
                page: currentPage, limit: limitPerPage, total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (e) {
        console.error(`GET /users error: ${e}`);
        res.status(500).json({ error: 'Failed to get the users' });
    }
});

// GET /users/:id
router.get("/:id", async (req, res) => {
    try {
        const userId = req.params.id;

        const [foundUser] = await db
            .select()
            .from(user)
            .where(eq(user.id, userId));

        if (!foundUser) return res.status(404).json({ error: 'User not found' });

        res.status(200).json({ data: foundUser });
    } catch (e) {
        console.error(`GET /users/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// PUT /users/:id
router.put("/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        const { name, email, role, image, imageCldPubId } = req.body;

        const [updated] = await db
            .update(user)
            .set({ name, email, role, image, imageCldPubId })
            .where(eq(user.id, userId))
            .returning();

        if (!updated) return res.status(404).json({ error: 'User not found' });

        res.status(200).json({ data: updated });
    } catch (e: any) {
        console.error(`PUT /users/:id error: ${e}`);
        if (e?.code === '23505') return res.status(409).json({ error: 'Email already in use' });
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /users/:id
router.delete("/:id", async (req, res) => {
    try {
        const userId = req.params.id;

        const [deleted] = await db
            .delete(user)
            .where(eq(user.id, userId))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'User not found' });

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /users/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
