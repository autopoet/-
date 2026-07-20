import { useQuery } from '@tanstack/react-query'
import { UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listSymptoms, symptomKeys } from '../api/symptoms'
import { SearchForm } from '../components/search-form'
import styles from './home-page.module.css'

const orbitTopics = [
  {
    label: '无法上电',
    description: '接通电源后没有任何响应',
    query: '无法上电',
  },
  {
    label: '输出掉压',
    description: '负载接入后电压下降或不稳定',
    query: '输出掉压',
  },
  {
    label: '串口乱码',
    description: '通信建立后数据无法正确解析',
    query: '串口乱码',
  },
  {
    label: '电机振荡',
    description: '闭环运行时持续来回波动',
    query: '电机振荡',
  },
]

export default function HomePage() {
  const symptoms = useQuery({
    queryKey: symptomKeys.list(),
    queryFn: ({ signal }) => listSymptoms(undefined, signal),
  })

  return (
    <main id="main-content" className={styles.page}>
      <h1 className="sr-only">从故障现象开始排查</h1>

      <div className={styles.orbit} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className={styles.searchScene} aria-label="故障搜索">
        <div className={styles.searchLens}>
          <SearchForm
            variant="hero"
            hint="输入你看到的、测到的，或仪器给出的错误信息"
          />
        </div>

        <nav className={styles.topicOrbit} aria-label="常见故障现象">
          {orbitTopics.map((topic, index) => (
            <Link
              key={topic.query}
              className={styles[`topic${index}`]}
              to={`/explore?q=${encodeURIComponent(topic.query)}`}
            >
              <strong>{topic.label}</strong>
              <span>{topic.description}</span>
            </Link>
          ))}
        </nav>
      </section>

      {symptoms.data ? (
        <p className={styles.presence}>
          <UsersRound aria-hidden="true" size={18} />
          正在整理 {symptoms.data.total} 条排查经验
        </p>
      ) : null}
    </main>
  )
}
