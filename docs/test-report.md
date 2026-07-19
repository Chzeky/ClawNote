# ClawNote 测试报告

## 基本信息

- 测试日期：2026-07-19
- 测试环境：WSL Ubuntu、Python 3、Node.js 24、TypeScript、SQLite FTS5、OpenClaw 2026.6.11
- Python 测试命令：`.venv/bin/python -m unittest discover -s tests -v`
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
| TC-17 | 解析 OpenClaw 外层响应与 Markdown 围栏中的 JSON 草稿 | 通过 |
| TC-18 | organizer 输出缺少字段或字段非法时拒绝接收 | 通过 |
| TC-19 | 草稿提示将用户正文标记为不可信 JSON 数据 | 通过 |
| TC-20 | 分析接口返回 organizer 草稿且不写入知识库 | 通过 |
| TC-21 | 分析接口拒绝长度不足的正文 | 通过 |
| TC-22 | 上传 Markdown 文件并提取标题与正文 | 通过 |
| TC-23 | 拒绝不支持的上传文件扩展名 | 通过 |
| TC-24 | 文件采集 API 返回统一内容结构 | 通过 |
| TC-25 | URL 采集 API 拒绝 loopback 地址 | 通过 |
| TC-26 | 网页重定向到 loopback 时拒绝请求 | 通过 |
| TC-27 | 已配置代理时兼容 VPN Fake-IP 域名解析 | 通过 |
| TC-28 | 相同正文和标题提示复用 organizer 草稿缓存 | 通过 |
| TC-29 | QA 接口返回基于证据且带引用的回答 | 通过 |
| TC-30 | QA 接口拒绝长度不足的问题 | 通过 |
| TC-31 | 查询词提取会移除中文疑问填充词 | 通过 |
| TC-32 | RAG 检索优先返回相关知识并过滤低分条目 | 通过 |
| TC-33 | 严格解析 OpenClaw 外层响应中的 QA JSON | 通过 |
| TC-34 | QA 提示将问题和证据标记为不可信数据 | 通过 |
| TC-35 | 无检索证据时直接拒答且不调用模型 | 通过 |
| TC-36 | 网页提取聚焦正文并将 MathJax SVG 折叠为公式标记 | 通过 |
| TC-37 | 概览统计正确汇总分类、来源和高频标签 | 通过 |
| TC-38 | 图谱生成知识节点、主题实体和共现关系 | 通过 |
| TC-39 | 推荐按标签 Jaccard 相似度排序 | 通过 |
| TC-40 | 标签匹配大小写不敏感 | 通过 |
| TC-41 | 概览、图谱、推荐三个 Web API 端到端返回正确 | 通过 |

执行结果：

```text
Ran 41 tests

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
| IT-05 | Web 智能导入生成草稿，确认前数据库条目数不变 | 通过 | 本地 FastAPI 与 OpenClaw organizer 联调 |
| IT-06 | React Web MVP 桌面端和 390×844 移动端交互与布局 | 通过 | 本地浏览器人工验收 |
| IT-07 | 上传 Markdown 并返回统一采集内容 | 通过 | 本地 FastAPI 真实接口调用 |
| IT-08 | 抓取公网网页并生成 organizer 草稿预览 | 通过 | `example.com` 端到端浏览器验收 |
| IT-09 | 强化学习教程首次及缓存整理性能对照 | 通过 | 首次约 6.6 秒，缓存约 0.002 秒 |
| IT-10 | 新增表单刷新后恢复网页 URL 和处理状态 | 通过 | 本地浏览器强制刷新验收 |
| IT-11 | Web 智能问答检索知识 #9、生成回答并打开引用详情 | 通过 | 本地 FastAPI、OpenClaw qa 与 React 真实联调 |
| IT-12 | 强化学习教程重新采集后无 MathJax 中文逐字换行 | 通过 | 4373 字正文、3 个公式标记、无导航文本 |
| IT-13 | 工作台展示 8 条知识、5 个分类、27 个标签和 4 类来源 | 通过 | React 与真实 SQLite 联调 |
| IT-14 | Web 图谱渲染 32 个节点和 61 条关系 | 通过 | 本地浏览器 SVG 非空验证 |
| IT-15 | 推荐结果可从前端条目跳转到 FastAPI 知识详情 | 通过 | 本地浏览器交互验收 |

## 已知限制

- RSS 已定义采集流程，尚未实现定时拉取和去重。
- 知识图谱已有规则基线但尚未持久化，实体词表仍需扩展。
- 推荐当前为内容标签相似度，尚未积累协同过滤所需的用户行为数据。
- 当前 RAG 优先使用 SQLite FTS5，中文未命中时使用参数化 `LIKE` 兜底；该方案不是语义检索，后续可增加向量检索。
- Web 前端已支持工作台概览、知识浏览与 CRUD、带引用的 RAG 问答、知识图谱、标签相关推荐，以及文本、网页、文件三种 organizer 智能导入方式；完整五 Agent 流水线调度仍以飞书入口为主。

## 结论

ClawNote 的 Must have 数据链路、OpenClaw Skill 发现层和课程 TypeScript Skill 执行层均具备可执行源码与自动化测试。数据库参数化写入、全文检索、qa 引用、最小权限、渠道证据和五 Agent 完整调度均已验证。
