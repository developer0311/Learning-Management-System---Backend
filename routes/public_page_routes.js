import { homepage_data } from "../controllers/public_page_controllers.js";
import express from "express";

let router = express.Router();

router.get("/", homepage_data)

export default router;