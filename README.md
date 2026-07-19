# ClawNote

ClawNote 是一个基于 OpenClaw 多 Agent 协作的个人智能知识管家。系统支持知识采集、摘要与标签、SQLite 存储、全文检索、RAG 问答、知识图谱和标签推荐。

## 项目状态

当前版本已跑通最小核心闭环：

```text
用户输入 -> steward 调度 -> organizer 整理 -> SQLite 存储
                                      -> qa 检索 -> RAG 回答与引用
```

网页/RSS、图谱和推荐已完成 Agent/Skill 设计，其中网页与文本采集已有确定性脚本；图谱持久化、RSS 定时任务、推荐算法和 Web 前端属于下一阶段。

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
| Must | RAG 问答 | qa Skill 已实现，要求引用知识编号 |
| Should | RSS 采集 | Skill 已定义，定时执行待完善 |
| Should | 知识图谱 | Agent/Skill 已定义，持久化待完善 |
| Should | 问答引用来源 | 已实现知识编号、标题和来源规则 |
| Should | 标签相似度推荐 | Agent/Skill 已定义，算法待完善 |

## 目录结构

```text
ClawNote/
├── agents/             # 六个 Agent 的身份、运行规则和 Skill
├── database/init.sql   # SQLite 表、FTS5 索引和同步触发器
├── scripts/            # 采集与知识库命令行工具
├── tests/              # 自动化测试
├── docs/               # 开发日志、测试报告和渠道证据
├── config.json         # 项目级脱敏配置
└── permissions.json    # Agent 最小权限策略（脱敏）
```

## 环境要求

- WSL/Ubuntu
- Python 3.10+
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

```bash
python3 -m unittest discover -s tests -v
```

测试覆盖数据库初始化、参数化写入、SQL 注入防护、FTS5 检索、中文 `LIKE` 兜底检索、内容采集和 Skill 目录结构。

## 安全说明

- 仓库不包含 App Secret、API Key、Gateway Token 或设备令牌。
- OpenClaw 真实运行配置保存在 `~/.openclaw/openclaw.json`，不得提交。
- `data/*.db`、运行日志、会话记忆和 workspace 状态已加入 `.gitignore`。
- 网页采集拒绝本机、内网和保留地址，降低 SSRF 风险。
- 检索优先使用 SQLite FTS5；中文关键词未命中时自动使用参数化 `LIKE` 兜底。

## 渠道

飞书机器人绑定 `clawnote-steward`，用于随手记录、任务调度和知识库问答。截图证据清单见 `docs/evidence/README.md`。
