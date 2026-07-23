# 电赛白皮书

一个面向大学生电子设计竞赛的协作式 Debug 知识库。

项目希望将零散的电赛排障经验整理成“故障现象 → 分步排查 → 原因 → 解决方案 → 修复验证”的文档，并提供 Wiki 式内容贡献、版本审核和飞书式划线评论能力。

## 当前状态

项目已经跑通公开阅读、内容贡献、审核发布和文档讨论闭环：

- [产品需求文档](./PRD.md)
- [产品定位](./PRODUCT.md)
- [界面设计系统](./DESIGN.md)
- [A+D 页面升级提示词](./UI_UPGRADE_PROMPT.md)
- [技术架构设计](./docs/ARCHITECTURE.md)

当前已经包含：

- 搜索优先的首页、故障现象探索页和文档阅读页。
- 用户注册、登录和 HttpOnly Cookie 会话。
- 登录用户新建故障条目；新条目先作为不可公开访问的草稿，审核通过后发布。
- 在当前文档内使用 Tiptap 富文本编辑器修改正文，支持标题、列表、引用、代码、公式、表格、预览、自动保存和历史快照。
- 上传经过类型与大小校验的 JPG、PNG、WebP 图片，并直接插入正文。
- 保存草稿、提交审核、驳回修改和审核发布；审核页提供 GitHub 式版本差异。
- 版本历史记录修改者、审核者和日期；个人页提供“我的提交”和审核队列。
- 在正文中选中文字发起持久化评论，支持回复、解决、重开和锚点恢复；评论面板默认收起。
- Docker Compose 管理本地 PostgreSQL，种子脚本提供演示账号和一篇已发布的《本站使用指南》。

第一位注册用户会成为唯一管理员，后续用户是普通贡献者；管理员可以批准审核权申请。未通过审核的新条目和修改不会覆盖公开内容。

## 技术栈

- 前端：React、TypeScript
- 后端：FastAPI、Peewee ORM
- 数据库：PostgreSQL（自动化测试使用 SQLite）
- 富文本：Tiptap / ProseMirror，正文保存为结构化 JSON

## 项目目标

- 建设一个公开、可持续维护的电赛 Debug 知识库。
- 通过完整项目实践系统学习前端、后端、数据库、测试与部署。
- 最终形成可以公开演示并用于全栈或后端实习求职的作品。

## 本地启动

### 1. 启动 PostgreSQL

首次运行时从示例文件创建本地配置：

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
docker compose up -d postgres
```

### 2. 启动后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev,postgres]"
python -m app.db.seed
python -m uvicorn app.main:app --reload
```

`seed` 会先完成建表，再幂等创建本地演示审核员、贡献者和一篇已发布的《本站使用指南》。项目不再预置虚构故障内容；只需要建表时可改用 `python -m app.db.bootstrap`。演示账号由 `backend/.env` 中的 `APP_SEED_*` 配置。上传图片保存在 `APP_UPLOAD_DIR` 指定的本地目录，生产环境应替换为持久化文件或对象存储。

后端地址：

- API 健康检查：`http://localhost:8000/api/v1/health`
- FastAPI 文档：`http://localhost:8000/docs`

### 3. 启动前端

另开一个终端：

```powershell
cd frontend
npm install
npm run dev
```

前端默认地址：`http://localhost:5173`

### 4. 运行检查

```powershell
cd backend
python -m pytest
python -m ruff check .

cd ..\frontend
npm run lint
npm run build
```

开发环境使用 Docker 中的 PostgreSQL。自动化测试使用独立的 SQLite 数据库，避免修改本地开发数据。
