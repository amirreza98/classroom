import { and, desc, eq, gt, lt, sql } from 'drizzle-orm';
import express from 'express';
import { subjectChatMessages, enrollments, classes } from '../db/schema/index.js';
import { user } from '../db/schema/auth.js';
import { db } from '../db/index.js';

const router = express.Router();

async function canAccessSubjectChat(userId: string, role: string, subjectId: number): Promise<boolean> {
    if (role === 'admin' || role === 'teacher') return true;
    const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(enrollments)
        .leftJoin(classes, eq(enrollments.classId, classes.id))
        .where(and(eq(enrollments.studentId, userId), eq(classes.subjectId, subjectId)));
    return Number(row?.count ?? 0) > 0;
}

// GET /chat/subjects/:subjectId/messages
router.get('/subjects/:subjectId/messages', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const subjectId = Number(req.params.subjectId);
    if (!Number.isFinite(subjectId)) return res.status(400).json({ error: 'Invalid subject ID' });

    const allowed = await canAccessSubjectChat(req.user.id, req.user.role, subjectId);
    if (!allowed) return res.status(403).json({ error: 'Not enrolled in this subject' });

    try {
        const { limit = 50, before } = req.query;
        const limitNum = Math.min(Math.max(1, Number(limit)), 100);

        const whereClause = before
            ? and(eq(subjectChatMessages.subjectId, subjectId), lt(subjectChatMessages.createdAt, new Date(String(before))))
            : eq(subjectChatMessages.subjectId, subjectId);

        const messages = await db
            .select({
                id: subjectChatMessages.id,
                subjectId: subjectChatMessages.subjectId,
                userId: subjectChatMessages.userId,
                content: subjectChatMessages.content,
                createdAt: subjectChatMessages.createdAt,
                userName: user.name,
                userImage: user.image,
            })
            .from(subjectChatMessages)
            .leftJoin(user, eq(subjectChatMessages.userId, user.id))
            .where(whereClause)
            .orderBy(desc(subjectChatMessages.createdAt))
            .limit(limitNum);

        res.status(200).json({ data: messages.reverse() });
    } catch (e) {
        console.error(`GET /chat/subjects/:subjectId/messages error: ${e}`);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// POST /chat/subjects/:subjectId/messages
router.post('/subjects/:subjectId/messages', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const subjectId = Number(req.params.subjectId);
    if (!Number.isFinite(subjectId)) return res.status(400).json({ error: 'Invalid subject ID' });

    const allowed = await canAccessSubjectChat(req.user.id, req.user.role, subjectId);
    if (!allowed) return res.status(403).json({ error: 'Not enrolled in this subject' });

    try {
        const { content } = req.body;
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ error: 'content is required' });
        }
        if (content.length > 2000) {
            return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
        }

        const [message] = await db
            .insert(subjectChatMessages)
            .values({ subjectId, userId: req.user.id, content: content.trim() })
            .returning();

        const [sender] = await db.select({ name: user.name, image: user.image }).from(user).where(eq(user.id, req.user.id));

        res.status(201).json({ data: { ...message, userName: sender?.name, userImage: sender?.image } });
    } catch (e) {
        console.error(`POST /chat/subjects/:subjectId/messages error: ${e}`);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

export default router;
