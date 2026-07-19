import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listSymptoms, symptomKeys } from '../api/symptoms'
import { ErrorState, ListSkeleton } from '../components/request-state'
import { SearchForm } from '../components/search-form'
import styles from './home-page.module.css'

const browsePaths = [
  {
    label: '供电与启动',
    description: '无法上电、反复重启、启动条件不满足',
    query: '上电',
  },
  {
    label: '电压与电流',
    description: '输出掉压、静态电流异常、纹波超限',
    query: '电压',
  },
  {
    label: '通信与数据',
    description: '串口乱码、总线无响应、数据帧错误',
    query: '通信',
  },
]

export default function HomePage() {
  const symptomsQuery = useQuery({
    queryKey: symptomKeys.list(),
    queryFn: ({ signal }) => listSymptoms(undefined, signal),
  })

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.searchSection} aria-labelledby="home-title">
        <div>
          <h1 id="home-title">从故障现象开始排查</h1>
          <p>写下你看到的、测到的，或仪器给出的错误信息。</p>
        </div>
        <div className={styles.searchArea}>
          <SearchForm
            variant="hero"
            hint="例如：无法上电、输出掉压、串口乱码"
          />
        </div>
      </section>

      <section className={styles.symptomsSection}>
        <div className={styles.sectionHeader}>
          <h2>常见故障现象</h2>
          <Link className={styles.sectionLink} to="/explore">
            浏览全部
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>

        {symptomsQuery.isLoading ? <ListSkeleton rows={3} /> : null}
        {symptomsQuery.isError && !symptomsQuery.data ? (
          <ErrorState
            description="故障现象暂时没有加载成功。"
            onRetry={() => void symptomsQuery.refetch()}
          />
        ) : null}
        {symptomsQuery.data ? (
          <ul className={styles.symptomList}>
            {symptomsQuery.data.items.slice(0, 4).map((symptom, index) => (
              <li key={symptom.id}>
                <Link className={styles.symptomLink} to={`/articles/${symptom.id}`}>
                  <span className={styles.index}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.symptomContent}>
                    <strong>{symptom.name}</strong>
                    <span>{symptom.description}</span>
                  </span>
                  <ArrowRight aria-hidden="true" size={19} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.browseSection} aria-labelledby="browse-title">
        <h2 id="browse-title">按问题环节浏览</h2>
        <nav className={styles.browseList} aria-label="问题环节">
          {browsePaths.map((path) => (
            <Link
              key={path.query}
              to={`/explore?q=${encodeURIComponent(path.query)}`}
            >
              <strong>{path.label}</strong>
              <span>{path.description}</span>
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          ))}
        </nav>
      </section>
    </main>
  )
}
