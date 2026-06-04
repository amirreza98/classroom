import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

import { chain } from '../helpers/chain.js';
import { ADMIN_HEADERS, TEACHER_HEADERS, STUDENT_HEADERS, department, department2 } from '../helpers/fixtures.js';

// Must be declared before imports so vitest hoisting can intercept the module
vi.mock('../../db/index.js', () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
}));

// Dynamic import after mock is registered
import { db } from '../../db/index.js';
import departmentsRouter from '../../routes/departments.js';
import { createTestApp } from '../helpers/app.js';

const app = createTestApp('/api/departments', departmentsRouter);

const sel = () => vi.mocked(db.select);
const ins = () => vi.mocked(db.insert);
const upd = () => vi.mocked(db.update);
const del = () => vi.mocked(db.delete);

beforeEach(() => {
    vi.clearAllMocks();
});

// ── GET /api/departments ─────────────────────────────────────────────────────

describe('GET /api/departments', () => {
    it('returns 401 when no auth headers are present', async () => {
        const res = await request(app).get('/api/departments');
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ error: 'Unauthorized' });
    });

    it('returns an empty list when no departments exist', async () => {
        sel().mockReturnValueOnce(chain([{ count: 0 }]));
        sel().mockReturnValueOnce(chain([]));

        const res = await request(app)
            .get('/api/departments')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.pagination).toMatchObject({ page: 1, total: 0, totalPages: 0 });
    });

    it('returns paginated list with correct metadata', async () => {
        sel().mockReturnValueOnce(chain([{ count: 2 }]));
        sel().mockReturnValueOnce(chain([department, department2]));

        const res = await request(app)
            .get('/api/departments?page=1&limit=10')
            .set(TEACHER_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0]).toMatchObject({ code: 'CS', name: 'Computer Science' });
        expect(res.body.pagination).toMatchObject({
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
        });
    });

    it('clamps page to 1 for invalid page query param', async () => {
        sel().mockReturnValueOnce(chain([{ count: 1 }]));
        sel().mockReturnValueOnce(chain([department]));

        const res = await request(app)
            .get('/api/departments?page=-5')
            .set(STUDENT_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(1);
    });

    it('is accessible to all authenticated roles (teacher, student)', async () => {
        for (const headers of [TEACHER_HEADERS, STUDENT_HEADERS]) {
            sel().mockReturnValueOnce(chain([{ count: 0 }]));
            sel().mockReturnValueOnce(chain([]));

            const res = await request(app).get('/api/departments').set(headers);
            expect(res.status).toBe(200);
        }
    });
});

// ── GET /api/departments/:id ─────────────────────────────────────────────────

describe('GET /api/departments/:id', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).get('/api/departments/1');
        expect(res.status).toBe(401);
    });

    it('returns 400 for a non-numeric id', async () => {
        const res = await request(app)
            .get('/api/departments/abc')
            .set(ADMIN_HEADERS);
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ error: 'Invalid department ID' });
    });

    it('returns 404 when department does not exist', async () => {
        sel().mockReturnValueOnce(chain([]));

        const res = await request(app)
            .get('/api/departments/999')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ error: 'Department not found' });
    });

    it('returns the department when found', async () => {
        sel().mockReturnValueOnce(chain([department]));

        const res = await request(app)
            .get('/api/departments/1')
            .set(TEACHER_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: 1, code: 'CS', name: 'Computer Science' });
    });
});

// ── POST /api/departments ────────────────────────────────────────────────────

describe('POST /api/departments', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).post('/api/departments').send({ code: 'X', name: 'X' });
        expect(res.status).toBe(401);
    });

    it('returns 403 for teacher role', async () => {
        const res = await request(app)
            .post('/api/departments')
            .set(TEACHER_HEADERS)
            .send({ code: 'X', name: 'X' });
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ error: 'Forbidden' });
    });

    it('returns 403 for student role', async () => {
        const res = await request(app)
            .post('/api/departments')
            .set(STUDENT_HEADERS)
            .send({ code: 'X', name: 'X' });
        expect(res.status).toBe(403);
    });

    it('returns 400 when code is missing', async () => {
        const res = await request(app)
            .post('/api/departments')
            .set(ADMIN_HEADERS)
            .send({ name: 'No Code Dept' });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ error: 'Code and name are required' });
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app)
            .post('/api/departments')
            .set(ADMIN_HEADERS)
            .send({ code: 'X' });
        expect(res.status).toBe(400);
    });

    it('returns 409 when department code already exists (PG unique violation)', async () => {
        const pgUniqueError = Object.assign(new Error('unique violation'), { code: '23505' });
        ins().mockReturnValueOnce({
            values: () => ({ returning: () => Promise.reject(pgUniqueError) }),
        } as any);

        const res = await request(app)
            .post('/api/departments')
            .set(ADMIN_HEADERS)
            .send({ code: 'CS', name: 'Duplicate' });

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ error: 'Department code already exists' });
    });

    it('creates a department and returns 201 with the new record', async () => {
        const created = { ...department, id: 3, code: 'BIO', name: 'Biology' };
        ins().mockReturnValueOnce(chain([created]));

        const res = await request(app)
            .post('/api/departments')
            .set(ADMIN_HEADERS)
            .send({ code: 'BIO', name: 'Biology', description: 'Life sciences' });

        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ code: 'BIO', name: 'Biology' });
    });
});

// ── PUT /api/departments/:id ─────────────────────────────────────────────────

describe('PUT /api/departments/:id', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).put('/api/departments/1').send({ name: 'New' });
        expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
        const res = await request(app)
            .put('/api/departments/1')
            .set(TEACHER_HEADERS)
            .send({ name: 'New' });
        expect(res.status).toBe(403);
    });

    it('returns 400 for non-numeric id', async () => {
        const res = await request(app)
            .put('/api/departments/abc')
            .set(ADMIN_HEADERS)
            .send({ name: 'New' });
        expect(res.status).toBe(400);
    });

    it('returns 404 when department does not exist', async () => {
        upd().mockReturnValueOnce(chain([]));

        const res = await request(app)
            .put('/api/departments/999')
            .set(ADMIN_HEADERS)
            .send({ name: 'Ghost Dept' });

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ error: 'Department not found' });
    });

    it('returns 409 on duplicate code during update', async () => {
        const pgUniqueError = Object.assign(new Error('unique violation'), { code: '23505' });
        upd().mockReturnValueOnce({
            set: () => ({ where: () => ({ returning: () => Promise.reject(pgUniqueError) }) }),
        } as any);

        const res = await request(app)
            .put('/api/departments/1')
            .set(ADMIN_HEADERS)
            .send({ code: 'MATH', name: 'Conflict' });

        expect(res.status).toBe(409);
    });

    it('updates and returns the department', async () => {
        const updated = { ...department, name: 'Advanced CS' };
        upd().mockReturnValueOnce(chain([updated]));

        const res = await request(app)
            .put('/api/departments/1')
            .set(ADMIN_HEADERS)
            .send({ name: 'Advanced CS' });

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: 1, name: 'Advanced CS' });
    });
});

// ── DELETE /api/departments/:id ──────────────────────────────────────────────

describe('DELETE /api/departments/:id', () => {
    it('returns 401 when unauthenticated', async () => {
        const res = await request(app).delete('/api/departments/1');
        expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
        const res = await request(app)
            .delete('/api/departments/1')
            .set(TEACHER_HEADERS);
        expect(res.status).toBe(403);
    });

    it('returns 400 for non-numeric id', async () => {
        const res = await request(app)
            .delete('/api/departments/xyz')
            .set(ADMIN_HEADERS);
        expect(res.status).toBe(400);
    });

    it('returns 409 when department still has subjects', async () => {
        // First query checks subject count — returns 1
        sel().mockReturnValueOnce(chain([{ count: 1 }]));

        const res = await request(app)
            .delete('/api/departments/1')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ error: 'Cannot delete department with existing subjects' });
    });

    it('returns 404 when department does not exist', async () => {
        sel().mockReturnValueOnce(chain([{ count: 0 }]));
        del().mockReturnValueOnce(chain([]));

        const res = await request(app)
            .delete('/api/departments/999')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ error: 'Department not found' });
    });

    it('deletes the department and returns the deleted record', async () => {
        sel().mockReturnValueOnce(chain([{ count: 0 }]));
        del().mockReturnValueOnce(chain([department]));

        const res = await request(app)
            .delete('/api/departments/1')
            .set(ADMIN_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: 1, code: 'CS' });
    });
});
