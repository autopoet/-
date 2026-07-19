import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authKeys, login, register } from '../api/auth'
import { ApiError } from '../api/client'
import styles from './workflow-page.module.css'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authMutation = useMutation({
    mutationFn: mode === 'login' ? login : register,
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.currentUser, user)
      navigate(searchParams.get('from') || '/')
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    authMutation.mutate({ username, password })
  }

  return (
    <main id="main-content" className={styles.narrowPage}>
      <header className={styles.pageTitle}>
        <h1>{mode === 'login' ? '登录' : '注册'}</h1>
        <p>
          {mode === 'login'
            ? '登录后可直接在文档中修改，并提交审核。'
            : '账户用于记录每次修改；公开版本仍需审核通过。'}
        </p>
      </header>

      <div className={styles.modeSwitch} aria-label="登录方式">
        <button
          type="button"
          aria-pressed={mode === 'login'}
          onClick={() => setMode('login')}
        >
          登录
        </button>
        <button
          type="button"
          aria-pressed={mode === 'register'}
          onClick={() => setMode('register')}
        >
          注册
        </button>
      </div>

      <form className={styles.authForm} onSubmit={handleSubmit}>
        <label>
          用户名
          <input
            required
            minLength={3}
            maxLength={32}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          密码
          <input
            required
            minLength={8}
            maxLength={128}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {authMutation.isError ? (
          <p className={styles.errorText} role="alert">
            {authMutation.error instanceof ApiError
              ? authMutation.error.message
              : '操作失败，请重试'}
          </p>
        ) : null}
        <button className={styles.primaryButton} type="submit" disabled={authMutation.isPending}>
          {authMutation.isPending
            ? '正在处理…'
            : mode === 'login'
              ? '登录'
              : '创建账号'}
        </button>
      </form>
    </main>
  )
}
