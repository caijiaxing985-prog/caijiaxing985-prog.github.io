# Jianyoon 文案库

此分支是带管理后台的版本。公开首页 /，管理入口 /admin。
部署及自动更新请阅读《使用与部署说明.md》。GitHub Pages 不能运行本版本的后台。

## 本地运行

```bash
npm install
cp .env.example .env
# 填写本地 PUBLIC_ORIGIN=http://127.0.0.1:5173 和 ADMIN_PASSWORD。
# 一个终端启动后台，另一个终端启动前端。
npm start
npm run dev
```

## 验证

```bash
npm test
npm run build
```

生产运行只需编译后的 dist、server 和 Node.js；也可直接使用 Docker Compose 部署包。
