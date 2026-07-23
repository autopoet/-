# Render + Supabase 预览部署与迁移手册

> 最后更新：2026-07-23
> 当前用途：免费预览和小范围测试，不是最终生产架构
> 目标地址：先使用 Render 地址，稳定后可绑定 `debug.autopoet.cn`

## 1. 当前架构

```text
浏览器
  │
  ▼
Render Free（React 静态文件 + FastAPI）
  ├── Supabase PostgreSQL：账号、文章、版本、审核、评论、通知
  └── Supabase Storage：文章图片
```

Render 容器只运行程序，不保存业务数据。即使 Render 休眠、重启或重新部署，文章和图片也不应依赖它的本地磁盘。

当前代码约定：

- 正文中的图片地址始终保存为 `/uploads/<对象名>`。
- 使用 Supabase 时，FastAPI 将该地址重定向到 Supabase 公共桶。
- 对象名在首次上传后不覆盖、不改变。
- 将来迁移到阿里云 OSS 时，保持对象名不变并切换 `/uploads/` 的后端即可，不需要修改每篇文章的富文本 JSON。
- `APP_MAINTENANCE_READ_ONLY=true` 会拒绝所有写请求，保留公开阅读，用于迁移前冻结数据。

## 2. 资源与责任边界

| 数据 | 当前位置 | Render 重启影响 | 必须单独备份 |
| --- | --- | --- | --- |
| 文章、用户、审核、评论、通知 | Supabase PostgreSQL | 不影响 | 是 |
| 正文图片 | Supabase Storage `article-images` | 不影响 | 是 |
| React 和 FastAPI 程序 | GitHub + Render 镜像 | 重新构建 | GitHub 已保存 |
| Render 本地文件 | 临时容器 | 会丢失 | 禁止存业务数据 |

Supabase 的数据库备份不包含 Storage 中的真实图片对象，因此数据库和图片必须分别备份。免费版不能被当作唯一备份。

## 3. 首次部署

### 3.1 创建 Supabase 项目

1. 在 Supabase 创建免费项目，区域尽量选择与 Render 相近的区域。
2. 保存数据库密码到密码管理器，不要写进仓库、聊天或交接文档。
3. 点击项目顶部的 **Connect**，复制 **Session pooler** 连接串。
4. 确认连接串端口为 `5432`，并添加 `sslmode=require`（如果原连接串没有查询参数，末尾加 `?sslmode=require`）。

Render 到 Supabase 的应用连接使用 Session pooler，因为免费项目的直接连接通常只有 IPv6，而 Session pooler 可从 IPv4 网络访问。数据库迁移和备份优先使用 Supabase 提供的 direct connection；本机没有 IPv6 时再使用 Session pooler。

### 3.2 创建图片桶

在 Supabase 的 **Storage** 中创建：

- Bucket：`article-images`
- Public bucket：开启
- File size limit：`10 MB`
- Allowed MIME types：`image/png`、`image/jpeg`、`image/webp`

公共桶符合公开知识库的用途：图片任何人都可以读取，但上传仍只经过本站登录接口。Supabase secret key 只放在 Render 服务端，绝不能放进 `VITE_*` 前端变量。优先创建并使用 `sb_secret_...` 新式密钥；代码仍兼容旧的 JWT `service_role` key。

### 3.3 准备 Render Blueprint

部署配置位于仓库根目录的 `render.yaml`，镜像构建位于 `Dockerfile`。代码合入 `main` 后打开：

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/autopoet/diansai-debug-handbook
```

如果仓库实际 URL 发生变化，替换 `repo=` 后面的地址。创建 Blueprint 时选择 GitHub 仓库并填写所有 `sync: false` 变量。

### 3.4 Render 环境变量

| 变量 | 值/来源 | 是否敏感 |
| --- | --- | --- |
| `APP_DATABASE_URL` | Supabase Session pooler URI，要求 SSL | 是 |
| `APP_SUPABASE_URL` | Supabase Project URL | 否 |
| `APP_SUPABASE_SECRET_KEY` | Supabase 服务端 `sb_secret_...` key；也兼容旧 service-role JWT | 是 |
| `APP_SUPABASE_STORAGE_BUCKET` | `article-images` | 否 |
| `APP_SEED_REVIEWER_USERNAME` | 首位管理员用户名 | 否 |
| `APP_SEED_REVIEWER_PASSWORD` | 首位管理员强密码 | 是 |
| `APP_SEED_CONTRIBUTOR_USERNAME` | 预览贡献者用户名 | 否 |
| `APP_SEED_CONTRIBUTOR_PASSWORD` | 预览贡献者强密码 | 是 |
| `APP_FRONTEND_ORIGIN` | Render 公网地址；绑定域名后改为 `https://debug.autopoet.cn` | 否 |
| `APP_SECURE_COOKIES` | `true` | 否 |
| `APP_STORAGE_BACKEND` | `supabase` | 否 |
| `APP_MAINTENANCE_READ_ONLY` | 正常为 `false`，迁移冻结时为 `true` | 否 |

首次启动会幂等建表、创建管理员和贡献者，并发布一篇《本站使用指南》。后续重启不会重复创建文章。

### 3.5 首次验收

部署完成后逐项确认：

1. `GET /api/v1/health` 返回 `status: ok`。
2. 首页能看到《本站使用指南》，刷新页面和直接打开文章深层链接都正常。
3. 管理员和贡献者都能登录，Cookie 带 `Secure`。
4. 注册一个新用户，完成“草稿 → 提交 → 审核通过 → 公开阅读”。
5. 上传一张测试图，在 Supabase `article-images` 中能看到同名对象。
6. 等 Render 空闲超过 15 分钟后再次访问；冷启动后文章和图片仍然存在。
7. Render 日志中没有数据库 SSL、Supabase Storage 或初始化错误。

## 4. 自定义域名

首轮验收通过后，在 Render 服务中添加 `debug.autopoet.cn`。Render 会给出需要在阿里云 DNS 添加的 CNAME 记录。

DNS 生效并签发 HTTPS 证书后：

1. 将 Render 的 `APP_FRONTEND_ORIGIN` 改为 `https://debug.autopoet.cn`。
2. 重新部署一次。
3. 验证注册、登录、退出、图片和深层链接。
4. Render 默认域名暂时保留，作为域名故障时的诊断入口。

## 5. 免费预览环境限制

- Render Free 连续约 15 分钟没有入站流量会休眠，下一次访问可能等待约一分钟。
- Render 文件系统是临时的，休眠、重启和部署都会清空运行期文件。
- Render 免费服务不能挂持久磁盘，也没有 Shell/SSH。
- Supabase Free 可能因低活动暂停，恢复后仍要检查服务和数据。
- Supabase Free 不提供可依赖的每日逻辑备份；必须执行下面的站外备份。
- Supabase Storage 不支持对象版本控制，删除对象后不能依赖平台恢复。

这些限制适合测试，不适合正式长期运营。

## 6. 备份制度

测试阶段最低要求：

- 每周备份一次。
- 每次批量发布重要文章后立即备份。
- 迁移、升级或高风险数据操作前后各备份一次。
- 至少保留两份，分别放在本机和另一个不属于 Supabase 项目的位置。
- 备份目录和压缩包不得提交 Git；其中可能包含用户信息和密码哈希。

建议目录：

```text
backups/
  2026-07-23T120000+0800/
    database.dump
    images/
    image-sha256.csv
    README.txt
```

### 6.1 数据库备份

使用 direct connection（备份场景优先）：

```powershell
pg_dump "<DIRECT_DATABASE_URL>" `
  --format=custom `
  --no-owner `
  --no-acl `
  --file "backups\<时间>\database.dump"
```

也可以使用 Supabase CLI：

```powershell
supabase db dump --db-url "<DIRECT_DATABASE_URL>" --file "backups\<时间>\schema.sql"
supabase db dump --db-url "<DIRECT_DATABASE_URL>" --data-only --use-copy --file "backups\<时间>\data.sql"
```

连接串包含特殊字符时必须 URL 编码。不要把完整连接串保存在脚本或终端截图里。

### 6.2 图片备份

在 Supabase Storage 设置中启用 S3 连接并生成专用 S3 access key。使用 AWS CLI 同步：

```powershell
$env:AWS_ACCESS_KEY_ID="<临时填写>"
$env:AWS_SECRET_ACCESS_KEY="<临时填写>"

aws s3 sync "s3://article-images" "backups\<时间>\images" `
  --endpoint-url "https://<project-ref>.supabase.co/storage/v1/s3" `
  --region "<Supabase 项目区域>"

Get-ChildItem "backups\<时间>\images" -Recurse -File |
  Get-FileHash -Algorithm SHA256 |
  Export-Csv "backups\<时间>\image-sha256.csv" -NoTypeInformation -Encoding UTF8

Remove-Item Env:AWS_ACCESS_KEY_ID
Remove-Item Env:AWS_SECRET_ACCESS_KEY
```

备份后核对 Supabase 桶中的对象数量与本地文件数量，并随机打开至少三张图片。

### 6.3 恢复演练

备份只有经过恢复验证才可信。至少在正式迁移前执行一次：

```powershell
createdb diansai_restore_test
pg_restore --no-owner --no-acl --dbname diansai_restore_test "backups\<时间>\database.dump"
```

检查关键表数量、最新文章版本、管理员账号、评论和通知。图片在临时目录中校验 SHA-256，不要覆盖线上桶。

## 7. 迁移到阿里云

目标架构建议为：

- 阿里云 ECS：FastAPI 与 React
- 阿里云 RDS PostgreSQL：结构化数据
- 阿里云 OSS：文章图片
- 阿里云 DNS/HTTPS：`debug.autopoet.cn`

### 7.1 迁移前准备

1. 在新分支实现 `oss` 图片存储后端，继续保留 `/uploads/<对象名>` 地址约定。
2. 在阿里云测试环境完成建表、恢复、对象读取和完整业务验收。
3. 设定维护窗口并通知用户。
4. 不删除 Render 或 Supabase，不修改旧数据。

### 7.2 正式迁移顺序

1. 在 Render 将 `APP_MAINTENANCE_READ_ONLY` 改为 `true` 并重新部署，确认写请求返回 503、公开阅读仍正常。
2. 记录冻结时间，导出最终数据库备份。
3. 下载最终 Storage 全量对象并生成 SHA-256 清单。
4. 将数据库恢复到 RDS：

   ```powershell
   pg_restore --no-owner --no-acl --dbname "<RDS_DATABASE_URL>" "database.dump"
   ```

5. 将 `images/` 上传到 OSS，必须保持相同对象名。
6. 对比关键表行数、所有对象数量和 SHA-256；抽查旧文章的图片。
7. 在新环境完成注册、登录、编辑、上传、提交、审核、评论和通知流程。
8. 切换 `debug.autopoet.cn` 到阿里云，先保持短 DNS TTL。
9. 观察日志与数据至少 24 小时，再解除新环境只读状态。
10. Render + Supabase 保持只读至少 14 天，确认无回滚需求后再决定是否删除。

### 7.3 数据核对

至少核对这些表：

- `user`
- `authsession`
- `symptom`
- `articlerevision`
- `favorite`
- `commentthread`
- `comment`
- `reviewerapplication`
- `auditlog`
- `articlefeedback`
- `notification`

核对标准：

- 旧库和新库每张表行数一致。
- 每篇公开条目的当前版本、版本号、作者、审核者和日期一致。
- Storage/OSS 对象数量一致，SHA-256 清单无差异。
- 所有正文中的 `/uploads/...` 都能返回图片。

### 7.4 回滚

如果切换后出现严重问题：

1. 立即把 DNS 指回 Render。
2. 保持阿里云新环境只读，停止产生新写入。
3. 将 Render 的 `APP_MAINTENANCE_READ_ONLY` 改回 `false`。
4. 根据日志定位问题，修复后重新执行“冻结 → 最终备份 → 增量重迁移”。

旧环境保持冻结的意义是避免出现两边同时写入、无法判断哪份数据更新的问题。

## 8. 常见故障和数据恢复

### Render 服务被删除或部署失败

从 GitHub `main` 和 `render.yaml` 重新创建服务，重新填写环境变量。数据库和图片在 Supabase，不从 Render 本地磁盘恢复。

### Supabase 项目暂停

先在 Dashboard 恢复项目，再重启 Render 服务并检查健康接口。暂停不等于可以省略备份。

### 误删文章或错误审核

优先使用站内“从旧版本生成回滚版本”，保留作者、审核者和时间记录。不要直接改数据库。

### 数据库损坏或误删

冻结写入，保留现场，恢复最近一次已验证的 `database.dump`。免费版最后一次站外备份之后的新数据可能无法找回，因此每次重要内容发布后必须备份。

### 图片对象被删除

从最近的 `images/` 备份恢复同名对象。对象名不变时，正文无需修改；恢复后按 `image-sha256.csv` 校验。

### Supabase 服务端密钥泄漏

立即在 Supabase 轮换密钥，在 Render 更新 `APP_SUPABASE_SECRET_KEY` 并重新部署；检查 Storage 和数据库审计记录。密钥不得出现在 Git、文档或前端构建产物中。

## 9. 后续维护者接手清单

接手前依次阅读：

1. 根目录 `PRD.md`
2. 本地 `HANDOFF.md`
3. 本文档
4. `render.yaml`
5. `Dockerfile`
6. `backend/app/services/image_storage.py`
7. `backend/app/main.py`

接手者还需要从项目负责人处通过安全渠道获得：

- GitHub、Render、Supabase、阿里云的账号权限。
- 数据库连接信息和对象存储凭据。
- 最近一次数据库与图片备份的位置、日期和校验结果。
- 当前域名 DNS 和 HTTPS 状态。

任何迁移、删除或密钥轮换操作都必须先备份并记录验证结果，不能仅凭“平台应该有备份”执行。

## 10. 官方参考

- [Render Free 限制](https://render.com/docs/free)
- [Render Blueprint 规范](https://render.com/docs/blueprint-spec)
- [Supabase 数据库连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase 数据库备份](https://supabase.com/docs/guides/platform/backups)
- [Supabase Storage 标准上传](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Supabase 公共对象地址](https://supabase.com/docs/guides/storage/serving/downloads)
- [Supabase Storage S3 兼容](https://supabase.com/docs/guides/storage/s3/compatibility)
