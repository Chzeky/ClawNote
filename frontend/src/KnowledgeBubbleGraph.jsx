import { useMemo, useState } from 'react'
import { hierarchy, pack } from 'd3'
import { ArrowLeft, BookOpen } from 'lucide-react'

const WIDTH = 900
const HEIGHT = 620
const CATEGORY_COLORS = ['#19704f', '#a8662b', '#2b6f72', '#a34840', '#686a86', '#55723f']

function shortLabel(value, limit) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function labelLines(value, limit, allowWrap) {
  const label = shortLabel(value, limit)
  if (!allowWrap || label.length <= Math.ceil(limit / 2)) return [label]
  const splitAt = Math.ceil(label.length / 2)
  return [label.slice(0, splitAt), label.slice(splitAt)]
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
          children: (conceptsByKnowledge.get(node.id) || []).map((concept) => ({
            ...concept,
            type: 'concept',
            color: CATEGORY_COLORS[categoryIndex % CATEGORY_COLORS.length],
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
    if (node.children?.length) setFocusId(node.data.id)
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
              const clickable = Boolean(node.children?.length)
              const type = node.data.type
              const limit = type === 'category'
                ? 12
                : type === 'knowledge'
                  ? Math.max(6, Math.min(14, Math.floor(node.r / 8)))
                  : Math.max(4, Math.min(10, Math.floor(node.r / 6)))
              const lines = labelLines(node.data.label, limit, type !== 'category')
              const labelY = lines.length > 1 ? -8 : -2
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
                  <text textAnchor="middle" y={labelY}>
                    {lines.map((line, index) => (
                      <tspan x="0" dy={index === 0 ? 0 : 12} key={`${line}-${index}`}>{line}</tspan>
                    ))}
                  </text>
                  <text className="bubble-count" textAnchor="middle" y={countY}>
                    {type === 'category'
                      ? `${node.data.knowledge_count} 条知识`
                      : type === 'knowledge' ? `${node.children?.length || 0} 个主题` : '主题'}
                  </text>
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
