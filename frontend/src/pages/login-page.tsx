import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, LockKeyhole, UserRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authKeys, login, register } from '../api/auth'
import { ApiError } from '../api/client'
import styles from './login-page.module.css'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>(() =>
    searchParams.get('mode') === 'register' ? 'register' : 'login',
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
    <main id="main-content" className={styles.page}>
      <div className={styles.signalField} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className={styles.authPanel} aria-labelledby="auth-title">
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

        <header>
          <h1 id="auth-title">{mode === 'login' ? '欢迎回来' : '建立贡献身份'}</h1>
        </header>

        <form className={styles.authForm} onSubmit={handleSubmit}>
          <label>
            <span>用户名</span>
            <div>
              <UserRound aria-hidden="true" size={19} />
              <input
                required
                minLength={3}
                maxLength={32}
                autoComplete="username"
                value={username}
                placeholder="输入用户名"
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
          </label>
          <label>
            <span>密码</span>
            <div>
              <LockKeyhole aria-hidden="true" size={19} />
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                placeholder="至少 8 个字符"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </label>
          {authMutation.isError ? (
            <p className={styles.errorText} role="alert">
              {authMutation.error instanceof ApiError
                ? authMutation.error.message
                : '操作失败，请重试'}
            </p>
          ) : null}
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={authMutation.isPending}
          >
            {authMutation.isPending
              ? '正在处理…'
              : mode === 'login'
                ? '进入知识库'
                : '创建账号'}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>
      </section>
    </main>
  )
}
