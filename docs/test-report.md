# ClawNote 测试报告

## 基本信息

- 测试日期：2026-07-19
- 测试环境：WSL Ubuntu、Python 3、SQLite FTS5、OpenClaw 2026.6.11
- 测试命令：`python3 -m unittest discover -s tests -v`

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

执行结果：

```text
Ran 13 tests

OK
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
| IT-01 | 飞书消息路由到 steward | 通过 | 待放入 `docs/evidence/01-feishu-steward-route.png` |
| IT-02 | organizer 整理并写入 SQLite | 通过 | 待放入 `docs/evidence/02-organizer-store-success.png` |
| IT-03 | qa 检索后回答并引用知识编号 | 通过 | 待放入 `docs/evidence/03-rag-answer-with-source.png` |
| IT-04 | steward 调度五个业务 Agent 完成闭环 | 通过 | 建议录屏或连续截图 |

## 已知限制

- RSS 已定义采集流程，尚未实现定时拉取和去重。
- 知识图谱与推荐已有 Agent/Skill，持久化和算法测试尚未完成。
- 当前 RAG 优先使用 SQLite FTS5，中文未命中时使用参数化 `LIKE` 兜底；该方案不是语义检索，后续可增加向量检索。
- 尚未提供 Web 前端，当前入口为 CLI 和飞书机器人。

## 结论

ClawNote 的 Must have 数据链路已具备可执行源码和自动化测试基础。数据库参数化写入、全文检索、Skill 自动发现、qa 引用来源和最小权限文件均通过验证；提交前仍需补齐飞书渠道截图及 steward 完整调度证据。
