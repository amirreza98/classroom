import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

import { createTestApp } from '../helpers/app.js';
import { ADMIN_HEADERS, STUDENT_HEADERS, TEACHER_HEADERS } from '../helpers/fixtures.js';
import usersRouter from '../../routes/users.js';
import { db } from '../../db/index.js';
import { chain } from '../helpers/chain.js';

vi.mock('../../db/index.js', () => ({
    db: { select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

const app = createTestApp('/api/users', usersRouter);
const now = new Date('2025-01-01T00:00:00Z');

const user1 = {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@test.com',
    role: 'student',
    emailVerified: true,
    image: null,
    imageCldPubId: null,
    createdAt: now,
    updatedAt: now,
};

const user2 = {
    id: 'user-2',
    name: 'Bob',
    email: 'bob@test.com',
    role: 'teacher',
    emailVerified: true,
    image: null,
    imageCldPubId: null,
    createdAt: now,
    updatedAt: now,
};

beforeEach(() => vi.clearAllMocks());

describe('GET /api/users', () => {
    it('returns paginated list for admin', async () => {
        vi.mocked(db.select).mockReturnValueOnce(chain([{ count: 2 }]));
        vi.mocked(db.select).mockReturnValueOnce(chain([user1, user2]));

        const res = await request(app).get('/api/users').set(ADMIN_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.pagination.total).toBe(2);
    });

    it('returns 403 for non-admin', async () => {
        const res = await request(app).get('/api/users').set(STUDENT_HEADERS);
        expect(res.status).toBe(403);
    });

    it('returns 401 with no auth headers', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(401);
    });

    it('filters by role', async () => {
        vi.mocked(db.select).mockReturnValueOnce(chain([{ count: 1 }]));
        vi.mocked(db.select).mockReturnValueOnce(chain([user2]));

        const res = await request(app).get('/api/users?role=teacher').set(ADMIN_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].role).toBe('teacher');
    });
});

describe('GET /api/users/:id', () => {
    it('allows admin to fetch any user', async () => {
        vi.mocked(db.select).mockReturnValueOnce(chain([user1]));

        const res = await request(app).get('/api/users/user-1').set(ADMIN_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('user-1');
    });

    it('allows user to fetch their own profile', async () => {
        vi.mocked(db.select).mockReturnValueOnce(chain([user1]));

        const res = await request(app)
            .get('/api/users/user-student-1')
            .set(STUDENT_HEADERS);

        expect(res.status).toBe(200);
    });

    it('returns 403 when student fetches another user', async () => {
        const res = await request(app).get('/api/users/user-2').set(STUDENT_HEADERS);
        expect(res.status).toBe(403);
    });

    it('returns 404 for unknown id', async () => {
        vi.mocked(db.select).mockReturnValueOnce(chain([]));

        const res = await request(app).get('/api/users/nobody').set(ADMIN_HEADERS);
        expect(res.status).toBe(404);
    });
});

describe('PUT /api/users/:id', () => {
    it('admin can update any user', async () => {
        const updated = { ...user1, name: 'Alice Updated' };
        vi.mocked(db.update).mockReturnValueOnce(chain([updated]));

        const res = await request(app)
            .put('/api/users/user-1')
            .set(ADMIN_HEADERS)
            .send({ name: 'Alice Updated' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Alice Updated');
    });

    it('returns 403 when student updates another user', async () => {
        const res = await request(app)
            .put('/api/users/user-2')
            .set(STUDENT_HEADERS)
            .send({ name: 'Hacked' });

        expect(res.status).toBe(403);
    });
});

describe('DELETE /api/users/:id', () => {
    it('admin can delete a user', async () => {
        vi.mocked(db.delete).mockReturnValueOnce(chain([user1]));

        const res = await request(app).delete('/api/users/user-1').set(ADMIN_HEADERS);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe('user-1');
    });

    it('returns 403 for non-admin', async () => {
        const res = await request(app).delete('/api/users/user-1').set(TEACHER_HEADERS);
        expect(res.status).toBe(403);
    });

    it('returns 404 when user not found', async () => {
        vi.mocked(db.delete).mockReturnValueOnce(chain([]));

        const res = await request(app).delete('/api/users/ghost').set(ADMIN_HEADERS);
        expect(res.status).toBe(404);
    });
});
