import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listSymptoms, symptomKeys } from '../api/symptoms'
import { ErrorState, ListSkeleton } from '../components/request-state'
import { SearchForm } from '../components/search-form'
import styles from './home-page.module.css'

export default function HomePage() {
  const symptomsQuery = useQuery({
    queryKey: symptomKeys.list(),
    queryFn: ({ signal }) => listSymptoms(undefined, signal),
  })

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.searchSection} aria-labelledby="home-title">
        <h1 id="home-title">从故障现象开始排查</h1>
        <SearchForm variant="hero" />
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
            {symptomsQuery.data.items.map((symptom) => (
              <li key={symptom.id}>
                <Link className={styles.symptomLink} to={`/articles/${symptom.id}`}>
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
    </main>
  )
}
