import {
  BookOpenText,
  FilePenLine,
  Home,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import styles from './spatial-chrome.module.css'

const navigation = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/explore', label: '查 BUG', icon: Search, end: false },
  { to: '/submissions', label: '贡献', icon: FilePenLine, end: false },
  { to: '/profile', label: '我的', icon: UserRound, end: false },
]

function matchesPath(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

export function SpatialChrome() {
  const location = useLocation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const activeItem =
    navigation.find((item) => matchesPath(location.pathname, item.to)) ??
    navigation[1]
  const ActiveIcon = activeItem.icon
  const satellites = navigation.filter((item) => item.to !== activeItem.to)
  const isHome = location.pathname === '/'
  const isAuth = location.pathname === '/login'
  const showGlobalSearch = !isHome && !isAuth && location.pathname !== '/explore'

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    const handlePointer = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty(
          '--pointer-x',
          `${(event.clientX / window.innerWidth) * 100}%`,
        )
        document.documentElement.style.setProperty(
          '--pointer-y',
          `${(event.clientY / window.innerHeight) * 100}%`,
        )
      })
    }

    window.addEventListener('pointermove', handlePointer, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handlePointer)
    }
  }, [])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const keyword = query.trim()
    navigate(keyword ? `/explore?q=${encodeURIComponent(keyword)}` : '/explore')
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSearchOpen(false)
      setQuery('')
    }
  }

  return (
    <>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.signalLine} />
      </div>

      <Link className={styles.brand} to="/" aria-label="电赛白皮书首页">
        <BookOpenText aria-hidden="true" size={21} strokeWidth={1.7} />
        <span>电赛白皮书</span>
      </Link>

      {showGlobalSearch ? (
        <form
          className={styles.searchDock}
          data-open={searchOpen}
          role="search"
          onSubmit={submitSearch}
        >
          <label className="sr-only" htmlFor="global-search">
            搜索故障文档
          </label>
          {searchOpen ? (
            <>
              <Search aria-hidden="true" size={19} />
              <input
                ref={inputRef}
                id="global-search"
                value={query}
                placeholder="描述故障现象…"
                maxLength={20}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <button type="button" aria-label="收起搜索" onClick={() => setSearchOpen(false)}>
                <X aria-hidden="true" size={18} />
              </button>
              <button className={styles.searchSubmit} type="submit" aria-label="开始搜索">
                <Sparkles aria-hidden="true" size={18} />
              </button>
            </>
          ) : (
            <button type="button" aria-label="打开搜索" onClick={() => setSearchOpen(true)}>
              <Search aria-hidden="true" size={21} />
            </button>
          )}
        </form>
      ) : null}

      {!isAuth ? (
        <>
          <nav
            className={styles.radialNav}
            data-open={menuOpen}
            aria-label="空间导航"
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setMenuOpen(false)
              }
            }}
          >
            <button
              className={styles.radialCenter}
              type="button"
              aria-expanded={menuOpen}
              aria-label={`${activeItem.label}，${menuOpen ? '收起' : '展开'}导航`}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <ActiveIcon aria-hidden="true" size={23} />
            </button>
            {satellites.map((item, index) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  className={`${styles.radialItem} ${styles[`satellite${index}`]}`}
                  to={item.to}
                  end={item.end}
                  tabIndex={menuOpen ? 0 : -1}
                >
                  <Icon aria-hidden="true" size={19} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <nav className={styles.mobileDock} aria-label="主导航">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  <Icon aria-hidden="true" size={20} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </>
      ) : null}
    </>
  )
}
