# 渠道证据截图清单

提交前将截图放入本目录，截图中不得出现 App Secret、API Key、Gateway Token 或设备令牌。

## 已归档截图

1. `01-feishu-full-pipeline-1.png`
   - 展示 collector、organizer、graph 和 qa 的处理结果。
   - 包含摘要、分类、标签、`stored: true`、`knowledge_id` 和问答引用来源。

2. `01-feishu-full-pipeline-2.png`
   - 展示 recommender 推荐结果与 steward 总控总结。
   - 包含五个 Agent 的真实调用方式以及全链路验收结论。

3. `04-tests-passed.png`
   - 终端运行 `python3 -m unittest discover -s tests -v`。
   - 截图包含 13 项测试、`OK` 和测试数量。

4. `05-github-repository.png`
   - GitHub 仓库首页。
   - 画面包含仓库名、README 和最新提交。

## 可选加分截图

- `06-agent-skill-ready.png`：五个自定义 Skill 均显示 `Ready`。
- `07-sqlite-search.png`：SQLite 检索返回真实知识条目。
- `08-feishu-error-handling.png`：查询不存在内容时明确说明未找到。
