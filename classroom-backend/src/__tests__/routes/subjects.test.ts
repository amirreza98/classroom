import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

import { chain } from '../helpers/chain.js';
import { ADMIN_HEADERS, TEACHER_HEADERS, STUDENT_HEADERS, subject, subject2 } from '../helpers/fixtures.js';

vi.mock('../../db/index.js', () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
}));

import { db } from '../../db/index.js';
import subjectsRouter from '../../routes/subjects.js';
import { createTestApp } from '../helpers/app.js';

const app = createTestApp('/api/subjects', subjectsRouter);

const sel = () => vi.mocked(db.select);
const ins = () => vi.mocked(db.insert);
const upd = () => vi.mocked(db.update);
const del = () => vi.mocked(db.delete);

beforeEach(() => {
    vi.clearAllMocks();
});

// ── GET /api/subjects ────────────────────────────────────────────────────────

describe('GET /api/subjects', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).get('/api/subjects');
        expect(res.status).toBe(401);
    });

    it('returns an empty list with correct pagination shape', async () => {
        sel().mockReturnValueOnce(chain([{ count: 0 }]));
        sel().mockReturnValueOnce(chain([]));

        const res = await request(app).get('/api/subjects').set(ADMIN_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.pagination).toMatchObject({ page: 1, total: 0 });
    });

    it('returns a paginated subject list with joined department data', async () => {
        const row = { ...subject, department: { id: 1, code: 'CS', name: 'Computer Science' } };
        sel().mockReturnValueOnce(chain([{ count: 1 }]));
        sel().mockReturnValueOnce(chain([row]));

        const res = await request(app).get('/api/subjects').set(TEACHER_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({ code: 'CS101', name: 'Intro to Programming' });
    });

    it('is accessible by all authenticated roles', async () => {
        for (const headers of [TEACHER_HEADERS, STUDENT_HEADERS]) {
            sel().mockReturnValueOnce(chain([{ count: 0 }]));
            sel().mockReturnValueOnce(chain([]));
            const res = await request(app).get('/api/subjects').set(headers);
            expect(res.status).toBe(200);
        }
    });
});

// ── GET /api/subjects/:id ────────────────────────────────────────────────────

describe('GET /api/subjects/:id', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).get('/api/subjects/10');
        expect(res.status).toBe(401);
    });

    it('returns 400 for a non-numeric id', async () => {
        const res = await request(app)
            .get('/api/subjects/invalid')
            .set(ADMIN_HEADERS);
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ error: 'Invalid subject ID' });
    });

    it('returns 404 when subject does not exist', async () => {
        sel().mockReturnValueOnce(chain([]));

        const res = await request(app)
            .get('/api/subjects/9999')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ error: 'Subject not found' });
    });

    it('returns the subject with its department when found', async () => {
        const row = { ...subject, department: { id: 1, code: 'CS' } };
        sel().mockReturnValueOnce(chain([row]));

        const res = await request(app)
            .get('/api/subjects/10')
            .set(STUDENT_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: 10, code: 'CS101' });
    });
});

// ── POST /api/subjects ───────────────────────────────────────────────────────

describe('POST /api/subjects', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).post('/api/subjects').send({ name: 'X', code: 'X', departmentId: 1 });
        expect(res.status).toBe(401);
    });

    it('returns 403 for teacher role', async () => {
        const res = await request(app)
            .post('/api/subjects')
            .set(TEACHER_HEADERS)
            .send({ name: 'X', code: 'X', departmentId: 1 });
        expect(res.status).toBe(403);
    });

    it('returns 403 for student role', async () => {
        const res = await request(app)
            .post('/api/subjects')
            .set(STUDENT_HEADERS)
            .send({ name: 'X', code: 'X', departmentId: 1 });
        expect(res.status).toBe(403);
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/api/subjects')
            .set(ADMIN_HEADERS)
            .send({ code: 'CS303', departmentId: 1 });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/required/i);
    });

    it('returns 400 when code is missing', async () => {
        const res = await request(app)
            .post('/api/subjects')
            .set(ADMIN_HEADERS)
            .send({ name: 'Algorithms', departmentId: 1 });
        expect(res.status).toBe(400);
    });

    it('returns 400 when departmentId is missing', async () => {
        const res = await request(app)
            .post('/api/subjects')
            .set(ADMIN_HEADERS)
            .send({ name: 'Algorithms', code: 'CS303' });
        expect(res.status).toBe(400);
    });

    it('returns 409 when subject code already exists', async () => {
        const pgUniqueError = Object.assign(new Error('unique'), { code: '23505' });
        ins().mockReturnValueOnce({
            values: () => ({ returning: () => Promise.reject(pgUniqueError) }),
        } as any);

        const res = await request(app)
            .post('/api/subjects')
            .set(ADMIN_HEADERS)
            .send({ name: 'Dup', code: 'CS101', departmentId: 1 });

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ error: 'Subject code already exists' });
    });

    it('creates a subject and returns 201 with price defaulting to 0', async () => {
        ins().mockReturnValueOnce(chain([subject]));

        const res = await request(app)
            .post('/api/subjects')
            .set(ADMIN_HEADERS)
            .send({ name: 'Intro to Programming', code: 'CS101', departmentId: 1 });

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ code: 'CS101', price: '0' });
    });

    it('creates a subject with a specified price', async () => {
        const paid = { ...subject2, id: 20 };
        ins().mockReturnValueOnce(chain([paid]));

        const res = await request(app)
            .post('/api/subjects')
            .set(ADMIN_HEADERS)
            .send({ name: 'Data Structures', code: 'CS201', departmentId: 1, price: 49.99 });

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ code: 'CS201' });
    });
});

// ── PUT /api/subjects/:id ────────────────────────────────────────────────────

describe('PUT /api/subjects/:id', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).put('/api/subjects/10').send({ name: 'New' });
        expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
        const res = await request(app)
            .put('/api/subjects/10')
            .set(TEACHER_HEADERS)
            .send({ name: 'New' });
        expect(res.status).toBe(403);
    });

    it('returns 400 for non-numeric id', async () => {
        const res = await request(app)
            .put('/api/subjects/abc')
            .set(ADMIN_HEADERS)
            .send({ name: 'New' });
        expect(res.status).toBe(400);
    });

    it('returns 404 when subject does not exist', async () => {
        upd().mockReturnValueOnce(chain([]));

        const res = await request(app)
            .put('/api/subjects/9999')
            .set(ADMIN_HEADERS)
            .send({ name: 'Ghost' });

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ error: 'Subject not found' });
    });

    it('returns 409 on duplicate code', async () => {
        const pgUniqueError = Object.assign(new Error('unique'), { code: '23505' });
        upd().mockReturnValueOnce({
            set: () => ({ where: () => ({ returning: () => Promise.reject(pgUniqueError) }) }),
        } as any);

        const res = await request(app)
            .put('/api/subjects/10')
            .set(ADMIN_HEADERS)
            .send({ code: 'CS201' });

        expect(res.status).toBe(409);
    });

    it('updates and returns the subject', async () => {
        const updated = { ...subject, name: 'Advanced Programming' };
        upd().mockReturnValueOnce(chain([updated]));

        const res = await request(app)
            .put('/api/subjects/10')
            .set(ADMIN_HEADERS)
            .send({ name: 'Advanced Programming' });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: 10, name: 'Advanced Programming' });
    });
});

// ── DELETE /api/subjects/:id ─────────────────────────────────────────────────

describe('DELETE /api/subjects/:id', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).delete('/api/subjects/10');
        expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
        const res = await request(app)
            .delete('/api/subjects/10')
            .set(TEACHER_HEADERS);
        expect(res.status).toBe(403);
    });

    it('returns 400 for non-numeric id', async () => {
        const res = await request(app)
            .delete('/api/subjects/xyz')
            .set(ADMIN_HEADERS);
        expect(res.status).toBe(400);
    });

    it('returns 409 when subject has classes (PG FK violation)', async () => {
        const pgFkError = Object.assign(new Error('fk violation'), { code: '23503' });
        del().mockReturnValueOnce({
            where: () => ({ returning: () => Promise.reject(pgFkError) }),
        } as any);

        const res = await request(app)
            .delete('/api/subjects/10')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ error: 'Cannot delete subject with existing classes' });
    });

    it('returns 404 when subject does not exist', async () => {
        del().mockReturnValueOnce(chain([]));

        const res = await request(app)
            .delete('/api/subjects/9999')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ error: 'Subject not found' });
    });

    it('deletes the subject and returns the deleted record', async () => {
        del().mockReturnValueOnce(chain([subject]));

        const res = await request(app)
            .delete('/api/subjects/10')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: 10, code: 'CS101' });
    });
});
