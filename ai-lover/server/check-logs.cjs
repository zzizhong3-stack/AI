// 检查服务器日志
const { Client } = require("ssh2");
const conn = new Client();

conn.on("ready", () => {
  console.log("📋 服务器最近日志:\n");
  conn.exec("pm2 logs ai-lover --lines 30 --nostream", (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on("data", (data) => console.log(data.toString()));
    stream.stderr.on("data", (data) => console.error(data.toString()));
    stream.on("close", () => {
      console.log("\n---");
      // 同时检查 CORS 和路由
      conn.exec("curl -s -X POST http://localhost:3000/api/v1/users/register -H 'Content-Type: application/json' -d '{\"nickname\":\"test123\"}'", (err2, stream2) => {
        if (!err2) {
          stream2.on("data", (data) => console.log("本地测试注册:", data.toString()));
          stream2.on("close", () => conn.end());
        } else {
          conn.end();
        }
      });
    });
  });
});

conn.connect({ host: "8.130.68.47", port: 22, username: "root", password: "114514eE^_^.", readyTimeout: 10000 });
