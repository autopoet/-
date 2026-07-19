import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '../components/app-layout'
import ArticlePage from '../pages/article-page'
import EditorPage from '../pages/editor-page'
import ExplorePage from '../pages/explore-page'
import HomePage from '../pages/home-page'
import LoginPage from '../pages/login-page'
import NotFoundPage from '../pages/not-found-page'
import ReviewsPage from '../pages/reviews-page'
import RouteErrorPage from '../pages/route-error-page'
import SubmissionsPage from '../pages/submissions-page'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'articles/:articleId', element: <ArticlePage /> },
      { path: 'articles/:articleId/edit', element: <EditorPage /> },
      { path: 'submissions', element: <SubmissionsPage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
