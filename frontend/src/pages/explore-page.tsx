import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Fragment } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listSymptoms, symptomKeys } from '../api/symptoms'
import { EmptyState, ErrorState, ListSkeleton } from '../components/request-state'
import { SearchForm } from '../components/search-form'
import styles from './explore-page.module.css'

function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return text

  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, index) => (
    <Fragment key={`${part}-${index}`}>
      {part.toLocaleLowerCase() === keyword.toLocaleLowerCase() ? (
        <mark>{part}</mark>
      ) : (
        part
      )}
    </Fragment>
  ))
}

export default function ExplorePage() {
  const [searchParams] = useSearchParams()
  const keyword = (searchParams.get('q') ?? '').trim()
  const keywordIsValid =
    keyword.length === 0 || (keyword.length >= 2 && keyword.length <= 20)
  const symptomsQuery = useQuery({
    queryKey: symptomKeys.list(keyword || undefined),
    queryFn: ({ signal }) => listSymptoms(keyword || undefined, signal),
    enabled: keywordIsValid,
  })

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>查 BUG</h1>
          {keywordIsValid && symptomsQuery.data ? (
            <span aria-live="polite">
              {keyword
                ? `“${keyword.slice(0, 20)}”找到 ${symptomsQuery.data.total} 篇文档`
                : `找到 ${symptomsQuery.data.total} 篇文档`}
            </span>
          ) : null}
        </div>
        <SearchForm initialValue={keyword} variant="page" showSuggestions={false} />
      </header>

      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.resultsHeader}>
          <h2 id="results-title">{keyword ? '匹配文档' : '全部文档'}</h2>
        </div>

        {!keywordIsValid ? (
          <EmptyState
            title={keyword.length > 20 ? '搜索词过长' : '搜索词太短'}
            description="请输入 2 至 20 个字符，或清空搜索词浏览全部条目。"
          />
        ) : null}
        {symptomsQuery.isLoading ? <ListSkeleton rows={5} /> : null}
        {symptomsQuery.isError ? (
          <ErrorState
            description="搜索服务暂时没有响应。"
            onRetry={() => void symptomsQuery.refetch()}
          />
        ) : null}
        {symptomsQuery.data?.items.length === 0 ? (
          <EmptyState
            title={`没有找到“${keyword}”`}
            description="尝试换用更短、更接近故障现象的关键词。"
          />
        ) : null}
        {symptomsQuery.data?.items.length ? (
          <ul className={styles.resultList}>
            {symptomsQuery.data.items.map((symptom, index) => (
              <li key={symptom.id}>
                <Link className={styles.resultLink} to={`/articles/${symptom.id}`}>
                  <span className={styles.resultIndex}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>
                      <HighlightedText text={symptom.name} keyword={keyword} />
                    </h3>
                    <p>
                      <HighlightedText text={symptom.description} keyword={keyword} />
                    </p>
                    <span className={styles.resultMeta}>故障现象 #{symptom.id}</span>
                  </div>
                  <ArrowRight aria-hidden="true" size={20} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

    </main>
  )
}
