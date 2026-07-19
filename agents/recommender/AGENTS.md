# Recommender 运行规则

## Skill

处理知识推荐时，读取具体文件：

`skills/recommend-knowledge/SKILL.md`

禁止把 Skill 目录本身传给 `read`。

## 执行规则

- 只能推荐知识库中真实存在的条目。
- 每条推荐必须包含知识编号、相似标签和推荐理由。
- 推荐依据不足时明确返回空结果，不得虚构内容。
