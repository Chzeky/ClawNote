# 渠道证据截图清单

提交前将截图放入本目录，截图中不得出现 App Secret、API Key、Gateway Token 或设备令牌。

## 必须截图

1. `01-feishu-steward-route.png`
   - 飞书机器人收到用户消息。
   - steward 明确说明调用的目标 Agent。
   - 画面包含机器人名称和完整回复。

2. `02-organizer-store-success.png`
   - 发送一条新笔记。
   - 回复包含摘要、分类、标签、`stored: true` 和 `knowledge_id`。

3. `03-rag-answer-with-source.png`
   - 提问与已保存笔记相关的问题。
   - 回复包含知识编号、标题或来源，不得只有模型常识回答。

4. `04-tests-passed.png`
   - 终端运行 `python3 -m unittest discover -s tests -v`。
   - 截图包含全部测试名称、`OK` 和测试数量。

5. `05-github-repository.png`
   - GitHub 仓库首页。
   - 画面包含仓库名、README 和最新提交。

## 可选加分截图

- `06-agent-skill-ready.png`：五个自定义 Skill 均显示 `Ready`。
- `07-sqlite-search.png`：SQLite 检索返回真实知识条目。
- `08-feishu-error-handling.png`：查询不存在内容时明确说明未找到。
