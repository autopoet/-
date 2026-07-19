import { useEffect, useState } from 'react'
import './App.css'

type ApiStatus =
  | { state: 'loading' }
  | { state: 'online'; service: string; environment: string }
  | { state: 'offline'; message: string }

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ state: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function checkApi() {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as {
          service: string
          environment: string
        }
        setApiStatus({
          state: 'online',
          service: data.service,
          environment: data.environment,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setApiStatus({
          state: 'offline',
          message: '请先启动 FastAPI 后端',
        })
      }
    }

    void checkApi()
    return () => controller.abort()
  }, [])

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/">
          电赛白皮书
        </a>
        <span className="phase">阶段 0 · 环境已连通</span>
      </header>

      <section className="hero">
        <p className="eyebrow">面向电赛现场的协作式 Debug 知识库</p>
        <h1>
          从故障现象出发，
          <br />
          一步一步找到问题。
        </h1>
        <p className="intro">
          项目已经完成前后端基础连接。下一步会从 HTTP、FastAPI 和数据库开始，
          逐步实现条目、版本审核与划线评论。
        </p>
      </section>

      <section className="status-card" aria-live="polite">
        <div>
          <p className="status-label">后端连接状态</p>
          {apiStatus.state === 'loading' && <h2>正在检查…</h2>}
          {apiStatus.state === 'online' && (
            <>
              <h2>{apiStatus.service}</h2>
              <p>环境：{apiStatus.environment}</p>
            </>
          )}
          {apiStatus.state === 'offline' && (
            <>
              <h2>尚未连接</h2>
              <p>{apiStatus.message}</p>
            </>
          )}
        </div>
        <span className={`indicator indicator--${apiStatus.state}`} />
      </section>

      <footer>React · FastAPI · Peewee · PostgreSQL</footer>
    </main>
  )
}

export default App

