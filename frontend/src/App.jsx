import { useEffect, useState } from 'react'
import {
  AlignLeft, ArrowLeft, BookOpen, ChevronRight, CircleGauge, Compass,
  Database, FileUp, FolderTree, Layers3, Link2, MessageCircle, Network,
  Pencil, Plus, Save, Search, Send, Sparkles, Tag, Trash2, X,
} from 'lucide-react'
import './App.css'
import KnowledgeBubbleGraph from './KnowledgeBubbleGraph'

const API_BASE = 'http://127.0.0.1:8000'
const IMPORT_DRAFT_KEY = 'clawnote.import-draft'
const REQUEST_TIMEOUT_MS = 20000

const EMPTY_CREATE_FORM = {
  title: '',
  category: '未分类',
  summary: '',
  content: '',
  tags: '',
}

async function requestKnowledge(searchQuery = '') {
  const endpoint = searchQuery
    ? `${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}&limit=20`
    : `${API_BASE}/api/knowledge?limit=20`
  const response = await fetchWithTimeout(endpoint)
  if (!response.ok) throw new Error(`请求失败：${response.status}`)
  const data = await response.json()
  return data.items
}

async function requestInsights() {
  const [overviewResponse, graphResponse] = await Promise.all([
    fetchWithTimeout(`${API_BASE}/api/overview`),
    fetchWithTimeout(`${API_BASE}/api/graph?limit=30`),
  ])
  if (!overviewResponse.ok || !graphResponse.ok) {
    throw new Error('分析数据加载失败')
  }
  return Promise.all([overviewResponse.json(), graphResponse.json()])
}

async function requestRecommendations(knowledgeId) {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/recommendations?knowledge_id=${knowledgeId}&limit=8`,
  )
  const data = await response.json()
  if (!response.ok) throw new Error(responseError(data, response.status))
  return data
}

function createEditForm(item) {
  return {
    title: item.title,
    category: item.category,
    summary: item.summary || '',
    content: item.content,
    tags: item.tags.join(', '),
  }
}

function responseError(data, status) {
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) return data.detail.map((item) => item.msg).join('；')
  return `请求失败：${status}`
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查后端服务或网络代理后重试', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const EMPTY_SOURCE = {
  source: 'web_frontend',
  source_url: '',
  content_type: 'text',
}

function loadImportDraft() {
  try {
    const value = sessionStorage.getItem(IMPORT_DRAFT_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    sessionStorage.removeItem(IMPORT_DRAFT_KEY)
    return null
  }
}

const SAVED_IMPORT = loadImportDraft()

const NAV_ITEMS = [
  { id: 'overview', label: '工作台', icon: CircleGauge },
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'qa', label: '智能问答', icon: MessageCircle },
  { id: 'graph', label: '知识图谱', icon: Network },
  { id: 'recommendations', label: '相关推荐', icon: Compass },
]

function bestRecommendationSource(items) {
  const frequencies = new Map()
  items.forEach((item) => item.tags.forEach((tag) => {
    const key = tag.toLocaleLowerCase()
    frequencies.set(key, (frequencies.get(key) || 0) + 1)
  }))
  return items.find((item) => item.tags.some(
    (tag) => frequencies.get(tag.toLocaleLowerCase()) > 1,
  ))?.id || items[0]?.id || null
}

function truncateLabel(value, maxLength = 14) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function graphLayout(nodes) {
  const positions = new Map()
  const center = nodes.find((node) => node.role === 'focus')
  const concepts = nodes.filter((node) => node.type === 'concept')
  const related = nodes.filter((node) => node.type === 'knowledge' && node.role !== 'focus')
  if (center) positions.set(center.id, { x: 480, y: 260 })
  concepts.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, concepts.length)) * Math.PI * 2
    positions.set(node.id, {
      x: 480 + Math.cos(angle) * 145,
      y: 260 + Math.sin(angle) * 125,
    })
  })
  related.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, related.length)) * Math.PI * 2
    positions.set(node.id, {
      x: 480 + Math.cos(angle) * 330,
      y: 260 + Math.sin(angle) * 205,
    })
  })
  return positions
}

function buildFocusedRelationGraph(graph, knowledgeId) {
  const focusNode = graph.nodes.find((node) => (
    node.type === 'knowledge' && node.knowledge_id === knowledgeId
  ))
  if (!focusNode) return { nodes: [], links: [] }

  const conceptIds = graph.links
    .filter((link) => link.type === 'has_concept' && link.source === focusNode.id)
    .map((link) => link.target)
    .slice(0, 10)
  const conceptSet = new Set(conceptIds)
  const relatedScores = new Map()
  graph.links
    .filter((link) => (
      link.type === 'has_concept' &&
      conceptSet.has(link.target) &&
      link.source !== focusNode.id
    ))
    .forEach((link) => {
      relatedScores.set(link.source, (relatedScores.get(link.source) || 0) + 1)
    })
  const relatedIds = [...relatedScores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([id]) => id)
  const visibleIds = new Set([focusNode.id, ...conceptIds, ...relatedIds])
  const nodes = graph.nodes
    .filter((node) => visibleIds.has(node.id))
    .map((node) => ({
      ...node,
      role: node.id === focusNode.id ? 'focus' : relatedIds.includes(node.id) ? 'related' : 'concept',
    }))
  const links = graph.links.filter((link) => (
    link.type === 'has_concept' &&
    visibleIds.has(link.source) &&
    conceptSet.has(link.target)
  ))
  return { nodes, links }
}

function App() {
  const [activeView, setActiveView] = useState('overview')
  const [items, setItems] = useState([])
  const [overview, setOverview] = useState(null)
  const [graph, setGraph] = useState(null)
  const [graphMode, setGraphMode] = useState('bubbles')
  const [graphFocusId, setGraphFocusId] = useState(null)
  const [insightLoading, setInsightLoading] = useState(true)
  const [insightError, setInsightError] = useState('')
  const [recommendationId, setRecommendationId] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationError, setRecommendationError] = useState('')
  const [recommendationView, setRecommendationView] = useState('path')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [createOpen, setCreateOpen] = useState(Boolean(SAVED_IMPORT))
  const [creating, setCreating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [processingLabel, setProcessingLabel] = useState('')
  const [createStep, setCreateStep] = useState(SAVED_IMPORT?.createStep || 'input')
  const [importMode, setImportMode] = useState(SAVED_IMPORT?.importMode || 'text')
  const [createError, setCreateError] = useState('')
  const [titleHint, setTitleHint] = useState(SAVED_IMPORT?.titleHint || '')
  const [webUrl, setWebUrl] = useState(SAVED_IMPORT?.webUrl || '')
  const [selectedFile, setSelectedFile] = useState(null)
  const [importSource, setImportSource] = useState(SAVED_IMPORT?.importSource || EMPTY_SOURCE)
  const [importNotice, setImportNotice] = useState(SAVED_IMPORT?.importNotice || '')
  const [createForm, setCreateForm] = useState(SAVED_IMPORT?.createForm || EMPTY_CREATE_FORM)
  const [editForm, setEditForm] = useState({
    title: '',
    category: '',
    summary: '',
    content: '',
    tags: '',
  })
  const [question, setQuestion] = useState('')
  const [qaTurns, setQaTurns] = useState([])
  const [asking, setAsking] = useState(false)
  const [qaError, setQaError] = useState('')

  async function loadInsights() {
    setInsightLoading(true)
    setInsightError('')
    try {
      const [overviewData, graphData] = await requestInsights()
      setOverview(overviewData)
      setGraph(graphData)
    } catch (requestError) {
      setInsightError(requestError.message)
    } finally {
      setInsightLoading(false)
    }
  }

  async function loadKnowledge(searchQuery = '') {
    setLoading(true)
    setError('')

    try {
      const nextItems = await requestKnowledge(searchQuery)
      setItems(nextItems)
      setRecommendationId((current) => (
        current && nextItems.some((item) => item.id === current)
          ? current
          : bestRecommendationSource(nextItems)
      ))
      setGraphFocusId((current) => (
        current && nextItems.some((item) => item.id === current)
          ? current
          : bestRecommendationSource(nextItems)
      ))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    requestKnowledge()
      .then((nextItems) => {
        if (!cancelled) {
          setItems(nextItems)
          setRecommendationId(bestRecommendationSource(nextItems))
          setGraphFocusId(bestRecommendationSource(nextItems))
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    requestInsights()
      .then(([overviewData, graphData]) => {
        if (!cancelled) {
          setOverview(overviewData)
          setGraph(graphData)
        }
      })
      .catch((requestError) => {
        if (!cancelled) setInsightError(requestError.message)
      })
      .finally(() => {
        if (!cancelled) setInsightLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function loadRecommendations(knowledgeId) {
    if (!knowledgeId) return
    setRecommendationLoading(true)
    setRecommendationError('')
    try {
      setRecommendations(await requestRecommendations(knowledgeId))
    } catch (requestError) {
      setRecommendationError(requestError.message)
    } finally {
      setRecommendationLoading(false)
    }
  }

  function changeView(viewId) {
    setActiveView(viewId)
    if (viewId === 'recommendations') {
      const sourceId = recommendationId || bestRecommendationSource(items)
      if (sourceId && sourceId !== recommendationId) setRecommendationId(sourceId)
      loadRecommendations(sourceId)
    }
  }

  function changeRecommendation(knowledgeId) {
    setRecommendationId(knowledgeId)
    loadRecommendations(knowledgeId)
  }

  useEffect(() => {
    if (!detailOpen && !createOpen) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setDetailOpen(false)
        setCreateOpen(false)
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [detailOpen, createOpen])

  useEffect(() => {
    if (!createOpen) {
      sessionStorage.removeItem(IMPORT_DRAFT_KEY)
      return
    }
    sessionStorage.setItem(IMPORT_DRAFT_KEY, JSON.stringify({
      createStep,
      importMode,
      titleHint,
      webUrl,
      importSource,
      importNotice,
      createForm,
    }))
  }, [
    createOpen, createStep, importMode, titleHint, webUrl,
    importSource, importNotice, createForm,
  ])

  async function openDetail(knowledgeId) {
    setCreateOpen(false)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setSelectedItem(null)
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/knowledge/${knowledgeId}`)
      if (!response.ok) throw new Error(`请求失败：${response.status}`)
      const data = await response.json()
      setSelectedItem(data.item)
      setEditForm(createEditForm(data.item))
    } catch (requestError) {
      setDetailError(requestError.message)
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setDetailOpen(false)
    setSelectedItem(null)
    setDetailError('')
    setActionError('')
    setEditing(false)
  }

  function openCreate() {
    setDetailOpen(false)
    setCreateError('')
    setCreateStep('input')
    setImportMode('text')
    setTitleHint('')
    setWebUrl('')
    setSelectedFile(null)
    setImportSource(EMPTY_SOURCE)
    setImportNotice('')
    setProcessingLabel('')
    setCreateForm(EMPTY_CREATE_FORM)
    setCreateOpen(true)
  }

  function closeCreate() {
    if (creating || analyzing) return
    setCreateOpen(false)
    setCreateError('')
  }

  function handleCreateChange(event) {
    const { name, value } = event.target
    setCreateForm((current) => ({ ...current, [name]: value }))
  }

  function changeImportMode(mode) {
    setImportMode(mode)
    setCreateError('')
    setImportNotice('')
    setCreateForm((current) => ({ ...current, content: '' }))
  }

  async function prepareKnowledge(event) {
    event.preventDefault()
    setAnalyzing(true)
    setProcessingLabel(importMode === 'url' ? '正在抓取网页...' :
      importMode === 'file' ? '正在读取文件...' : 'AI 正在整理...')
    setCreateError('')
    setImportNotice('')
    try {
      let content = createForm.content.trim()
      let hint = titleHint.trim()
      let source = EMPTY_SOURCE

      if (importMode === 'url') {
        const collectResponse = await fetchWithTimeout(`${API_BASE}/api/collect/url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webUrl.trim() }),
        })
        const collected = await collectResponse.json()
        if (!collectResponse.ok) {
          throw new Error(responseError(collected, collectResponse.status))
        }
        content = collected.content
        hint = hint || collected.title
        source = {
          source: 'webpage',
          source_url: collected.source,
          content_type: 'webpage',
        }
        if (collected.truncated) setImportNotice('网页正文较长，已截取前 20000 字进行整理。')
      }

      if (importMode === 'file') {
        if (!selectedFile) throw new Error('请先选择文件')
        const formData = new FormData()
        formData.append('file', selectedFile)
        const collectResponse = await fetchWithTimeout(`${API_BASE}/api/collect/file`, {
          method: 'POST',
          body: formData,
        })
        const collected = await collectResponse.json()
        if (!collectResponse.ok) {
          throw new Error(responseError(collected, collectResponse.status))
        }
        content = collected.content
        hint = hint || collected.title
        source = {
          source: collected.source,
          source_url: '',
          content_type: 'file',
        }
        if (collected.truncated) setImportNotice('文件正文较长，已截取前 20000 字进行整理。')
      }

      setCreateForm((current) => ({ ...current, content }))
      setImportSource(source)
      setProcessingLabel('AI 正在整理...')

      const response = await fetchWithTimeout(`${API_BASE}/api/knowledge/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          title_hint: hint || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(responseError(data, response.status))
      setCreateForm((current) => ({
        ...current,
        title: data.title,
        summary: data.summary,
        category: data.category,
        tags: data.tags.join(', '),
      }))
      setCreateStep('preview')
    } catch (requestError) {
      setCreateError(requestError.message)
    } finally {
      setAnalyzing(false)
      setProcessingLabel('')
    }
  }

  async function createKnowledge(event) {
    event.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/knowledge/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          category: createForm.category.trim(),
          summary: createForm.summary.trim(),
          content: createForm.content.trim(),
          tags: createForm.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
          ...importSource,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(responseError(data, response.status))
      setCreateOpen(false)
      setNotice(`知识 #${data.knowledge_id} 已创建`)
      await Promise.all([loadKnowledge(query.trim()), loadInsights()])
      await openDetail(data.knowledge_id)
    } catch (requestError) {
      setCreateError(requestError.message)
    } finally {
      setCreating(false)
    }
  }

  function handleEditChange(event) {
    const { name, value } = event.target
    setEditForm((current) => ({ ...current, [name]: value }))
  }

  function startEditing() {
    setEditForm(createEditForm(selectedItem))
    setActionError('')
    setEditing(true)
  }

  function cancelEditing() {
    setEditForm(createEditForm(selectedItem))
    setActionError('')
    setEditing(false)
  }

  async function saveKnowledge(event) {
    event.preventDefault()
    setSaving(true)
    setActionError('')
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/knowledge/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          category: editForm.category.trim(),
          summary: editForm.summary.trim(),
          content: editForm.content.trim(),
          tags: editForm.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `请求失败：${response.status}`)
      setSelectedItem(data.item)
      setItems((current) => current.map((item) => (
        item.id === data.item.id
          ? { ...item, title: data.item.title, category: data.item.category, tags: data.item.tags }
          : item
      )))
      setEditing(false)
      setNotice(`知识 #${data.item.id} 已更新`)
      loadInsights()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteKnowledge() {
    if (!window.confirm(`确定删除“${selectedItem.title}”吗？此操作无法撤销。`)) return
    setDeleting(true)
    setActionError('')
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/knowledge/${selectedItem.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `请求失败：${response.status}`)
      setItems((current) => current.filter((item) => item.id !== selectedItem.id))
      setNotice(`知识 #${selectedItem.id} 已删除`)
      closeDetail()
      loadInsights()
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setDeleting(false)
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    loadKnowledge(query.trim())
  }

  function clearSearch() {
    setQuery('')
    loadKnowledge()
  }

  async function askKnowledge(event) {
    event.preventDefault()
    submitQuestion(question)
  }

  async function submitQuestion(questionText) {
    const nextQuestion = questionText.trim()
    if (!nextQuestion || asking) return
    setAsking(true)
    setQaError('')
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: nextQuestion }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(responseError(data, response.status))
      setQaTurns((current) => [...current, {
        id: crypto.randomUUID(),
        question: nextQuestion,
        ...data,
      }])
      setQuestion('')
    } catch (requestError) {
      setQaError(requestError.message)
    } finally {
      setAsking(false)
    }
  }

  const relationGraph = graph && graphFocusId
    ? buildFocusedRelationGraph(graph, graphFocusId)
    : { nodes: [], links: [] }
  const graphPositions = graphLayout(relationGraph.nodes)

  return (
    <main>
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark"><Layers3 size={22} /></span>
          <div><h1>ClawNote</h1><p>个人智能知识管家</p></div>
        </div>
        <div className="header-actions">
          <span className="system-status"><i />本地知识库在线</span>
          <button className="create-button" type="button" onClick={openCreate}>
            <Plus size={18} />新增知识
          </button>
        </div>
        <nav className="primary-nav" aria-label="主要功能">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} className={activeView === id ? 'active' : ''}
              onClick={() => changeView(id)}>
              <Icon size={17} />{label}
            </button>
          ))}
        </nav>
      </header>

      {activeView === 'overview' && (
        <section className="overview-page">
          <div className="page-heading">
            <div><span className="eyebrow">KNOWLEDGE OVERVIEW</span><h2>知识工作台</h2></div>
            <p>最近的内容、分类与知识主题</p>
          </div>

          {insightLoading && <p className="status-message">正在汇总知识库...</p>}
          {insightError && (
            <div className="error-message message-with-action">
              <span>加载失败：{insightError}</span>
              <button type="button" className="action-button" onClick={loadInsights}>重试</button>
            </div>
          )}
          {overview && !insightLoading && (
            <>
              <div className="stat-grid">
                <article><Database size={19} /><span>知识总量</span><strong>{overview.total}</strong></article>
                <article><FolderTree size={19} /><span>内容分类</span><strong>{overview.category_count}</strong></article>
                <article><Tag size={19} /><span>主题标签</span><strong>{overview.tag_count}</strong></article>
                <article><Link2 size={19} /><span>来源渠道</span><strong>{overview.source_count}</strong></article>
              </div>

              <div className="overview-grid">
                <section className="overview-panel recent-panel">
                  <div className="panel-heading"><h3>最近入库</h3>
                    <button type="button" onClick={() => setActiveView('knowledge')}>查看全部<ChevronRight size={15} /></button>
                  </div>
                  <div className="recent-list">
                    {overview.recent.map((item) => (
                      <button type="button" key={item.id} onClick={() => openDetail(item.id)}>
                        <span><strong>{item.title}</strong><small>{item.category}</small></span>
                        <time>{item.created_at?.slice(0, 10) || '未记录'}</time>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                  </div>
                </section>

                <section className="overview-panel distribution-panel">
                  <div className="panel-heading"><h3>分类分布</h3><span>{overview.category_count} 类</span></div>
                  <div className="distribution-list">
                    {overview.categories.map((category) => (
                      <div key={category.name}>
                        <span>{category.name}</span>
                        <i><b style={{ width: `${Math.max(8, category.count / overview.total * 100)}%` }} /></i>
                        <strong>{category.count}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="overview-panel topic-panel">
                  <div className="panel-heading"><h3>高频主题</h3><span>{overview.tag_count} 个标签</span></div>
                  <div className="topic-cloud">
                    {overview.top_tags.map((tag) => (
                      <button type="button" key={tag.name} onClick={() => {
                        setQuery(tag.name); setActiveView('knowledge'); loadKnowledge(tag.name)
                      }}>
                        {tag.name}<span>{tag.count}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </section>
      )}

      {activeView === 'knowledge' && <section>
        <div className="section-heading">
          <div><h2>知识库</h2><span>{items.length} 条知识</span></div>
          <div className="toolbar">
            <form className="search-form" onSubmit={handleSearch}>
              <div className="search-input">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索标题、正文或标签"
                  aria-label="搜索知识"
                />
                {query && (
                  <button type="button" className="icon-button" onClick={clearSearch}
                    title="清除搜索" aria-label="清除搜索">
                    <X size={18} />
                  </button>
                )}
              </div>
              <button type="submit" className="search-button">
                <Search size={18} /><span>搜索</span>
              </button>
            </form>
          </div>
        </div>

        {loading && <p className="status-message">正在加载知识...</p>}
        {notice && <p className="notice-message">{notice}</p>}
        {error && (
          <div className="error-message message-with-action">
            <span>加载失败：{error}</span>
            <button type="button" className="action-button"
              onClick={() => loadKnowledge(query.trim())}>重试</button>
          </div>
        )}
        {!loading && !error && items.length === 0 &&
          <p className="status-message">没有找到相关知识。</p>}

        {!loading && !error && items.length > 0 && (
          <ul className="knowledge-list">
            {items.map((item) => (
              <li key={item.id}>
                <button className="knowledge-row" type="button" onClick={() => openDetail(item.id)}>
                  <div className="knowledge-title">
                    <strong>{item.title}</strong><small>知识 #{item.id}</small>
                  </div>
                  <span className="category">{item.category}</span>
                  <div className="tags">
                    {item.tags.length > 0
                      ? item.tags.map((tag) => <span key={tag}>{tag}</span>)
                      : <span>暂无标签</span>}
                  </div>
                  <ChevronRight className="row-chevron" size={19} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>}

      {activeView === 'qa' && (
        <section className="qa-page">
          <div className="section-heading qa-heading">
            <div><h2>智能问答</h2><span>基于 {items.length} 条个人知识</span></div>
          </div>

          <div className="qa-transcript" aria-live="polite">
            {qaTurns.length === 0 && !asking && (
              <div className="qa-empty">
                <MessageCircle size={28} aria-hidden="true" />
                <strong>向个人知识库提问</strong>
                <span>回答只使用已保存的知识，并附上可核验的来源。</span>
              </div>
            )}

            {qaTurns.map((turn) => (
              <article className="qa-turn" key={turn.id}>
                <div className="qa-question"><span>你</span><p>{turn.question}</p></div>
                <div className="qa-answer">
                  <div className="qa-answer-heading">
                    <span>ClawNote</span>
                    <small>{turn.confidence === 'high' ? '高置信度' :
                      turn.confidence === 'medium' ? '中等置信度' : '未找到依据'}</small>
                  </div>
                  <p>{turn.answer}</p>
                  {turn.citations.length > 0 && (
                    <div className="qa-citations">
                      {turn.citations.map((citation) => (
                        <button type="button" key={citation.id}
                          onClick={() => openDetail(citation.id)}>
                          <BookOpen size={15} />
                          <span>知识 #{citation.id}：{citation.title}</span>
                          <ChevronRight size={15} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}

            {asking && (
              <div className="qa-pending">
                <Sparkles size={18} />正在检索个人知识库并生成回答...
              </div>
            )}
          </div>

          {qaError && (
            <div className="error-message compact-message message-with-action">
              <span>问答失败：{qaError}</span>
              <button type="button" className="action-button"
                onClick={() => submitQuestion(question)}>重试</button>
            </div>
          )}
          <form className="qa-composer" onSubmit={askKnowledge}>
            <textarea value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="输入关于个人知识库的问题"
              aria-label="向知识库提问" rows={3} maxLength={500} required />
            <button className="save-button" type="submit"
              disabled={asking || question.trim().length < 2}>
              <Send size={17} />{asking ? '回答中...' : '发送问题'}
            </button>
          </form>
        </section>
      )}

      {activeView === 'graph' && (
        <section className="graph-page">
          <div className="page-heading">
            <div><span className="eyebrow">KNOWLEDGE GRAPH</span><h2>知识图谱</h2></div>
            {graph && <p>{graph.knowledge_count} 条知识 · {graph.concept_count} 个主题 · {graph.relation_count} 条关系</p>}
          </div>
          <div className="graph-controls">
            <div className="graph-mode-control" role="group" aria-label="图谱视图">
              <button type="button" className={graphMode === 'bubbles' ? 'active' : ''}
                onClick={() => setGraphMode('bubbles')}>分类地图</button>
              <button type="button" className={graphMode === 'relations' ? 'active' : ''}
                onClick={() => setGraphMode('relations')}>关联探索</button>
            </div>
            {graphMode === 'relations' && items.length > 0 && (
              <label htmlFor="graph-focus">中心知识
                <select id="graph-focus" value={graphFocusId || ''}
                  onChange={(event) => setGraphFocusId(Number(event.target.value))}>
                  {items.map((item) => <option value={item.id} key={item.id}>#{item.id} {item.title}</option>)}
                </select>
              </label>
            )}
          </div>
          {insightLoading && <p className="status-message">正在构建知识关系...</p>}
          {insightError && (
            <div className="error-message message-with-action">
              <span>加载失败：{insightError}</span>
              <button type="button" className="action-button" onClick={loadInsights}>重试</button>
            </div>
          )}
          {graph && !insightLoading && graph.nodes.length > 0 && graphMode === 'bubbles' && (
            <KnowledgeBubbleGraph graph={graph} onOpenKnowledge={openDetail} />
          )}
          {graph && !insightLoading && graphMode === 'relations' && relationGraph.nodes.length > 1 && (
            <div className="graph-workspace">
              <div className="graph-legend">
                <span><i className="focus-dot" />中心知识</span>
                <span><i className="knowledge-dot" />相关知识</span>
                <span><i className="concept-dot" />主题实体</span>
                <span><i className="relation-line" />共享主题</span>
              </div>
              <div className="graph-canvas">
                <svg viewBox="0 0 960 520" role="img" aria-label="以中心知识展开的关联探索图">
                  <g className="graph-links">
                    {relationGraph.links.map((link, index) => {
                      const source = graphPositions.get(link.source)
                      const target = graphPositions.get(link.target)
                      if (!source || !target) return null
                      return <line key={`${link.source}-${link.target}-${index}`}
                        x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                        className="concept-link" />
                    })}
                  </g>
                  <g className="graph-nodes">
                    {relationGraph.nodes.map((node) => {
                      const position = graphPositions.get(node.id)
                      if (!position) return null
                      const isKnowledge = node.type === 'knowledge'
                      const isFocus = node.role === 'focus'
                      return (
                        <g key={node.id} transform={`translate(${position.x} ${position.y})`}
                          className={isKnowledge
                            ? `knowledge-node ${isFocus ? 'focus-node' : 'related-node'}`
                            : 'concept-node'}
                          onClick={isKnowledge ? () => setGraphFocusId(node.knowledge_id) : undefined}>
                          <title>{node.label}</title>
                          {isKnowledge
                            ? <rect x={isFocus ? '-130' : '-110'} y={isFocus ? '-23' : '-18'}
                              width={isFocus ? '260' : '220'} height={isFocus ? '46' : '36'} rx="6" />
                            : <circle r={Math.min(17, 10 + node.weight * 1.5)} />}
                          <text textAnchor={isKnowledge ? 'middle' : 'start'}
                            x={isKnowledge ? 0 : 22} y="5">{truncateLabel(node.label, isFocus ? 20 : isKnowledge ? 15 : 10)}</text>
                        </g>
                      )
                    })}
                  </g>
                </svg>
              </div>
            </div>
          )}
          {graph && !insightLoading && graphMode === 'relations' && relationGraph.nodes.length <= 1 && (
            <p className="status-message">当前知识暂时没有可展开的共享主题。</p>
          )}
          {graph && graph.nodes.length === 0 && <p className="status-message">知识库为空，暂无可构建的关系。</p>}
        </section>
      )}

      {activeView === 'recommendations' && (
        <section className="recommendation-page">
          <div className="page-heading recommendation-heading">
            <div><span className="eyebrow">LEARNING GUIDE</span><h2>学习推荐</h2></div>
            <label htmlFor="recommendation-source">基于知识
              <select id="recommendation-source" value={recommendationId || ''}
                onChange={(event) => changeRecommendation(Number(event.target.value))}>
                {items.map((item) => <option value={item.id} key={item.id}>#{item.id} {item.title}</option>)}
              </select>
            </label>
          </div>
          <div className="recommendation-tabs" role="group" aria-label="推荐类型">
            <button type="button" className={recommendationView === 'path' ? 'active' : ''}
              onClick={() => setRecommendationView('path')}>学习路径</button>
            <button type="button" className={recommendationView === 'related' ? 'active' : ''}
              onClick={() => setRecommendationView('related')}>相关知识</button>
            <button type="button" className={recommendationView === 'gaps' ? 'active' : ''}
              onClick={() => setRecommendationView('gaps')}>知识缺口</button>
          </div>

          {recommendationLoading && <p className="status-message">正在生成学习建议...</p>}
          {recommendationError && (
            <div className="error-message message-with-action">
              <span>加载失败：{recommendationError}</span>
              <button type="button" className="action-button"
                onClick={() => loadRecommendations(recommendationId)}>重试</button>
            </div>
          )}
          {recommendations && !recommendationLoading && (
            <>
              <div className="recommendation-source">
                <div><span>当前学习锚点</span><strong>{recommendations.source.title}</strong></div>
                <div className="tags">{recommendations.source.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              </div>

              {recommendationView === 'path' && (
                recommendations.learning_path.length > 0 ? (
                  <div className="learning-path">
                    {recommendations.learning_path.map((item, index) => (
                      <button type="button" key={item.id} onClick={() => openDetail(item.id)}>
                        <span className="path-index">{index + 1}</span>
                        <span className="path-copy">
                          <small>{item.stage}</small>
                          <strong>{item.title}</strong>
                          <span>{item.reason}</span>
                          <span className="tags">{item.tags.slice(0, 5).map((tag) => <i key={tag}>{tag}</i>)}</span>
                        </span>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><Compass size={26} /><strong>暂无学习路径</strong><span>当前知识缺少可串联的分类或标签。</span></div>
                )
              )}

              {recommendationView === 'related' && (recommendations.items.length > 0 ? (
                <div className="recommendation-list">
                  {recommendations.items.map((item, index) => (
                    <button type="button" key={item.id} onClick={() => openDetail(item.id)}>
                      <span className="recommendation-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="recommendation-copy">
                        <strong>{item.title}</strong>
                        <small>{item.reason}</small>
                        <span className="tags">{item.matched_tags.map((tag) => <i key={tag}>{tag}</i>)}</span>
                      </span>
                      <span className="similarity">
                        <strong>{Math.round(item.similarity * 100)}%</strong>
                        <i><b style={{ width: `${item.similarity * 100}%` }} /></i>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><Compass size={26} /><strong>暂无相似知识</strong><span>当前条目与其他知识没有共同标签。</span></div>
              ))}

              {recommendationView === 'gaps' && (
                recommendations.gaps.length > 0 ? (
                  <div className="gap-list">
                    {recommendations.gaps.map((gap) => (
                      <article key={gap.topic}>
                        <strong>{gap.topic}</strong>
                        <span>{gap.reason}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><Compass size={26} /><strong>暂无明显缺口</strong><span>当前主题已有较完整的标签覆盖。</span></div>
                )
              )}
            </>
          )}
        </section>
      )}

      {detailOpen && (
        <div className="drawer-backdrop" onMouseDown={closeDetail}>
          <aside className="detail-drawer" role="dialog" aria-modal="true"
            aria-label="知识详情" onMouseDown={(event) => event.stopPropagation()}>
            <div className="detail-heading">
              <div><span>知识详情</span><strong>{selectedItem ? `#${selectedItem.id}` : ''}</strong></div>
              <button className="drawer-close" type="button" onClick={closeDetail}
                title="关闭详情" aria-label="关闭详情"><X size={20} /></button>
            </div>

            {detailLoading && <p className="status-message">正在加载详情...</p>}
            {detailError && <p className="error-message">加载失败：{detailError}</p>}
            {selectedItem && (
              <div className="detail-content">
                <div className="detail-actions">
                  {!editing && (
                    <button className="action-button" type="button"
                      onClick={startEditing}>
                      <Pencil size={17} />编辑
                    </button>
                  )}
                  <button className="action-button danger-button" type="button"
                    onClick={deleteKnowledge} disabled={deleting}>
                    <Trash2 size={17} />{deleting ? '删除中...' : '删除'}
                  </button>
                </div>

                {actionError && <p className="error-message">操作失败：{actionError}</p>}

                {editing ? (
                  <form className="edit-form" onSubmit={saveKnowledge}>
                    <label>标题<input name="title" value={editForm.title}
                      onChange={handleEditChange} maxLength={200} required /></label>
                    <label>分类<input name="category" value={editForm.category}
                      onChange={handleEditChange} required /></label>
                    <label>标签<input name="tags" value={editForm.tags}
                      onChange={handleEditChange} placeholder="使用逗号分隔" /></label>
                    <label>摘要<textarea name="summary" value={editForm.summary}
                      onChange={handleEditChange} rows={4} /></label>
                    <label>正文<textarea name="content" value={editForm.content}
                      onChange={handleEditChange} rows={10} required /></label>
                    <div className="form-actions">
                      <button className="cancel-button" type="button"
                        onClick={cancelEditing}>取消</button>
                      <button className="save-button" type="submit" disabled={saving}>
                        <Save size={17} />{saving ? '保存中...' : '保存修改'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h2>{selectedItem.title}</h2>
                    <div className="tags">
                      {selectedItem.tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                    <dl className="metadata">
                      <div><dt>分类</dt><dd>{selectedItem.category}</dd></div>
                      <div><dt>来源</dt><dd>{selectedItem.source || '未记录'}</dd></div>
                      <div><dt>创建时间</dt><dd>{selectedItem.created_at}</dd></div>
                    </dl>
                    <section className="detail-section">
                      <h3>摘要</h3><p>{selectedItem.summary || '暂无摘要'}</p>
                    </section>
                    <section className="detail-section">
                      <h3>正文</h3><p>{selectedItem.content}</p>
                    </section>
                    {selectedItem.source_url && (
                      <a className="source-link" href={selectedItem.source_url}
                        target="_blank" rel="noreferrer">查看原始来源</a>
                    )}
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {createOpen && (
        <div className="drawer-backdrop" onMouseDown={closeCreate}>
          <aside className="detail-drawer" role="dialog" aria-modal="true"
            aria-label="新增知识" onMouseDown={(event) => event.stopPropagation()}>
            <div className="detail-heading">
              <div><span>新增知识</span></div>
              <button className="drawer-close" type="button" onClick={closeCreate}
                disabled={creating || analyzing} title="关闭" aria-label="关闭新增知识">
                <X size={20} />
              </button>
            </div>
            <div className="detail-content">
              {createError && <p className="error-message">处理失败：{createError}</p>}
              {importNotice && <p className="notice-message compact-message">{importNotice}</p>}
              {createStep === 'input' ? (
                <form className="edit-form" onSubmit={prepareKnowledge}>
                  <div className="import-modes" role="group" aria-label="知识导入方式">
                    <button type="button" className={importMode === 'text' ? 'active' : ''}
                      onClick={() => changeImportMode('text')}>
                      <AlignLeft size={17} />粘贴文本
                    </button>
                    <button type="button" className={importMode === 'url' ? 'active' : ''}
                      onClick={() => changeImportMode('url')}>
                      <Link2 size={17} />网页链接
                    </button>
                    <button type="button" className={importMode === 'file' ? 'active' : ''}
                      onClick={() => changeImportMode('file')}>
                      <FileUp size={17} />上传文件
                    </button>
                  </div>

                  {importMode === 'text' && (
                    <label>知识原文<textarea name="content" value={createForm.content}
                      onChange={handleCreateChange} rows={16} minLength={20} maxLength={20000}
                      placeholder="粘贴笔记、文章片段或学习资料，AI 将自动整理标题、摘要、分类和标签。"
                      required autoFocus /></label>
                  )}

                  {importMode === 'url' && (
                    <label>网页地址<input type="url" value={webUrl}
                      onChange={(event) => setWebUrl(event.target.value)}
                      placeholder="https://example.com/article" maxLength={2000}
                      required autoFocus /></label>
                  )}

                  {importMode === 'file' && (
                    <label className="file-field">选择文件
                      <input type="file" accept=".txt,.md,text/plain,text/markdown"
                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        autoFocus />
                      <span>{selectedFile ? selectedFile.name : '支持 UTF-8 TXT、Markdown，最大 2 MiB'}</span>
                    </label>
                  )}

                  {importMode !== 'file' && (
                    <label>标题提示（可选）<input value={titleHint}
                      onChange={(event) => setTitleHint(event.target.value)} maxLength={200}
                      placeholder="例如：RAG 学习笔记" /></label>
                  )}
                  <p className="form-note">AI 只生成整理草稿，不会在确认前写入知识库。</p>
                  <div className="form-actions">
                    <button className="cancel-button" type="button"
                      onClick={closeCreate} disabled={analyzing}>取消</button>
                    <button className="save-button" type="submit"
                      disabled={analyzing || (importMode === 'file' && !selectedFile)}>
                      <Sparkles size={17} />
                      {analyzing
                        ? processingLabel
                        : importMode === 'text' ? 'AI 整理' : '提取并整理'}
                    </button>
                  </div>
                </form>
              ) : (
                <form className="edit-form" onSubmit={createKnowledge}>
                  <div className="preview-heading">
                    <button className="back-button" type="button"
                      onClick={() => { setCreateStep('input'); setCreateError('') }}>
                      <ArrowLeft size={17} />返回原文
                    </button>
                    <span>请确认 AI 整理结果</span>
                  </div>
                  <label>标题<input name="title" value={createForm.title}
                    onChange={handleCreateChange} maxLength={200} required autoFocus /></label>
                  <label>分类<input name="category" value={createForm.category}
                    onChange={handleCreateChange} required /></label>
                  <label>标签<input name="tags" value={createForm.tags}
                    onChange={handleCreateChange} placeholder="使用逗号分隔" /></label>
                  <label>摘要<textarea name="summary" value={createForm.summary}
                    onChange={handleCreateChange} rows={4} /></label>
                  <label>正文<textarea name="content" value={createForm.content}
                    onChange={handleCreateChange} rows={10} required /></label>
                  <div className="form-actions">
                    <button className="cancel-button" type="button"
                      onClick={closeCreate} disabled={creating}>取消</button>
                    <button className="save-button" type="submit" disabled={creating}>
                      <Plus size={17} />{creating ? '创建中...' : '确认入库'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}

export default App
