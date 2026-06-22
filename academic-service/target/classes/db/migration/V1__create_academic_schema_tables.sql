-- ============================================================
-- V1: Academic, Engagement, Management schema tables
-- Auth schema tables are managed by the auth-service (Drizzle).
-- ============================================================

-- Academic schema
CREATE TABLE IF NOT EXISTS academic.departments (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS academic.subjects (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id INTEGER      NOT NULL REFERENCES academic.departments(id) ON DELETE RESTRICT,
    name          VARCHAR(255) NOT NULL,
    code          VARCHAR(50)  NOT NULL UNIQUE,
    description   VARCHAR(255),
    price         NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at    TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS academic.classes (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_id      INTEGER      NOT NULL REFERENCES academic.subjects(id) ON DELETE CASCADE,
    teacher_id      TEXT         NOT NULL,  -- references auth.user.id
    invite_code     TEXT         NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    banner_cld_pub_id TEXT,
    banner_url      TEXT,
    description     TEXT,
    capacity        INTEGER DEFAULT 50 NOT NULL,
    status          TEXT DEFAULT 'active' NOT NULL,
    schedules       JSONB DEFAULT '[]',
    created_at      TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS classes_subject_id_idx  ON academic.classes(subject_id);
CREATE INDEX IF NOT EXISTS classes_teacher_id_idx  ON academic.classes(teacher_id);

-- Engagement schema
CREATE TABLE IF NOT EXISTS engagement.enrollments (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id     TEXT    NOT NULL,  -- references auth.user.id
    class_id       INTEGER NOT NULL REFERENCES academic.classes(id) ON DELETE CASCADE,
    payment_status TEXT    DEFAULT 'free' NOT NULL,
    created_at     TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at     TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE (student_id, class_id)
);

CREATE INDEX IF NOT EXISTS enrollments_student_id_idx ON engagement.enrollments(student_id);
CREATE INDEX IF NOT EXISTS enrollments_class_id_idx   ON engagement.enrollments(class_id);

CREATE TABLE IF NOT EXISTS engagement.payments (
    id                       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enrollment_id            INTEGER        NOT NULL REFERENCES engagement.enrollments(id) ON DELETE CASCADE,
    student_id               TEXT           NOT NULL,  -- references auth.user.id
    stripe_session_id        TEXT           NOT NULL UNIQUE,
    stripe_payment_intent_id TEXT,
    amount                   NUMERIC(10, 2) NOT NULL,
    currency                 VARCHAR(3)     DEFAULT 'usd' NOT NULL,
    status                   TEXT           DEFAULT 'pending' NOT NULL,
    created_at               TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at               TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS payments_student_id_idx    ON engagement.payments(student_id);
CREATE INDEX IF NOT EXISTS payments_enrollment_id_idx ON engagement.payments(enrollment_id);

-- Management schema
CREATE TABLE IF NOT EXISTS management.grades (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id      TEXT           NOT NULL,  -- references auth.user.id
    graded_by       TEXT           NOT NULL,  -- references auth.user.id (teacher)
    class_id        INTEGER        NOT NULL REFERENCES academic.classes(id) ON DELETE CASCADE,
    assignment_name VARCHAR(255)   NOT NULL,
    score           NUMERIC(5, 2)  NOT NULL,
    max_score       NUMERIC(5, 2)  NOT NULL,
    feedback        TEXT,
    created_at      TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS grades_student_id_idx ON management.grades(student_id);
CREATE INDEX IF NOT EXISTS grades_class_id_idx   ON management.grades(class_id);

CREATE TABLE IF NOT EXISTS management.notifications (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      TEXT    NOT NULL,  -- references auth.user.id
    title        VARCHAR(255) NOT NULL,
    body         TEXT         NOT NULL,
    read         BOOLEAN DEFAULT FALSE NOT NULL,
    type         VARCHAR(50),
    reference_id INTEGER,
    created_at   TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON management.notifications(user_id);
