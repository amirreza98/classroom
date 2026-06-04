import { relations } from 'drizzle-orm';
import {
    customType,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    varchar,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
    dataType() { return 'bytea'; },
});
import { user } from './auth.js';

const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}

export const departments = pgTable('departments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 255 }),
    ...timestamps
});

export const subjects = pgTable('subjects', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    departmentId: integer('department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    description: varchar('description', { length: 255 }),
    price: numeric('price', { precision: 10, scale: 2 }).default('0').notNull(),
    ...timestamps
});

export const classStatusEnum = pgEnum('class_status', ['active', 'inactive', 'archived']);
export const paymentStatusEnum = pgEnum('payment_status', ['free', 'pending', 'paid', 'failed']);
export const paymentRecordStatusEnum = pgEnum('payment_record_status', ['pending', 'paid', 'failed']);

export const classes = pgTable(
    'classes',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
        teacherId: text('teacher_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
        inviteCode: text('invite_code').notNull().unique(),
        name: varchar('name', { length: 255 }).notNull(),
        bannerCldPubId: text('banner_cld_pub_id'),
        bannerUrl: text('banner_url'),
        description: text('description'),
        capacity: integer('capacity').default(50).notNull(),
        status: classStatusEnum('status').default('active').notNull(),
        schedules: jsonb('schedules').$type<Record<string, unknown>[]>(),
        ...timestamps,
    },
    (table) => [
        index('classes_subject_id_idx').on(table.subjectId),
        index('classes_teacher_id_idx').on(table.teacherId),
    ]
);

export const enrollments = pgTable(
    'enrollments',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
        paymentStatus: paymentStatusEnum('payment_status').default('free').notNull(),
        ...timestamps,
    },
    (table) => [
        uniqueIndex('enrollments_student_class_unique').on(table.studentId, table.classId),
        index('enrollments_student_id_idx').on(table.studentId),
        index('enrollments_class_id_idx').on(table.classId),
    ]
);

export const payments = pgTable(
    'payments',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        enrollmentId: integer('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
        studentId: text('student_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        stripeSessionId: text('stripe_session_id').notNull().unique(),
        stripePaymentIntentId: text('stripe_payment_intent_id'),
        amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
        currency: varchar('currency', { length: 3 }).default('usd').notNull(),
        status: paymentRecordStatusEnum('status').default('pending').notNull(),
        ...timestamps,
    },
    (table) => [
        index('payments_student_id_idx').on(table.studentId),
        index('payments_enrollment_id_idx').on(table.enrollmentId),
    ]
);

export const subjectChatMessages = pgTable(
    'subject_chat_messages',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
        userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        content: text('content').notNull(),
        ...timestamps,
    },
    (table) => [
        index('chat_subject_idx').on(table.subjectId),
        index('chat_created_at_idx').on(table.createdAt),
    ]
);

export const departmentRelations = relations(departments, ({ many }) => ({ subjects: many(subjects) }));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
    department: one(departments, {
        fields: [subjects.departmentId],
        references: [departments.id],
    }),
    classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
    subject: one(subjects, {
        fields: [classes.subjectId],
        references: [subjects.id],
    }),
    teacher: one(user, {
        fields: [classes.teacherId],
        references: [user.id],
    }),
    enrollments: many(enrollments),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
    student: one(user, {
        fields: [enrollments.studentId],
        references: [user.id],
    }),
    class: one(classes, {
        fields: [enrollments.classId],
        references: [classes.id],
    }),
    payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    enrollment: one(enrollments, {
        fields: [payments.enrollmentId],
        references: [enrollments.id],
    }),
    student: one(user, {
        fields: [payments.studentId],
        references: [user.id],
    }),
}));

export const subjectChatMessagesRelations = relations(subjectChatMessages, ({ one }) => ({
    subject: one(subjects, {
        fields: [subjectChatMessages.subjectId],
        references: [subjects.id],
    }),
    sender: one(user, {
        fields: [subjectChatMessages.userId],
        references: [user.id],
    }),
}));

export const collaborativeFiles = pgTable(
    'collaborative_files',
    {
        id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
        classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        yjsState: bytea('yjs_state'),
        createdBy: text('created_by').notNull(),
        ...timestamps,
    },
    (table) => [
        index('collaborative_files_class_id_idx').on(table.classId),
    ]
);

export const collaborativeFilesRelations = relations(collaborativeFiles, ({ one }) => ({
    class: one(classes, {
        fields: [collaborativeFiles.classId],
        references: [classes.id],
    }),
}));

export type CollaborativeFile = typeof collaborativeFiles.$inferSelect;
export type NewCollaborativeFile = typeof collaborativeFiles.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type SubjectChatMessage = typeof subjectChatMessages.$inferSelect;
export type NewSubjectChatMessage = typeof subjectChatMessages.$inferInsert;
