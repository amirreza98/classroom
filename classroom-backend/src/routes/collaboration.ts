import express from 'express';
import { desc, eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { collaborativeFiles } from '../db/schema/app.js';

const router = express.Router();

// GET /api/collaboration/classes/:classId/files
router.get('/classes/:classId/files', async (req, res) => {
    try {
        const classId = Number(req.params.classId);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID' });

        const files = await db
            .select({
                id: collaborativeFiles.id,
                classId: collaborativeFiles.classId,
                name: collaborativeFiles.name,
                createdBy: collaborativeFiles.createdBy,
                createdAt: collaborativeFiles.createdAt,
                updatedAt: collaborativeFiles.updatedAt,
            })
            .from(collaborativeFiles)
            .where(eq(collaborativeFiles.classId, classId))
            .orderBy(desc(collaborativeFiles.createdAt));

        res.status(200).json({ data: files });
    } catch (e) {
        console.error(`GET /collaboration/classes/:classId/files error: ${e}`);
        res.status(500).json({ error: 'Failed to get files' });
    }
});

// POST /api/collaboration/classes/:classId/files
router.post('/classes/:classId/files', async (req, res) => {
    try {
        const classId = Number(req.params.classId);
        if (!Number.isFinite(classId)) return res.status(400).json({ error: 'Invalid class ID' });

        const { name, createdBy } = req.body;
        if (!name || !createdBy) return res.status(400).json({ error: 'name and createdBy are required' });

        const [created] = await db
            .insert(collaborativeFiles)
            .values({ classId, name, createdBy })
            .returning();

        if (!created) throw new Error('Insert returned no rows');

        res.status(201).json({ data: created });
    } catch (e) {
        console.error(`POST /collaboration/classes/:classId/files error: ${e}`);
        res.status(500).json({ error: 'Failed to create file' });
    }
});

// GET /api/collaboration/files/:fileId/state
router.get('/files/:fileId/state', async (req, res) => {
    try {
        const fileId = Number(req.params.fileId);
        if (!Number.isFinite(fileId)) return res.status(400).json({ error: 'Invalid file ID' });

        const [file] = await db
            .select({ yjsState: collaborativeFiles.yjsState })
            .from(collaborativeFiles)
            .where(eq(collaborativeFiles.id, fileId));

        if (!file) return res.status(404).json({ error: 'File not found' });

        if (!file.yjsState) {
            res.status(200).end();
            return;
        }

        res.status(200)
            .set('Content-Type', 'application/octet-stream')
            .send(file.yjsState);
    } catch (e) {
        console.error(`GET /collaboration/files/:fileId/state error: ${e}`);
        res.status(500).json({ error: 'Failed to get file state' });
    }
});

// PUT /api/collaboration/files/:fileId/state
router.put('/files/:fileId/state', express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
    try {
        const fileId = Number(req.params.fileId);
        if (!Number.isFinite(fileId)) return res.status(400).json({ error: 'Invalid file ID' });

        const yjsState = req.body as Buffer;

        const [updated] = await db
            .update(collaborativeFiles)
            .set({ yjsState })
            .where(eq(collaborativeFiles.id, fileId))
            .returning({ id: collaborativeFiles.id });

        if (!updated) return res.status(404).json({ error: 'File not found' });

        res.status(200).json({ data: updated });
    } catch (e) {
        console.error(`PUT /collaboration/files/:fileId/state error: ${e}`);
        res.status(500).json({ error: 'Failed to save file state' });
    }
});

// DELETE /api/collaboration/files/:fileId
router.delete('/files/:fileId', async (req, res) => {
    try {
        const fileId = Number(req.params.fileId);
        if (!Number.isFinite(fileId)) return res.status(400).json({ error: 'Invalid file ID' });

        const [deleted] = await db
            .delete(collaborativeFiles)
            .where(eq(collaborativeFiles.id, fileId))
            .returning();

        if (!deleted) return res.status(404).json({ error: 'File not found' });

        res.status(200).json({ data: deleted });
    } catch (e) {
        console.error(`DELETE /collaboration/files/:fileId error: ${e}`);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

export default router;
