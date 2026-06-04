import type { Department, Subject } from '../../db/schema/app.js';

const now = new Date('2025-01-01T00:00:00Z');

export const ADMIN_HEADERS = {
    'x-user-id': 'user-admin-1',
    'x-user-role': 'admin',
    'x-user-email': 'admin@test.com',
};

export const TEACHER_HEADERS = {
    'x-user-id': 'user-teacher-1',
    'x-user-role': 'teacher',
    'x-user-email': 'teacher@test.com',
};

export const STUDENT_HEADERS = {
    'x-user-id': 'user-student-1',
    'x-user-role': 'student',
    'x-user-email': 'student@test.com',
};

export const department: Department = {
    id: 1,
    code: 'CS',
    name: 'Computer Science',
    description: 'CS department',
    createdAt: now,
    updatedAt: now,
};

export const department2: Department = {
    id: 2,
    code: 'MATH',
    name: 'Mathematics',
    description: null,
    createdAt: now,
    updatedAt: now,
};

export const subject: Subject = {
    id: 10,
    departmentId: 1,
    code: 'CS101',
    name: 'Intro to Programming',
    description: 'Learn programming basics',
    price: '0',
    createdAt: now,
    updatedAt: now,
};

export const subject2: Subject = {
    id: 11,
    departmentId: 1,
    code: 'CS201',
    name: 'Data Structures',
    description: null,
    price: '49.99',
    createdAt: now,
    updatedAt: now,
};
