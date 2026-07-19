import { useMemo, useState } from 'react'
import { hierarchy, pack } from 'd3'
import { ArrowLeft, BookOpen } from 'lucide-react'

const WIDTH = 900
const HEIGHT = 620
const CATEGORY_COLORS = ['#19704f', '#a8662b', '#2b6f72', '#a34840', '#686a86', '#55723f']
const MAX_CONCEPTS_PER_KNOWLEDGE = 10
const LABEL_STYLE = {
  category: { max: 12, size: 16, lineGap: 15, countSize: 9 },
  knowledge: { max: 14, size: 11, lineGap: 12, countSize: 8.5 },
  concept: { max: 18, size: 7.2, lineGap: 8.4, countSize: 0 },
}

function shortLabel(value, limit) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function labelLines(value, limit, allowWrap) {
  const label = shortLabel(value, limit)
  if (!allowWrap || label.length <= Math.ceil(limit / 2)) return [label]
  const splitAt = Math.ceil(label.length / 2)
  return [label.slice(0, splitAt), label.slice(splitAt)]
}

function charWidth(char, fontSize) {
  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char)) return fontSize * 0.96
  if (/[A-Z0-9]/.test(char)) return fontSize * 0.68
  if (/[a-z]/.test(char)) return fontSize * 0.56
  if (/\s/.test(char)) return fontSize * 0.34
  return fontSize * 0.5
}

function textWidth(value, fontSize) {
  return [...value].reduce((total, char) => total + charWidth(char, fontSize), 0)
}

function wrapByWidth(value, fontSize, maxWidth, maxLines) {
  const chars = [...value]
  const lines = []
  let current = ''
  for (const char of chars) {
    const next = `${current}${char}`
    if (current && textWidth(next, fontSize) > maxWidth) {
      lines.push(current)
      current = char.trimStart()
      if (lines.length === maxLines) break
    } else {
      current = next
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return {
    lines,
    complete: lines.join('') === value,
  }
}

function fitConceptLabel(value, radius) {
  const maxWidth = radius * 1.58
  const maxHeight = radius * 1.34
  const maxLines = radius < 20 ? 2 : radius < 34 ? 3 : 4
  const maxFont = Math.min(8.2, Math.max(5.2, radius / 4.2))
  const minFont = radius < 18 ? 3.6 : 4.2

  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 0.25) {
    const lineGap = fontSize * 1.14
    const wrapped = wrapByWidth(value, fontSize, maxWidth, maxLines)
    const tallestLine = Math.max(...wrapped.lines.map((line) => textWidth(line, fontSize)))
    const textHeight = wrapped.lines.length * lineGap
    if (wrapped.complete && tallestLine <= maxWidth && textHeight <= maxHeight) {
      return { lines: wrapped.lines, fontSize, lineGap }
    }
  }

  const fontSize = minFont
  const lineGap = fontSize * 1.12
  const wrapped = wrapByWidth(value, fontSize, maxWidth, maxLines)
  const lines = [...wrapped.lines]
  if (!wrapped.complete && lines.length) {
    let lastLine = lines[lines.length - 1]
    while (lastLine.length > 1 && textWidth(`${lastLine}…`, fontSize) > maxWidth) {
      lastLine = lastLine.slice(0, -1)
    }
    lines[lines.length - 1] = `${lastLine}…`
  }
  return { lines: lines.length ? lines : [value.slice(0, 1)], fontSize, lineGap }
}

function buildHierarchy(graph) {
  const knowledgeNodes = graph.nodes.filter((node) => node.type === 'knowledge')
  const concepts = new Map(
    graph.nodes.filter((node) => node.type === 'concept').map((node) => [node.id, node]),
  )
  const conceptsByKnowledge = new Map()
  graph.links.filter((link) => link.type === 'has_concept').forEach((link) => {
    const values = conceptsByKnowledge.get(link.source) || []
    const concept = concepts.get(link.target)
    if (concept) values.push(concept)
    conceptsByKnowledge.set(link.source, values)
  })

  return {
    id: 'root',
    label: '全部学科',
    type: 'root',
    children: graph.categories.map((category, categoryIndex) => ({
      ...category,
      type: 'category',
      color: CATEGORY_COLORS[categoryIndex % CATEGORY_COLORS.length],
      children: knowledgeNodes
        .filter((node) => category.knowledge_ids.includes(node.knowledge_id))
        .map((node) => ({
          ...node,
          type: 'knowledge',
          color: CATEGORY_COLORS[categoryIndex % CATEGORY_COLORS.length],
          children: (conceptsByKnowledge.get(node.id) || [])
            .slice(0, MAX_CONCEPTS_PER_KNOWLEDGE)
            .map((concept) => ({
              ...concept,
              type: 'concept',
              color: CATEGORY_COLORS[categoryIndex % CATEGORY_COLORS.length],
              knowledge_id: node.knowledge_id,
              value: Math.max(1, concept.weight),
            })),
        })),
    })),
  }
}

function nodeFill(node) {
  if (node.data.type === 'category') return node.data.color
  if (node.data.type === 'knowledge') return `${node.data.color}22`
  return `${node.data.color}18`
}

function nodeStroke(node) {
  return node.data.color || '#7c8a83'
}

export default function KnowledgeBubbleGraph({ graph, onOpenKnowledge }) {
  const [focusId, setFocusId] = useState('root')
  const root = useMemo(() => {
    const value = hierarchy(buildHierarchy(graph))
      .sum((node) => node.value || (node.type === 'concept' ? 1 : 0))
      .sort((left, right) => right.value - left.value)
    return pack().size([WIDTH, HEIGHT]).padding(10)(value)
  }, [graph])

  const focus = root.descendants().find((node) => node.data.id === focusId) || root
  const visibleNodes = focus.children || []
  const scale = Math.min(WIDTH, HEIGHT) / Math.max(1, focus.r * 2.08)
  const transform = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${scale}) translate(${-focus.x} ${-focus.y})`
  const path = focus.ancestors().reverse()

  function activateNode(node) {
    if (node.children?.length) {
      setFocusId(node.data.id)
      return
    }
    if (node.data.type === 'concept' && node.data.knowledge_id) {
      onOpenKnowledge(node.data.knowledge_id)
    }
  }

  function handleKeyDown(event, node) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateNode(node)
    }
  }

  return (
    <div className="bubble-graph">
      <div className="bubble-toolbar">
        <div className="bubble-breadcrumb" aria-label="图谱层级">
          {path.map((node, index) => (
            <span key={node.data.id}>
              {index > 0 && <i>/</i>}
              <button type="button" onClick={() => setFocusId(node.data.id)}>
                {node.data.label}
              </button>
            </span>
          ))}
        </div>
        <div className="bubble-actions">
          {focus.parent && (
            <button type="button" onClick={() => setFocusId(focus.parent.data.id)}>
              <ArrowLeft size={15} />返回上层
            </button>
          )}
          {focus.data.type === 'knowledge' && (
            <button type="button" className="open-knowledge"
              onClick={() => onOpenKnowledge(focus.data.knowledge_id)}>
              <BookOpen size={15} />查看详情
            </button>
          )}
        </div>
      </div>

      <div className="bubble-canvas">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="按学科分层的知识气泡图">
          <g transform={transform}>
            {visibleNodes.map((node) => {
              const clickable = Boolean(node.children?.length || (
                node.data.type === 'concept' && node.data.knowledge_id
              ))
              const type = node.data.type
              const style = LABEL_STYLE[type] || LABEL_STYLE.concept
              const limit = type === 'category'
                ? style.max
                : type === 'knowledge'
                  ? Math.max(6, Math.min(style.max, Math.floor(node.r / 8)))
                  : Math.max(3, Math.min(style.max, Math.floor(node.r / 7)))
              const fitted = type === 'concept' ? fitConceptLabel(node.data.label, node.r) : null
              const lines = fitted
                ? fitted.lines
                : labelLines(node.data.label, limit, type !== 'category')
              const labelY = type === 'concept'
                ? -((lines.length - 1) * fitted.lineGap) / 2
                : lines.length > 1 ? -8 : -2
              const fontSize = fitted?.fontSize || style.size
              const lineGap = fitted?.lineGap || style.lineGap
              const countY = lines.length > 1 ? 20 : Math.max(13, node.r / 7)
              return (
                <g key={node.data.id} className={`bubble-node ${type}`}
                  transform={`translate(${node.x} ${node.y})`}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => activateNode(node)}
                  onKeyDown={(event) => handleKeyDown(event, node)}>
                  <title>{node.data.label}</title>
                  <circle r={node.r} fill={nodeFill(node)} stroke={nodeStroke(node)} />
                  <text textAnchor="middle" y={labelY} dominantBaseline="middle"
                    style={{ fontSize }}>
                    {lines.map((line, index) => (
                      <tspan x="0" dy={index === 0 ? 0 : lineGap} key={`${line}-${index}`}>{line}</tspan>
                    ))}
                  </text>
                  {type !== 'concept' && (
                    <text className="bubble-count" textAnchor="middle" y={countY}
                      style={{ fontSize: style.countSize }}>
                      {type === 'category'
                        ? `${node.data.knowledge_count} 条知识`
                        : `${node.children?.length || 0} 个主题`}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
        {visibleNodes.length === 0 && (
          <div className="bubble-empty">当前层级没有可展开的主题。</div>
        )}
      </div>
    </div>
  )
}
