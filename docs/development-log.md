# ClawNote 开发日志

## 2026-07-18：项目设计与 Agent 拆分

- 确定选题为“个人智能知识管家”。
- 将系统拆分为 steward、collector、organizer、graph、qa、recommender 六个 Agent。
- 决定由 steward 作为飞书唯一入口，其他 Agent 作为专业执行单元。
- 为避免职责交叉，明确每个 Agent 的输入、输出、异常处理和行为边界。

## 2026-07-18：飞书渠道与网络问题

- 问题：WSL 无法直连飞书和 DeepSeek，长连接和模型请求出现超时。
- 原因：WSL 直连不可用，Gateway 服务未正确使用代理；代理最初允许访问 loopback。
- 解决：为 OpenClaw 配置代理，并拒绝 `127.0.0.0/8`、`169.254.0.0/16`，代理验证通过。
- 结果：飞书机器人可以接收消息并路由到 `clawnote-steward`。

## 2026-07-18：多 Agent 调度问题

- 问题：steward 声称调用 organizer，但没有真实工具记录。
- 原因：缺少 `sessions_spawn`、`sessions_yield`、`subagents` 权限，且 Agent 出现过虚构调用。
- 解决：增加子 Agent 白名单和工具真实性规则；没有工具结果时禁止声称调用成功。
- 结果：steward 可以通过真实 Agent 调用获得 organizer 结果。

## 2026-07-19：Skill 结构调整

- 问题：原有 Skill 是平铺 Markdown，OpenClaw 无法自动识别。
- 决策：将 9 个细分说明合并为 5 个综合 Skill。
- 结构：每个业务 Agent workspace 下使用 `skills/<name>/SKILL.md`。
- 验证：`openclaw skills info <name> --agent <id>` 返回 `Ready`。

## 2026-07-19：SQLite 知识库

- 选择 SQLite，原因是零服务部署、便于演示、支持事务与 FTS5。
- 使用 `knowledge_items` 保存正文、摘要、分类、标签和来源。
- 使用 `knowledge_fts` 提供全文检索，并通过触发器同步索引。
- 使用 Python `sqlite3` 的 `?` 占位符实现参数化查询，防止 SQL 注入。

## 2026-07-19：权限与设备修复

- 问题：organizer 被 `deny: exec` 限制，无法执行数据库脚本。
- 解决：按最小权限原则仅为 organizer 开放 `read/write/exec`。
- 问题：Gateway 出现 scope upgrade pending approval。
- 解决：使用完整 Request ID 批准本机 CLI 设备权限升级。

## 2026-07-19：提交材料整理

- 更新脱敏 `config.json` 和 `permissions.json`。
- 新增确定性的文本、文件和网页采集脚本。
- 新增数据库、采集、Skill 结构和安全性自动测试。
- 补齐 README、测试报告和飞书截图清单。

## 2026-07-19：中文检索兼容

- 问题：SQLite FTS5 的 `unicode61` 对中文子串检索支持有限。
- 解决：保留 FTS5 为首选检索；零结果时使用带转义的参数化 `LIKE` 查询标题、正文、摘要和标签。
- 结果：中文关键词可以命中，返回值中的 `search_mode` 会注明 `fts5` 或 `like_fallback`。

## 2026-07-19：组员复现与路径可移植性

- 问题：Agent 指令中包含开发者专属的绝对 home 路径，其他 WSL 用户无法直接运行。
- 解决：统一改为从 Agent workspace 出发的 `../../scripts/...` 相对路径。
- 验证：增加仓库路径可移植性测试，确保提交文件不再包含用户专属 home 路径。

## 2026-07-19：课程 TypeScript Skill 规范对齐

- 差异：OpenClaw 使用 `SKILL.md` 发现能力，课程规范还要求 `index.ts`、`types.ts`、`utils.ts`、`README.md` 和独立配置。
- 决策：保留原生 `SKILL.md`，为五个业务 Skill 增加 TypeScript 可执行层，形成双层兼容结构。
- 复用：collector、organizer 和 qa 使用 `execFile` 参数数组调用既有 Python 工具，避免 shell 字符串拼接和重复实现数据库逻辑。
- 算法：graph 增加带原句证据的实体共现基线；recommender 增加标签 Jaccard 相似度、排除和稳定排序。
- 测试：新增 Jest 单元、边界、安全、性能测试及 TypeScript 到 Python 的真实采集集成测试。
- 结果：TypeScript 严格类型检查通过，6 个 Jest 套件共 19 项测试通过，Python 回归测试增至 14 项并全部通过。
