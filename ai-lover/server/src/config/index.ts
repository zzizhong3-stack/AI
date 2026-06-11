import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nexusApiKey: process.env.NEXUS_API_KEY || "",
  nexusBaseUrl: process.env.NEXUS_BASE_URL || "https://apimarket.com.cn/v1",
  nexusModel: process.env.NEXUS_MODEL || "anthropic/claude-3-5-sonnet",
  dbPath: path.join(__dirname, "..", "data", "ai-lover.db"),
};
