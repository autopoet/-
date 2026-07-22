import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SpatialChrome } from './spatial-chrome'

export function AppLayout() {
  const location = useLocation()
  const firstRender = useRef(true)

  useEffect(() => {
    const keyword = new URLSearchParams(location.search).get('q')?.trim()

    if (location.pathname === '/') {
      document.title = '从故障现象开始排查｜电赛白皮书'
    } else if (location.pathname === '/explore') {
      document.title = keyword
        ? `${keyword.slice(0, 20)}的搜索结果｜电赛白皮书`
        : '知识库｜电赛白皮书'
    } else if (location.pathname.startsWith('/articles/')) {
      document.title = new URLSearchParams(location.search).get('edit') === '1'
        ? '编辑文档｜电赛白皮书'
        : '故障排查文档｜电赛白皮书'
    } else if (location.pathname === '/login') {
      document.title = '登录｜电赛白皮书'
    } else if (location.pathname === '/submissions') {
      document.title = '我的提交｜电赛白皮书'
    } else if (location.pathname === '/reviews') {
      document.title = '审核队列｜电赛白皮书'
    } else if (location.pathname === '/profile') {
      document.title = new URLSearchParams(location.search).get('tab') === 'favorites'
        ? '我的收藏｜电赛白皮书'
        : '我的贡献｜电赛白皮书'
    } else {
      document.title = '页面未找到｜电赛白皮书'
    }

    const main = document.getElementById('main-content')
    if (main) {
      main.tabIndex = -1
      if (!firstRender.current) {
        main.focus({ preventScroll: true })
      }
    }

    firstRender.current = false
  }, [location.pathname, location.search])

  return (
    <div className="appShell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <SpatialChrome />
      <div
        className="pageTransition"
        data-fullscreen={location.pathname === '/' || location.pathname === '/login'}
        key={`${location.pathname}:${location.search}`}
      >
        <Outlet />
      </div>
    </div>
  )
}
