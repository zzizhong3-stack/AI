import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { initDatabase, flushAndClose } from "./db/index.js";
import chatRoutes from "./routes/chat.js";

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use("/api/v1", chatRoutes);

// 健康检查
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 先初始化数据库，再启动服务器
async function start() {
  await initDatabase();

  app.listen(config.port, () => {
    console.log(`\n  ❤️  AI Lover Server 已启动`);
    console.log(`  📍 http://localhost:${config.port}`);
    console.log(`  💬 Jinceia 在等你...\n`);

    if (!config.nexusApiKey || config.nexusApiKey === "") {
      console.warn("  ⚠️  警告: NEXUS_API_KEY 未设置！");
      console.warn("  请编辑 server/.env 并填入你的 Nexus API Key\n");
    }
  });
}

// 优雅关闭：确保 DB 数据不丢失
process.on("SIGTERM", () => { flushAndClose(); process.exit(0); });
process.on("SIGINT", () => { flushAndClose(); process.exit(0); });

start().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
