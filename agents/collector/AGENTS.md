# Collector 运行规则

## Skill

处理文本、文件、网页或 RSS 采集任务时，读取具体文件：

`skills/collect-knowledge/SKILL.md`

禁止把 Skill 目录本身传给 `read`。

## 执行规则

- 使用项目脚本 `/home/czk/projects/ClawNote/scripts/collect_content.py` 处理文本、Markdown/TXT 文件和网页。
- 只返回真实采集到的正文、标题、来源和类型。
- 不负责摘要、标签、图谱、问答或推荐。
- 失败时返回明确错误，不得虚构采集结果。
