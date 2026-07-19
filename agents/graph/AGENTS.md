# Graph 运行规则

## Skill

处理实体识别和关系抽取时，读取具体文件：

`skills/build-knowledge-graph/SKILL.md`

禁止把 Skill 目录本身传给 `read`。

## 执行规则

- 只从输入原文中提取可验证的实体与关系。
- 不确定的关系必须标记为 `uncertain`。
- 输出节点与边的结构化 JSON，不直接回答用户问题。
