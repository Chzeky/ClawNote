import { useEffect, useState } from 'react'
import {
  AlignLeft, ArrowLeft, BookOpen, ChevronRight, FileUp, Link2,
  MessageCircle, Pencil, Plus, Save, Search, Send, Sparkles, Trash2, X,
} from 'lucide-react'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'
const IMPORT_DRAFT_KEY = 'clawnote.import-draft'

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
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error(`请求失败：${response.status}`)
  const data = await response.json()
  return data.items
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

function App() {
  const [activeView, setActiveView] = useState('knowledge')
  const [items, setItems] = useState([])
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

  async function loadKnowledge(searchQuery = '') {
    setLoading(true)
    setError('')

    try {
      setItems(await requestKnowledge(searchQuery))
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
        if (!cancelled) setItems(nextItems)
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
      const response = await fetch(`${API_BASE}/api/knowledge/${knowledgeId}`)
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
        const collectResponse = await fetch(`${API_BASE}/api/collect/url`, {
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
        const collectResponse = await fetch(`${API_BASE}/api/collect/file`, {
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

      const response = await fetch(`${API_BASE}/api/knowledge/analyze`, {
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
      const response = await fetch(`${API_BASE}/api/knowledge/text`, {
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
      await loadKnowledge(query.trim())
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
      const response = await fetch(`${API_BASE}/api/knowledge/${selectedItem.id}`, {
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
      const response = await fetch(`${API_BASE}/api/knowledge/${selectedItem.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `请求失败：${response.status}`)
      setItems((current) => current.filter((item) => item.id !== selectedItem.id))
      setNotice(`知识 #${selectedItem.id} 已删除`)
      closeDetail()
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
    const nextQuestion = question.trim()
    if (!nextQuestion || asking) return
    setAsking(true)
    setQaError('')
    try {
      const response = await fetch(`${API_BASE}/api/qa`, {
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

  return (
    <main>
      <header className="app-header">
        <div><h1>ClawNote</h1><p>个人智能知识管家</p></div>
        <nav className="primary-nav" aria-label="主要功能">
          <button type="button" className={activeView === 'knowledge' ? 'active' : ''}
            onClick={() => setActiveView('knowledge')}>
            <BookOpen size={17} />知识库
          </button>
          <button type="button" className={activeView === 'qa' ? 'active' : ''}
            onClick={() => setActiveView('qa')}>
            <MessageCircle size={17} />智能问答
          </button>
        </nav>
      </header>

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
            <button className="create-button" type="button" onClick={openCreate}>
              <Plus size={18} />新增知识
            </button>
          </div>
        </div>

        {loading && <p className="status-message">正在加载知识...</p>}
        {notice && <p className="notice-message">{notice}</p>}
        {error && <p className="error-message">加载失败：{error}</p>}
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

          {qaError && <p className="error-message compact-message">问答失败：{qaError}</p>}
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
