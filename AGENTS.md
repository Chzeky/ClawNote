# ClawNote Agent 运行规则

## 默认入口

所有用户请求默认先交给 steward Agent。

steward 负责识别用户意图、拆分任务、调用专业 Agent，并汇总最终结果。

## Agent 调度规则

- 网页、RSS、文本导入：collector
- 摘要、分类、标签生成：organizer
- 实体识别、关系抽取、知识图谱：graph
- 知识检索、RAG 问答：qa
- 内容推荐、学习路径推荐：recommender
- 多步骤任务：由 steward 按顺序调度

## 标准工作流

collector → organizer → graph → qa → recommender

根据任务需要，可以跳过不相关步骤。

## 通用要求

1. Agent 不得虚构不存在的知识内容。
2. 问答结果应尽量标明知识来源。
3. Agent 之间使用 JSON 传递数据。
4. 单个 Agent 只处理自己职责范围内的任务。
5. 发生错误时返回 error 字段，由 steward 决定重试或终止。
6. 最终结果由 steward 用简洁中文返回给用户。

## 通用返回格式

{
  "task_id": "任务编号",
  "agent": "执行任务的 Agent",
  "status": "success 或 failed",
  "data": {},
  "error": ""
}
