import { useEffect, useState } from 'react'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'

function App() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/knowledge?limit=20`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`请求失败：${response.status}`)
        }
        return response.json()
      })
      .then((data) => {
        setItems(data.items)
      })
      .catch((requestError) => {
        setError(requestError.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <main>
      <header>
        <h1>ClawNote</h1>
        <p>个人智能知识管家</p>
      </header>

      <section>
        <h2>知识库</h2>

        {loading && <p>正在加载...</p>}
        {error && <p>加载失败：{error}</p>}

        {!loading && !error && (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.category}</span>
                <p>{item.tags.join('、')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
