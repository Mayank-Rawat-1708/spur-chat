import dotenv from "dotenv";
dotenv.config();

import { runMigrations } from "./database";

runMigrations();
process.exit(0);
