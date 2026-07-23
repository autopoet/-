import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  articleKeys,
  createArticle,
  type NewArticlePayload,
} from '../api/articles'
import { useCurrentUser } from '../api/auth'
import { ApiError } from '../api/client'
import { ListSkeleton } from '../components/request-state'
import styles from './create-article-page.module.css'

const emptyArticle: NewArticlePayload = {
  name: '',
  description: '',
}

export default function CreateArticlePage() {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [article, setArticle] = useState(emptyArticle)
  const createMutation = useMutation({
    mutationFn: createArticle,
    onSuccess: ({ symptom }) => {
      void queryClient.invalidateQueries({ queryKey: articleKeys.mine })
      navigate(`/articles/${symptom.id}?edit=1`, { replace: true })
    },
  })

  if (currentUser.isPending) {
    return (
      <main id="main-content" className={styles.statePage}>
        <ListSkeleton rows={3} />
      </main>
    )
  }

  if (!currentUser.data) {
    return (
      <main id="main-content" className={styles.statePage}>
        <span className={styles.eyebrow}>创建条目</span>
        <h1>登录后贡献排障经验</h1>
        <p>新条目会先进入你的草稿，审核通过后才会公开。</p>
        <Link className={styles.primaryLink} to="/login?from=/articles/new">
          前往登录
        </Link>
      </main>
    )
  }

  function updateField<Key extends keyof NewArticlePayload>(
    key: Key,
    value: NewArticlePayload[Key],
  ) {
    setArticle((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate({
      name: article.name.trim(),
      description: article.description.trim(),
    })
  }

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <Link to="/submissions">
          <ArrowLeft aria-hidden="true" size={16} />
          我的提交
        </Link>
        <span>未提交前仅自己可见</span>
      </header>

      <form className={styles.form} onSubmit={submit}>
        <span className={styles.eyebrow}>创建条目</span>
        <h1>先记录你看到的故障</h1>

        <label className={styles.titleField}>
          <span>故障现象</span>
          <input
            autoFocus
            required
            minLength={2}
            maxLength={100}
            placeholder="例如：稳压输出一带负载就掉压"
            value={article.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </label>

        <label>
          <span>现象摘要</span>
          <textarea
            required
            minLength={4}
            maxLength={500}
            rows={3}
            placeholder="只描述能观察、测量或复现的表现"
            value={article.description}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </label>

        {createMutation.error ? (
          <p className={styles.error} role="alert">
            {createMutation.error instanceof ApiError
              ? createMutation.error.message
              : '创建失败，请重试'}
          </p>
        ) : null}

        <footer>
          <p>下一步填写适用范围、检查清单和完整排查正文。</p>
          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? '正在创建…' : '创建并开始编写'}
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </footer>
      </form>
    </main>
  )
}
