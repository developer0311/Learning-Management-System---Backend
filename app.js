import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import cors from "cors";
import "dotenv/config";
import helmet from "helmet";
import flash from "connect-flash";
// import db from "./db.js";
import pgSession from "connect-pg-simple";


import pageRoutes from "./routes/public_page_routes.js";
import authRoutes from "./routes/auth_routes.js";

import courseRoutes from "./routes/course_routes.js";
import lessonRoutes from "./routes/lesson_routes.js";
import enrollmentRoutes from "./routes/enrollment_routes.js";
import progressRoutes from "./routes/progress_routes.js";


const app = express();
const port = process.env.SERVER_PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(flash());

app.use(cors({ origin: "*" })); // allow all origins

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://code.jquery.com"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com",
          "https://unpkg.com",
          "https://boxicons.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://unpkg.com",
          "https://boxicons.com",
          "https://cdn.jsdelivr.net", 
        ],

        imgSrc: ["'self'", "data:", "https://cdn-icons-png.flaticon.com", "https://res.cloudinary.com"],
        connectSrc: ["'self'","https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// Set EJS as the view engine
app.set("view engine", "ejs");

// Set the views directory
app.set("views", path.join(__dirname, "views"));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, "public")));

// Session config
// const PgSession = pgSession(session);

// app.use(
//   session({
//     store: new PgSession({
//       pool: db, // use your pg Pool instance
//       tableName: "session", // default
//     }),
//     secret: "your-secret-key",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       maxAge: 1000 * 60 * 60 * 24 * 10, // 10 days
//       secure: false, // set true if using HTTPS
//     },
//   })
// );



// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Page Routes
app.use("/", pageRoutes);


// Auth Routes
app.use("/api/auth", authRoutes);


app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api", enrollmentRoutes);
app.use("/api", progressRoutes);


app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).render("500", { title: "Server Error" }); // make sure 500.ejs exists
});


export default app;
