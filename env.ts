import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
config();

// Environment variables schema
const envSchema = z.object({
  // Required for all deployments
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Binance (required)
  BINANCE_API_KEY: z.string().min(1, "BINANCE_API_KEY is required"),
  BINANCE_API_SECRET: z.string().min(1, "BINANCE_API_SECRET is required"),

  // Supabase (optional - for storage and Phase 2)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),

  // Telegram (optional - for notifications)
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),

  // AI (optional)
  GEMINI_API_KEY: z.string().min(1).optional(),

  // Auth (required for dashboard)
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),
  MAGIC_LINK_SECRET: z
    .string()
    .min(32, "MAGIC_LINK_SECRET must be at least 32 characters")
    .optional(),
});

// Parse and validate environment variables
try {
  const env = envSchema.parse(process.env);
  console.log("✅ Environment variables are valid");
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🏦 Binance: ${env.BINANCE_API_KEY ? "✅ Configured" : "❌ Missing"}`);
  console.log(`💾 Supabase: ${env.SUPABASE_URL ? "✅ Configured" : "❌ Not configured"}`);
  console.log(`📱 Telegram: ${env.TELEGRAM_BOT_TOKEN ? "✅ Configured" : "❌ Not configured"}`);
  console.log(`🤖 AI: ${env.GEMINI_API_KEY ? "✅ Configured" : "❌ Not configured"}`);
  console.log(`🔐 Auth: ${env.AUTH_SECRET ? "✅ Configured" : "❌ Not configured"}`);
} catch (error) {
  console.error("❌ Environment variable validation failed:");
  if (error instanceof z.ZodError) {
    (error as z.ZodError<typeof envSchema>).issues.forEach((err) => {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    });
  } else {
    console.error("  - Unknown error:", error);
  }
  process.exit(1);
}
