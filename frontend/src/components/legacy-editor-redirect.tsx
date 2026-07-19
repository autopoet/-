import { Navigate, useParams } from 'react-router-dom'

export function LegacyEditorRedirect() {
  const { articleId = '' } = useParams()
  return <Navigate replace to={`/articles/${articleId}?edit=1`} />
}
