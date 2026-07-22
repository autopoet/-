import {
  BookOpenText,
  FilePenLine,
  Home,
  Search,
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
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const isHome = location.pathname === '/'
  const isAuth = location.pathname === '/login'
  const showGlobalSearch = !isHome && !isAuth && location.pathname !== '/explore'
  const activeItem =
    navigation.find((item) => matchesPath(location.pathname, item.to)) ??
    navigation[1]
  const ActiveIcon = activeItem.icon
  const satellites = navigation.filter((item) => item.to !== activeItem.to)

  useEffect(() => {
    setNavOpen(false)
    setSearchOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

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
      <Link className={styles.brand} to="/" aria-label="电赛白皮书首页">
        <BookOpenText aria-hidden="true" size={20} strokeWidth={1.7} />
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
          {searchOpen ? <Search aria-hidden="true" size={18} /> : null}
          {searchOpen ? (
            <input
              ref={inputRef}
              id="global-search"
              value={query}
              placeholder="例如：无法上电"
              maxLength={20}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          ) : null}
          <button
            type={searchOpen ? 'submit' : 'button'}
            aria-label={searchOpen ? '开始搜索' : '打开搜索'}
            onClick={searchOpen ? undefined : () => setSearchOpen(true)}
          >
            {searchOpen ? (
              <span>搜索</span>
            ) : (
              <Search aria-hidden="true" size={18} />
            )}
          </button>
          {searchOpen ? (
            <button
              className={styles.searchClose}
              type="button"
              aria-label="收起搜索"
              onClick={() => setSearchOpen(false)}
            >
              <X aria-hidden="true" size={17} />
            </button>
          ) : null}
        </form>
      ) : null}

      {!isAuth ? (
        <nav
          className={styles.floatingNav}
          data-open={navOpen}
          aria-label="主导航"
          onMouseEnter={() => setNavOpen(true)}
          onMouseLeave={() => setNavOpen(false)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setNavOpen(false)
            }
          }}
        >
          <span className={styles.orbitArc} aria-hidden="true" />
          <button
            className={styles.coreBall}
            type="button"
            aria-label={`${activeItem.label}，${navOpen ? '收起' : '展开'}页面导航`}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((current) => !current)}
          >
            <ActiveIcon aria-hidden="true" size={21} />
            <span>{activeItem.label}</span>
          </button>

          {satellites.map((item, index) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                className={`${styles.satellite} ${styles[`satellite${index}`]}`}
                to={item.to}
                end={item.end}
                tabIndex={navOpen ? 0 : -1}
              >
                <Icon aria-hidden="true" size={17} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      ) : null}
    </>
  )
}
