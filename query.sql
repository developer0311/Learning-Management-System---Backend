CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;

$$ LANGUAGE plpgsql;

-- ====================== ENUM TYPES ======================

CREATE TYPE user_role AS ENUM ('student', 'instructor', 'admin');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'dropped');
CREATE TYPE course_level AS ENUM ('Beginner', 'Intermediate', 'Advanced');

-- Payment status (for platform payments)
CREATE TYPE payment_status AS ENUM (
  'pending',
  'paid',
  'failed'
);


-- ====================== USERS ======================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- quick search index by email for login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- ====================== INSTRUCTORS ======================

CREATE TABLE instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    expertise VARCHAR(200),
    experience_years INT CHECK (experience_years >= 0),
    profile_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_instructors_updated_at
BEFORE UPDATE ON instructors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_instructors_user_id ON instructors(user_id);


-- ====================== COURSES ======================

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    level course_level NOT NULL,
    duration VARCHAR(50),
    total_lessons INT NOT NULL DEFAULT 0,
    total_assignments INT NOT NULL DEFAULT 0,
    price NUMERIC(10,2) NOT NULL,
    COLUMN actual_price NUMERIC(10,2),
    discount_percent INT DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    rating NUMERIC(2,1) DEFAULT 0.0 CHECK (rating BETWEEN 0 AND 5),
    banner_url TEXT,
    instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


CREATE OR REPLACE FUNCTION update_course_lesson_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE courses
  SET total_lessons = total_lessons + 1
  WHERE id = (
    SELECT course_id FROM course_modules WHERE id = NEW.module_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_increment_lesson_count
AFTER INSERT ON lessons
FOR EACH ROW
EXECUTE FUNCTION update_course_lesson_count();


CREATE OR REPLACE FUNCTION update_course_assignment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE courses
  SET total_assignments = total_assignments + 1
  WHERE id = NEW.course_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION calculate_actual_price(
    base_price NUMERIC,
    discount INT
)
RETURNS NUMERIC(10,2) AS $$
DECLARE
    discounted_price NUMERIC;
BEGIN
    discounted_price :=
        base_price - (base_price * COALESCE(discount, 0) / 100);

    -- round to nearest integer, then force .00
    RETURN ROUND(discounted_price, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


CREATE OR REPLACE FUNCTION update_actual_price()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actual_price :=
        calculate_actual_price(NEW.price, NEW.discount_percent);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courses_actual_price
BEFORE INSERT OR UPDATE OF price, discount_percent
ON courses
FOR EACH ROW
EXECUTE FUNCTION update_actual_price();

CREATE TRIGGER trg_increment_assignment_count
AFTER INSERT ON assignments
FOR EACH ROW
EXECUTE FUNCTION update_course_assignment_count();


-- Optional: quick search index by category
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON courses(instructor_id);


-- ====================== COURSE DETAILS ======================

CREATE TABLE course_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

    overview TEXT,
    prerequisites TEXT,
    learning_outcomes TEXT,
    target_audience TEXT,
    syllabus JSONB,   -- structured modules + topics

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_course_details_updated_at
BEFORE UPDATE ON course_details
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE UNIQUE INDEX uniq_course_details_course
ON course_details(course_id);


-- ====================== COURSE MODULES ======================

CREATE TABLE course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,     -- "About HTML", "About CSS"
    order_index INT NOT NULL CHECK (order_index > 0),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (course_id, order_index)
);

CREATE TRIGGER trg_course_modules_updated_at
BEFORE UPDATE ON course_modules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ====================== LESSONS ======================

CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,
    content_url TEXT,
    content_type VARCHAR(50),
    order_index INT NOT NULL CHECK (order_index > 0),

    is_preview BOOLEAN DEFAULT FALSE,
    duration_minutes INT CHECK (duration_minutes >= 0),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (module_id, order_index)
);

CREATE TRIGGER trg_lessons_updated_at
BEFORE UPDATE ON lessons
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_lessons_module_id ON lessons(module_id);


-- ====================== ENROLLMENTS ======================

CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    progress NUMERIC(5,2) DEFAULT 0.00 CHECK (progress BETWEEN 0 AND 100),
    status enrollment_status DEFAULT 'active'
);

CREATE UNIQUE INDEX uniq_enrollment_student_course
ON enrollments(student_id, course_id);


CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);


-- ====================== PROGRESS TRACKING ======================

CREATE TABLE progress_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,

    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,

    UNIQUE (enrollment_id, lesson_id)
);

CREATE INDEX idx_progress_enrollment_id ON progress_tracking(enrollment_id);
CREATE INDEX idx_progress_lesson_id ON progress_tracking(lesson_id);


-- ====================== ASSIGNMENTS (Optional but Professional LMS Feature) ======================

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_assignments_updated_at
BEFORE UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_assignments_course_id ON assignments(course_id);


-- ====================== SUBMISSIONS (Optional) ======================

CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    file_url TEXT,
    grade NUMERIC(5,2),
    feedback TEXT,

    submitted_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_submissions_student_id ON submissions(student_id);


-- ================= PAYMENTS =================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    enrollment_id UUID UNIQUE NOT NULL
        REFERENCES enrollments(id) ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    course_id UUID NOT NULL
        REFERENCES courses(id) ON DELETE CASCADE,

    payment_method VARCHAR(50) NOT NULL,   -- razorpay / upi / card
    amount NUMERIC(10,2) NOT NULL,

    payment_status payment_status NOT NULL DEFAULT 'pending',

    -- Razorpay
    razorpay_order_id VARCHAR(100) UNIQUE,
    razorpay_payment_id VARCHAR(100) UNIQUE,
    razorpay_signature VARCHAR(255),

    -- Platform reference
    transaction_id VARCHAR(100) UNIQUE NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_course_id ON payments(course_id);
