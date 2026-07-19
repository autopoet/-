# 电赛白皮书设计系统

## 核心方向

界面是一份可协作、可追溯的技术出版物，不是营销官网。整体语气为“技术、编辑、克制”：先呈现故障现象，再提供有顺序的测量与验证步骤；编辑、审核、版本和评论是同一份文档上的工作状态。

视觉母题为 **Technical Editorial / Signal Green**。带绿色倾向的纸张底色、中文宋体标题、无衬线正文和等宽数据共同建立知识感。Signal Green 只标记可操作位置、当前状态与已验证内容，占屏面积不超过约 5%。

## 页面家族

| 页面 | Hallmark 宏结构 | 任务 |
| --- | --- | --- |
| 首页 | Ecosystem Index | 快速搜索，并从常见故障、供电、通信等入口开始排查 |
| 知识库 | Index-First | 浏览、筛选与阅读全部故障条目 |
| 文章 / 未收录条目 | Long Document | 连续阅读、目录定位、版本查看与评论 |
| 登录 / 我的提交 / 审核 | Workbench | 完成贡献与审核工作 |
| 行内编辑 | Long Document + Workbench | 在文档原位置修改，不跳转独立编辑器 |

首页与知识库不得复用同一信息结构：首页强调“立即开始”和少量分组入口；知识库强调完整索引、查询结果和数量。

## 导航与页脚

- 顶部采用简化的 Newspaper Masthead：窄信息行、居中的宋体站名、同一行主导航和账户操作、双线收口。
- 宽屏保持完整导航；小屏收为站名、菜单按钮和展开式导航。所有可点击标签保持单行。
- 页脚采用 Inline Rule：一条细线和一行产品性质、开放协作说明，不使用四列链接型 SaaS 页脚。

## 色彩

所有颜色在 `frontend/tokens.css` 中以 OKLCH 定义，组件不得写入临时十六进制色。

| 角色 | Token | 用途 |
| --- | --- | --- |
| Paper | `--color-paper` | 全站纸张底色 |
| Paper 2 / 3 | `--color-paper-2/3` | 索引带、代码背景、弱分区 |
| Surface | `--color-surface` | 输入框与浮层 |
| Ink / Ink 2 | `--color-ink/ink-2` | 标题、正文与深色控件 |
| Neutral / Muted | `--color-neutral/muted` | 正文次级层级与元信息 |
| Rule / Rule 2 | `--color-rule/rule-2` | 分隔线与控件边界 |
| Signal Green | `--color-accent` | 主操作、当前项、通过状态 |
| Warning / Danger | `--color-warning/danger` | 风险和错误语义 |

任何设置深色或强调色背景的规则，必须同时显式设置对应文字颜色。删除、增加、警告和错误状态不能只靠颜色，还要配合符号、文本或结构。

## 字体

- 展示与文章标题：`--font-display`，首选 `Noto Serif SC`。
- 界面与正文：`--font-body`，首选 `Noto Sans SC`。
- 版本、行号、测量值与代码：`--font-outlier`，首选 `JetBrains Mono`。
- 采用 major-third 字号阶梯：`0.75 / 0.875 / 1 / 1.25 / 1.563 / 1.953rem`，站名可使用流体 `--text-display`。
- 正文最小 `1rem`，文章行高 `1.75`，建议行宽 `60–72ch`。标题使用正常体，不用斜体强调词。
- 单页最多出现五个主要字号；小标签只在真正的版本、序号或状态信息中使用。

## 间距、形状与层级

- 4pt 语义尺度：`4 / 8 / 12 / 16 / 24 / 32 / 48 / 72 / 112 / 176px`。
- 页面通过留白、纸色带和细线组织。只允许一个语义容器层级，禁止卡片套卡片。
- 输入与普通面板圆角为 `4px`；状态胶囊可用全圆角。常规内容不使用柔光阴影。
- 阴影仅用于搜索建议和抽屉等真正浮在内容之上的元素。
- 触控目标至少 `44×44px`；输入框与相邻按钮保持相同高度。

## 内容与组件

- 搜索框是单一输入表面：左侧搜索图标、正文输入、右侧清除与提交操作。禁止在同一视图重复放置两个视觉相同的搜索框。
- 首页条目以编号索引和故障分组呈现；知识库使用完整的规则线列表和结果计数。
- 文章目录、正文和评论入口在宽屏形成稳定三列；评论默认收起，打开后正文不重排。
- 文章提示块使用顶部规则、图标和文字，不使用厚重侧边色条。
- 编辑器保持阅读页排版，只把可修改内容变成输入表面；操作栏固定在内容底部，保存成功保持安静反馈。
- 审核页先显示版本责任信息，再显示逐字段、逐行 Diff；增删背景保持低饱和，行号采用等宽数字。
- 空状态明确“什么为空”和下一步；错误信息说明发生了什么以及如何继续。

## 动效

动效可以被感知，但必须解释状态变化。每页最多三种动效原语：

1. 页面首次进入：宽屏下整体 `opacity + translateY(6px)`，`420ms`，只执行一次。
2. 状态响应：导航下划线、按钮按压、索引箭头和输入背景使用 `120–220ms`。
3. 浮层与模式：搜索建议、评论抽屉、行内编辑和 Diff 展开使用 `220–420ms` 的 `opacity / transform`。

不做弹跳、漂浮、视差、循环装饰、全页面滚动入场或 `transition: all`。焦点环立即出现，不参与过渡。`prefers-reduced-motion` 下空间位移折叠为不超过 `150ms` 的透明度反馈。

## 响应式与可访问性

- 移动优先，在 `40rem / 60rem / 90rem` 按内容需要增强布局。
- 必须人工检查 `320 / 375 / 414 / 768px`；`html` 与 `body` 均使用 `overflow-x: clip`。
- 导航、按钮、页脚链接、面包屑等可点击文字不得折成两行。
- 无鼠标时仍可完成全部操作；Hover 规则只写在 `@media (hover: hover) and (pointer: fine)` 中。
- 目标为 WCAG AA。正文对比度至少 `4.5:1`，大字、图标和焦点至少 `3:1`。
- 使用正确地标、标题层级、键盘顺序、`aria-live` 和表单错误关联；波形与图片必须有替代说明。

## Exports

### 1. CSS（源文件）

完整源文件为 `frontend/tokens.css`。页面只能引用该文件中的命名 token。

### 2. Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(97.5% 0.009 150);
  --color-paper-2: oklch(94.5% 0.014 150);
  --color-paper-3: oklch(91% 0.018 150);
  --color-ink: oklch(22% 0.025 155);
  --color-neutral: oklch(38% 0.022 155);
  --color-muted: oklch(47% 0.019 155);
  --color-rule: oklch(86% 0.018 150);
  --color-accent: oklch(46% 0.115 151);
  --color-accent-ink: oklch(98% 0.008 150);
  --color-focus: oklch(12% 0.02 151);
  --font-display: "Noto Serif SC", "Source Han Serif SC", ui-serif, serif;
  --font-body: "Noto Sans SC", "Source Han Sans SC", ui-sans-serif, sans-serif;
  --font-outlier: "JetBrains Mono", ui-monospace, monospace;
  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --spacing-2xl: 4.5rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.563rem;
  --text-2xl: 1.953rem;
  --radius-card: 0.25rem;
  --radius-input: 0.25rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 1, 0.35, 1);
}
```

### 3. DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(97.5% 0.009 150)", "$type": "color" },
    "paper-2": { "$value": "oklch(94.5% 0.014 150)", "$type": "color" },
    "ink": { "$value": "oklch(22% 0.025 155)", "$type": "color" },
    "neutral": { "$value": "oklch(38% 0.022 155)", "$type": "color" },
    "rule": { "$value": "oklch(86% 0.018 150)", "$type": "color" },
    "accent": { "$value": "oklch(46% 0.115 151)", "$type": "color" },
    "accent-ink": { "$value": "oklch(98% 0.008 150)", "$type": "color" },
    "focus": { "$value": "oklch(12% 0.02 151)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Noto Serif SC, Source Han Serif SC, ui-serif, serif", "$type": "fontFamily" },
    "body": { "$value": "Noto Sans SC, Source Han Sans SC, ui-sans-serif, sans-serif", "$type": "fontFamily" },
    "outlier": { "$value": "JetBrains Mono, ui-monospace, monospace", "$type": "fontFamily" }
  },
  "duration": {
    "micro": { "$value": "120ms", "$type": "duration" },
    "short": { "$value": "220ms", "$type": "duration" },
    "long": { "$value": "420ms", "$type": "duration" }
  }
}
```

### 4. shadcn/ui 映射

```css
:root {
  --background: 97.5% 0.009 150;
  --foreground: 22% 0.025 155;
  --card: 99% 0.004 150;
  --card-foreground: 22% 0.025 155;
  --popover: 99% 0.004 150;
  --popover-foreground: 22% 0.025 155;
  --primary: 46% 0.115 151;
  --primary-foreground: 98% 0.008 150;
  --secondary: 91% 0.018 150;
  --secondary-foreground: 30% 0.024 155;
  --muted: 94.5% 0.014 150;
  --muted-foreground: 47% 0.019 155;
  --accent: 46% 0.115 151;
  --accent-foreground: 98% 0.008 150;
  --destructive: 48% 0.15 28;
  --destructive-foreground: 98% 0.008 150;
  --border: 86% 0.018 150;
  --input: 68% 0.025 150;
  --ring: 12% 0.02 151;
  --radius: 0.25rem;
}
```
