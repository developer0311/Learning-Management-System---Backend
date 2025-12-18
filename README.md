# 🎓 Learning Management System (LMS) – Backend API

## 📌 About the Project

The **Learning Management System (LMS) Backend** is a role-based RESTful API designed to support online learning platforms.
It enables **instructors** to create and manage courses and lessons, while allowing **students** to enroll in courses and track their learning progress.

The system follows **secure authentication**, **authorization**, and **ownership-based access control**, ensuring that only permitted users can perform sensitive operations.

This project focuses purely on the **backend architecture**, API design, and database structure, making it suitable for real-world LMS platforms and scalable applications.

---

## 🎯 Project Objectives

- Build a **secure LMS backend** using Node.js and Express
- Implement **JWT-based authentication**
- Enforce **role-based and ownership-based authorization**
- Design scalable APIs for:

  - Course management
  - Lesson management
  - Enrollment
  - Progress tracking

- Provide **clean API documentation** and database schema

---

## ⚙️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQL (PostgreSQL)
- **Authentication**: JSON Web Token (JWT)
- **Password Security**: bcrypt
- **API Architecture**: RESTful APIs

---

## 👥 User Roles

| Role           | Description                                 |
| :-------------- | :------------------------------------------- |
| **Student**    | Enrolls in courses and tracks progress      |
| **Instructor** | Creates and manages own courses and lessons |
| **Admin**      | Full access to all resources                |

---

## 🔐 Security & Authorization

The LMS backend follows strict **role-based access control**:

```text
IF user.role === "admin"
    → allow
ELSE IF user.role === "instructor"
    → allow ONLY if instructor owns the course
ELSE
    → deny
```

- JWT tokens are required for all protected routes
- Ownership is verified before updating or deleting resources
- Students can access only their own enrollments and progress

---

## 📚 Core Features

### 🎓 Course Management

- Create, update, and delete courses (Instructor only)
- Public course listing and course details
- Ownership validation for instructors

### 📘 Lesson Management

- Add lessons to courses
- Maintain lesson order
- Update and delete lessons

### 🎟️ Enrollment

- Students can enroll in courses
- One enrollment per student per course
- Fetch enrolled courses for student dashboard

### 📊 Progress Tracking

- Mark lessons as completed
- Calculate course completion percentage
- Restrict progress tracking to enrolled students only

---

## 🔒 Access Rules Summary

| Action                          | Allowed Role       |
| :------------------------------- | :------------------ |
| View courses                    | Public             |
| Create / Update / Delete course | Instructor (Owner) |
| Add / Update lessons            | Instructor (Owner) |
| Enroll in course                | Student            |
| Track course progress           | Enrolled Student   |

---

## 📂 Deliverables

- ✅ Complete backend API implementation
- ✅ Database schema & relationships
- ✅ API documentation (Markdown and HTML)
- ✅ GitHub repository with README
- ✅ Secure authentication & authorization flow

---

## 🧠 Professional Summary

> **“The LMS backend provides instructor-controlled course creation and lesson structuring, public course discovery, secure student enrollment, and real-time progress tracking, all enforced through JWT-based role and ownership authorization.”**

---

## 🔜 Implementation Roadmap

Recommended development order:

1. Create Course API
2. Get All Courses API
3. Update & Delete Course (Owner validation)
4. Lesson Management APIs
5. Enrollment APIs
6. Progress Tracking APIs

