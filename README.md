# ClawNote

ClawNote 是一个基于 OpenClaw 多 Agent 协作的个人智能知识管家。系统支持知识采集、摘要与标签、SQLite 存储、全文检索、RAG 问答、知识图谱和标签推荐。

## 项目状态

当前版本已跑通最小核心闭环：

```text
用户输入 -> steward 调度 -> organizer 整理 -> SQLite 存储
                                      -> qa 检索 -> RAG 回答与引用
```

网页与文本采集已有确定性脚本；Web MVP 支持知识搜索、详情、增删改查，并可通过粘贴文本、抓取网页或上传 TXT/Markdown 导入内容，再由 organizer 自动生成标题、摘要、分类和标签草稿。Web 智能问答会先从 SQLite 检索证据，再由 qa Agent 生成带知识编号和来源链接的回答。知识图谱具备基于实体共现和原句证据的基线实现，推荐具备标签 Jaccard 相似度算法。RSS 定时任务和图谱持久化仍在迭代。

## Agent 与 Skill

| Agent | Skill | 职责 |
|---|---|---|
| `clawnote-steward` | 调度规则 | 识别意图、拆分任务、调度和汇总 |
| `clawnote-collector` | `collect-knowledge` | 文本、文件、网页和 RSS 采集 |
| `clawnote-organizer` | `organize-knowledge` | 摘要、分类、标签和知识入库 |
| `clawnote-graph` | `build-knowledge-graph` | 实体识别和关系抽取 |
| `clawnote-qa` | `knowledge-qa` | SQLite 全文检索和 RAG 回答 |
| `clawnote-recommender` | `recommend-knowledge` | 标签相似度推荐 |

## MoSCoW 功能

| 优先级 | 功能 | 当前状态 |
|---|---|---|
| Must | 总控 Agent 调度 | 已配置并完成真实 Agent 调用验证 |
| Must | 文本/网页导入 | 文本、Markdown/TXT、网页脚本已实现 |
| Must | 摘要与标签 | organizer Skill 已实现 |
| Must | 知识库存储 | SQLite 参数化写入已实现 |
| Must | 基础检索 | SQLite FTS5 已实现 |
| Must | RAG 问答 | Web 与飞书均已实现，回答引用知识编号与来源 |
| Should | RSS 采集 | Skill 已定义，定时执行待完善 |
| Should | 知识图谱 | 实体共现基线已实现，持久化待完善 |
| Should | 问答引用来源 | 已实现知识编号、标题和来源规则 |
| Should | 标签相似度推荐 | Jaccard 标签相似度与排序已实现 |

## Skill 开发规范

每个业务 Skill 同时保留两层实现：

- `SKILL.md`：OpenClaw 原生能力说明，用于自动发现和 Agent 行为约束。
- TypeScript 执行层：符合课程规范，提供强类型、配置分离、错误日志和 Jest 测试。

```text
skills/<kebab-case-name>/
├── SKILL.md
├── index.ts
├── types.ts
├── utils.ts
├── config.json
├── README.md
└── __tests__/index.test.ts
```

collector、organizer 和 qa 使用 `execFile` 参数数组调用现有 Python 工具，不拼接 shell 命令；graph 和 recommender 使用可重复测试的确定性算法。

## 目录结构

```text
ClawNote/
├── agents/             # 六个 Agent 的身份、运行规则和 Skill
├── database/init.sql   # SQLite 表、FTS5 索引和同步触发器
├── scripts/            # 采集与知识库命令行工具
├── tests/              # 自动化测试
├── skill-tests/        # TypeScript 与 Python 跨语言集成测试
├── backend/            # FastAPI Web API 与 OpenClaw organizer 适配器
├── frontend/           # React 知识管理 Web MVP
├── docs/               # 开发日志、测试报告和渠道证据
├── config.json         # 项目级脱敏配置
├── permissions.json    # Agent 最小权限策略（脱敏）
└── package.json        # TypeScript Skill 测试与类型检查
```

## 环境要求

- WSL/Ubuntu
- Python 3.10+
- Node.js 20+
- SQLite 3（需启用 FTS5）
- OpenClaw 2026.6.11+

## 快速开始

初始化数据库：

```bash
python3 scripts/knowledge_db.py init
```

采集文本：

```bash
python3 scripts/collect_content.py text \
  --title "RAG 基础" \
  --content "RAG 通过检索知识库增强大模型回答。"
```

参数化写入知识：

```bash
python3 scripts/knowledge_db.py add \
  --title "RAG 基础" \
  --content "RAG 通过检索知识库增强大模型回答。" \
  --summary "RAG 使用外部知识增强回答。" \
  --category "AI 技术" \
  --tag "RAG" --tag "大模型"
```

检索知识：

```bash
python3 scripts/knowledge_db.py search --query "RAG" --limit 5
```

## 测试

Python 核心逻辑、Web API 与项目结构：

```bash
.venv/bin/python -m unittest discover -s tests -v
```

TypeScript Skill：

```bash
npm install
npm test
```

测试覆盖数据库初始化、参数化写入、CRUD API、AI 草稿解析与只读隔离、RAG 证据检索与严格输出、SQL/命令注入防护、SSRF 边界、FTS5 检索、中文 `LIKE` 兜底、网页正文与 MathJax 清洗、引用来源、图谱关系、标签推荐、性能基线和 Skill 目录结构。当前 Python 36 项、TypeScript/Jest 19 项测试全部通过。

## 安全说明

- 仓库不包含 App Secret、API Key、Gateway Token 或设备令牌。
- OpenClaw 真实运行配置保存在 `~/.openclaw/openclaw.json`，不得提交。
- `data/*.db`、运行日志、会话记忆和 workspace 状态已加入 `.gitignore`。
- 网页采集拒绝本机、内网和保留地址，降低 SSRF 风险。
- 网页重定向会逐次重新校验目标；VPN Fake-IP 仅在已配置代理时兼容，并继续拒绝显式内网 IP。
- 上传文件仅接受 UTF-8 `.txt`/`.md`，单个文件最大 2 MiB。
- 检索优先使用 SQLite FTS5；中文关键词未命中时自动使用参数化 `LIKE` 兜底。
- 智能导入把用户正文标记为不可信数据；organizer 仅返回严格校验的草稿，用户确认后才写入数据库。
- organizer 使用精简输出和 64 条内存 LRU 草稿缓存；相同正文与标题提示的重复整理无需再次请求模型。
- 新增知识表单使用浏览器会话草稿恢复，开发热更新或意外刷新后可恢复网址、原文和 AI 预览。
- Web RAG 由后端确定性检索证据，qa Agent 只能基于所给证据回答；无证据时不会调用模型或虚构答案。
- 网页采集优先提取 `article`、`main` 或 Markdown 正文，忽略导航、脚本及 MathJax SVG，并以 `[数学公式]` 标记公式位置。

## 渠道

飞书机器人绑定 `clawnote-steward`，用于随手记录、任务调度和知识库问答。截图证据清单见 `docs/evidence/README.md`。
