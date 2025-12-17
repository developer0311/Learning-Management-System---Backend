-- ====================== ENUM TYPES ======================

CREATE TYPE user_role AS ENUM ('student', 'instructor', 'admin');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'dropped');
CREATE TYPE course_level AS ENUM ('Beginner', 'Intermediate', 'Advanced');


-- ====================== USERS ======================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quick search index by email for login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- ====================== INSTRUCTORS ======================

CREATE TABLE IF NOT EXISTS instructors (
    id  BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    bio TEXT,
    expertise VARCHAR(200),
    experience_years INT CHECK (experience_years IS NULL OR experience_years >= 0),
    profile_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_instructors_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_instructors_user_id ON instructors(user_id);


-- ====================== COURSES ======================

CREATE TABLE IF NOT EXISTS courses (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),              -- Frontend, Backend, AI & ML, etc.
    level course_level NOT NULL,     -- Beginner / Intermediate / Advanced
    duration VARCHAR(50),               -- e.g. "6 weeks"
    price NUMERIC(10,2) NOT NULL,    -- e.g. 4999.00
    discount_percent INT DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    rating NUMERIC(2,1) DEFAULT 0.0 CHECK (rating BETWEEN 0 AND 5),
    banner_url TEXT,                      -- image / thumbnail URL
    instructor_id BIGINT NOT NULL,            -- FK → instructors.id
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_courses_instructor
        FOREIGN KEY (instructor_id)
        REFERENCES instructors(id)
        ON DELETE CASCADE
);



-- Optional: quick search index by category
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON courses(instructor_id);


-- ====================== LESSONS ======================

CREATE TABLE IF NOT EXISTS lessons (
    id  BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content_url TEXT,             -- could be video URL, PDF URL, etc.
    order_index INT NOT NULL CHECK (order_index > 0),     -- lesson order in the course
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_lessons_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
);

-- Make sure each lesson order is unique within a course
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lessons_course_order
ON lessons (course_id, order_index);

CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);


-- ====================== ENROLLMENTS ======================

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,  -- references users.id (role = 'student')
    course_id BIGINT NOT NULL,  -- references courses.id
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    progress NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- 0.00 - 100.00
    status enrollment_status NOT NULL DEFAULT 'active',

    CONSTRAINT fk_enrollments_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_enrollments_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_enrollments_progress
        CHECK (progress >= 0.00 AND progress <= 100.00)
);

-- A student can be enrolled in the same course only once
CREATE UNIQUE INDEX IF NOT EXISTS uniq_enrollment_student_course
ON enrollments (student_id, course_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);


-- ====================== PROGRESS TRACKING ======================

CREATE TABLE IF NOT EXISTS progress_tracking (
    id BIGSERIAL PRIMARY KEY,
    enrollment_id BIGINT NOT NULL,
    lesson_id BIGINT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,

    CONSTRAINT fk_progress_enrollment
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_progress_lesson
        FOREIGN KEY (lesson_id) REFERENCES lessons(id)
        ON DELETE CASCADE
);

-- One progress record per lesson per enrollment
CREATE UNIQUE INDEX IF NOT EXISTS uniq_progress_enrollment_lesson
ON progress_tracking (enrollment_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_progress_enrollment_id ON progress_tracking(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson_id ON progress_tracking(lesson_id);


-- ====================== ASSIGNMENTS (Optional but Professional LMS Feature) ======================

CREATE TABLE IF NOT EXISTS assignments (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_assignments_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);


-- ====================== SUBMISSIONS (Optional) ======================

CREATE TABLE IF NOT EXISTS submissions (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL, -- references users.id
    file_url TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    grade NUMERIC(5,2),
    feedback TEXT,

    CONSTRAINT fk_submissions_assignment
        FOREIGN KEY (assignment_id) REFERENCES assignments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_submissions_student
        FOREIGN KEY (student_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- A student can submit once per assignment (you can relax this if you want multiple attempts)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_submissions_assignment_student
ON submissions (assignment_id, student_id);

CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
