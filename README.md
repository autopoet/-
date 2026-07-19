# 电赛白皮书

一个面向大学生电子设计竞赛的协作式 Debug 知识库。

项目希望将零散的电赛排障经验整理成“故障现象 → 分步排查 → 原因 → 解决方案 → 修复验证”的文档，并提供 Wiki 式内容贡献、版本审核和飞书式划线评论能力。

## 当前状态

项目已完成第一版 PRD、技术架构、公开阅读端和内容贡献闭环：

- [产品需求文档](./PRD.md)
- [产品定位](./PRODUCT.md)
- [界面设计系统](./DESIGN.md)
- [技术架构设计](./docs/ARCHITECTURE.md)

当前已经包含：

- 搜索优先的首页、故障现象探索页和文档阅读页。
- 用户注册、登录和 HttpOnly Cookie 会话。
- 在当前文档中直接编辑、保存草稿、提交审核、驳回修改和审核发布。
- GitHub 式版本差异审核，以及记录修改者、审核者和日期的版本历史。
- 我的提交和审核队列。
- 默认收起的评论抽屉外壳。

第一位注册用户会成为 MVP 审核员，后续用户是普通贡献者。当前编辑器使用简单的结构化表单，下一阶段再接入 Tiptap/ProseMirror，并实现划线评论的数据闭环。

## 计划技术栈

- 前端：React、TypeScript
- 后端：FastAPI、Peewee ORM
- 数据库：PostgreSQL
- 当前编辑器：结构化表单
- 后续富文本内核：Tiptap / ProseMirror

## 项目目标

- 建设一个公开、可持续维护的电赛 Debug 知识库。
- 通过完整项目实践系统学习前端、后端、数据库、测试与部署。
- 最终形成可以公开演示并用于全栈或后端实习求职的作品。

## 本地启动

### 1. 启动后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev,postgres]"
docker compose up -d postgres
python -m app.db.bootstrap
python -m uvicorn app.main:app --reload
```

后端地址：

- API 健康检查：`http://localhost:8000/api/v1/health`
- FastAPI 文档：`http://localhost:8000/docs`

### 2. 启动前端

另开一个终端：

```powershell
cd frontend
npm install
npm run dev
```

前端默认地址：`http://localhost:5173`

### 3. 运行检查

```powershell
cd backend
python -m pytest
python -m ruff check .

cd ..\frontend
npm run lint
npm run build
```

开发环境使用 Docker 中的 PostgreSQL。自动化测试使用独立的 SQLite 数据库，避免修改本地开发数据。
