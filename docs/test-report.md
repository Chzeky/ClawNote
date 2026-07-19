# ClawNote 测试报告

## 基本信息

- 测试日期：2026-07-19
- 测试环境：WSL Ubuntu、Python 3、Node.js 24、TypeScript、SQLite FTS5、OpenClaw 2026.6.11
- Python 测试命令：`python3 -m unittest discover -s tests -v`
- TypeScript 测试命令：`npm test`

## 自动化测试结果

| 编号 | 测试内容 | 结果 |
|---|---|---|
| TC-01 | 采集用户文本并生成统一结构 | 通过 |
| TC-02 | 导入 UTF-8 Markdown 文件 | 通过 |
| TC-03 | HTML 正文提取并忽略脚本与样式 | 通过 |
| TC-04 | 拒绝 loopback/内网网页地址 | 通过 |
| TC-05 | 初始化 SQLite 与 FTS5 数据表 | 通过 |
| TC-06 | 参数化新增并按 ID 查询知识 | 通过 |
| TC-07 | 使用 FTS5 检索知识 | 通过 |
| TC-08 | SQL 注入字符串不会破坏数据表 | 通过 |
| TC-09 | 中文关键词未被 FTS5 命中时使用参数化 LIKE 兜底 | 通过 |
| TC-10 | 六个 Agent 均具有 SOUL/AGENTS 配置 | 通过 |
| TC-11 | 五个 Skill 目录与 frontmatter 名称一致 | 通过 |
| TC-12 | `config.json`、`permissions.json` 为有效 JSON | 通过 |
| TC-13 | 仓库不包含用户专属 `/home/<user>` 绝对路径 | 通过 |
| TC-14 | 五个 Skill 均包含 TypeScript 规范文件且配置 JSON 有效 | 通过 |
| TC-15 | FastAPI 知识新增、详情、修改、删除完整生命周期 | 通过 |
| TC-16 | 空更新请求和不存在知识正确返回 422/404 | 通过 |

执行结果：

```text
Ran 16 tests

OK
```

## TypeScript Skill 自动化测试

| 范围 | 覆盖内容 | 结果 |
|---|---|---|
| collector | 文本采集、空输入、SSRF/loopback 拒绝 | 通过 |
| organizer | 参数化入库、缺少标签、命令注入文本 | 通过 |
| graph | 实体抽取、同句关系证据、跨句不虚构关系 | 通过 |
| qa | 知识引用、空检索、恶意查询参数 | 通过 |
| recommender | 标签相似度、排除知识、空集合、性能基线 | 通过 |
| integration | TypeScript collector 调用真实 Python 采集脚本 | 通过 |

执行结果：

```text
TypeScript strict typecheck: passed
Test Suites: 6 passed, 6 total
Tests:       19 passed, 19 total
```

## OpenClaw Skill 检查

| Agent | Skill | 状态 |
|---|---|---|
| collector | collect-knowledge | Ready |
| organizer | organize-knowledge | Ready |
| graph | build-knowledge-graph | Ready |
| qa | knowledge-qa | Ready |
| recommender | recommend-knowledge | Ready |

## 人工集成测试

| 编号 | 测试场景 | 当前结果 | 证据 |
|---|---|---|---|
| IT-01 | 飞书消息路由到 steward | 通过 | `docs/evidence/01-feishu-full-pipeline-1.png` |
| IT-02 | organizer 整理并写入 SQLite | 通过 | `docs/evidence/01-feishu-full-pipeline-1.png` |
| IT-03 | qa 检索后回答并引用知识编号 | 通过 | `docs/evidence/01-feishu-full-pipeline-1.png` |
| IT-04 | steward 调度五个业务 Agent 完成闭环 | 通过 | `docs/evidence/01-feishu-full-pipeline-2.png` |

## 已知限制

- RSS 已定义采集流程，尚未实现定时拉取和去重。
- 知识图谱已有规则基线但尚未持久化，实体词表仍需扩展。
- 推荐当前为内容标签相似度，尚未积累协同过滤所需的用户行为数据。
- 当前 RAG 优先使用 SQLite FTS5，中文未命中时使用参数化 `LIKE` 兜底；该方案不是语义检索，后续可增加向量检索。
- Web 前端与 FastAPI 接口已进入 MVP 开发阶段，完整 Agent 调度仍以飞书入口为主。

## 结论

ClawNote 的 Must have 数据链路、OpenClaw Skill 发现层和课程 TypeScript Skill 执行层均具备可执行源码与自动化测试。数据库参数化写入、全文检索、qa 引用、最小权限、渠道证据和五 Agent 完整调度均已验证。
