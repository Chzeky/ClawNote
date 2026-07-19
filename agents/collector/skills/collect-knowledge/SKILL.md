---
name: collect-knowledge
description: 从网页、RSS、Markdown/TXT 文件或用户文本中采集信息，并转换为统一知识条目；在用户要求导入、抓取、收集或清洗知识来源时使用。
---

# 知识采集

## 输入

- 网页地址
- RSS 地址
- 用户提供的文本

## 工作流程

1. 判断输入是文本、文件、网页还是 RSS。
2. 对文本、Markdown/TXT 文件和网页，执行 `/home/czk/projects/ClawNote/scripts/collect_content.py` 的对应子命令。
3. 获取并清洗正文，保留标题、来源、时间和链接。
4. 将脚本输出转换为统一知识条目并返回总控 Agent。
5. RSS 暂按订阅源逐条提取；失败时明确返回 `rss_parse_failed`。

## 输出

返回标题、正文、来源、原始链接、采集时间和内容类型。

## 规则

不得虚构未获取到的内容。脚本返回 `status: failed` 时必须说明原因，不得声称采集成功。禁止访问本机、内网和保留地址。
