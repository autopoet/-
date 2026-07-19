import { BookOpenText, Menu, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { authKeys, logout, useCurrentUser } from '../api/auth'
import styles from './site-header.module.css'

const navigation = [
  { to: '/', label: '首页', end: true },
  { to: '/explore', label: '知识库', end: false },
]

export function SiteHeader() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const currentUser = useCurrentUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.currentUser, null)
      void queryClient.invalidateQueries()
    },
  })

  useEffect(() => setMenuOpen(false), [location.pathname, location.search])

  const accountLinks = currentUser.data ? (
    <>
      <NavLink className={styles.utilityLink} to="/submissions">
        我的提交
      </NavLink>
      {currentUser.data.role === 'reviewer' ? (
        <NavLink className={styles.utilityLink} to="/reviews">
          审核
        </NavLink>
      ) : null}
      <span className={styles.username}>{currentUser.data.username}</span>
      <button
        className={styles.logoutButton}
        type="button"
        disabled={logoutMutation.isPending}
        onClick={() => logoutMutation.mutate()}
      >
        退出
      </button>
    </>
  ) : (
    <Link className={styles.loginLink} to="/login">
      登录
    </Link>
  )

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.masthead}>
          <Link className={styles.brand} to="/" aria-label="电赛白皮书首页">
            <BookOpenText aria-hidden="true" size={22} strokeWidth={1.6} />
            <span>电赛白皮书</span>
          </Link>
          <button
            className={styles.menuButton}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? '关闭导航' : '打开导航'}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>

        <div className={styles.navigationRow}>
          <nav className={styles.desktopNav} aria-label="主导航">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
                end={item.end}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className={styles.account}>{accountLinks}</div>
        </div>
      </div>

      {menuOpen ? (
        <nav id="mobile-navigation" className={styles.mobileNav} aria-label="移动端导航">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
          {accountLinks}
        </nav>
      ) : null}
    </header>
  )
}
