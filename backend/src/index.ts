import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { runMigrations } from "./db/database";
import chatRouter from "./routes/chat";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS - allow frontend origin
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for demo; restrict in production
      }
    },
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate limiting for chat endpoint
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    error: "Too many messages. Please slow down and try again in a minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "spur-chat-backend",
  });
});

// Routes
app.use("/chat", chatLimiter, chatRouter);

// 404 and error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize DB and start server
try {
  runMigrations();
  app.listen(PORT, () => {
    console.log(`🚀 Spur Chat Backend running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`   LLM: Anthropic Claude`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}

export default app;
