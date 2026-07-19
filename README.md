# 电赛白皮书

一个面向大学生电子设计竞赛的协作式 Debug 知识库。

项目希望将零散的电赛排障经验整理成“故障现象 → 分步排查 → 原因 → 解决方案 → 修复验证”的文档，并提供 Wiki 式内容贡献、版本审核和飞书式划线评论能力。

## 当前状态

项目已完成第一版 PRD、技术架构与学习路线，并搭建了可以验证前后端连接的基础骨架。

- [产品需求文档](./PRD.md)
- [技术架构设计](./docs/ARCHITECTURE.md)

## 计划技术栈

- 前端：React、TypeScript
- 后端：FastAPI、Peewee ORM
- 数据库：PostgreSQL
- 编辑器内核：Tiptap / ProseMirror

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
