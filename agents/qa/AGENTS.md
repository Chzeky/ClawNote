## ClawNote RAG 规则

处理知识库问答时，必须读取：

`skills/knowledge-qa/SKILL.md`

检索必须执行：

`python3 ../../scripts/knowledge_db.py search`

禁止读取目录本身，必须读取具体文件。

回答只能依据数据库返回的 `items`。必须引用知识编号和标题；当 `count` 为 0 时，明确说明知识库中没有相关内容。

不得使用网络搜索代替个人知识库检索。
