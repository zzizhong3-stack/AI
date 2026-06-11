// 自动部署 — 上传代码到阿里云服务器并重启服务
const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const HOST = "8.130.68.47";
const USER = "root";
const PASS = "114514eE^_^.";
const REMOTE_PATH = "/opt/ai-lover-server/src/";
const LOCAL_SRC = path.join(__dirname, "src");

const conn = new Client();

// 递归收集所有源文件
function collectFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(base, fullPath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else {
      files.push({ local: fullPath, remote: REMOTE_PATH + relativePath });
    }
  }
  return files;
}

console.log("🚀 连接到服务器...\n");

conn.on("ready", () => {
  console.log("✅ SSH 连接成功\n");

  const files = collectFiles(LOCAL_SRC);
  console.log(`📤 上传 ${files.length} 个文件...`);

  // 使用 SFTP 上传
  conn.sftp((err, sftp) => {
    if (err) {
      console.error("SFTP 错误:", err.message);
      conn.end();
      return;
    }

    let uploaded = 0;
    let errors = 0;

    function uploadNext(index) {
      if (index >= files.length) {
        console.log(`\n✅ 上传完成: ${uploaded} 个文件`);
        if (errors > 0) console.log(`⚠️  ${errors} 个失败`);

        // 重启 pm2
        console.log("\n🔄 重启服务...");
        conn.exec("pm2 restart ai-lover", (err, stream) => {
          if (err) {
            console.error("pm2 命令执行失败:", err.message);
            conn.end();
            return;
          }
          stream.on("data", (data) => process.stdout.write("  " + data.toString()));
          stream.stderr.on("data", (data) => process.stderr.write("  " + data.toString()));
          stream.on("close", () => {
            console.log("\n🎉 部署完成！\n");
            conn.end();
          });
        });
        return;
      }

      const file = files[index];
      const remoteDir = path.dirname(file.remote);

      // 确保远程目录存在
      sftp.mkdir(remoteDir, { mode: "755" }, () => {
        // 忽略目录已存在的错误
        sftp.fastPut(file.local, file.remote, (err) => {
          if (err) {
            console.error(`  ❌ ${file.remote}: ${err.message}`);
            errors++;
          } else {
            uploaded++;
            if (uploaded % 5 === 0) console.log(`  📄 ${uploaded}/${files.length}...`);
          }
          uploadNext(index + 1);
        });
      });
    }

    uploadNext(0);
  });
});

conn.on("error", (err) => {
  console.error("❌ 连接失败:", err.message);
});

conn.connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 10000,
});
