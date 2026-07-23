const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const API_BASE_URL = configuredBaseUrl.replace(/\/$/, '')

type ApiErrorPayload = {
  detail?: string | Array<{ msg?: string }>
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getErrorMessage(payload: ApiErrorPayload | null, status: number) {
  if (typeof payload?.detail === 'string') {
    return payload.detail
  }

  if (Array.isArray(payload?.detail)) {
    const firstMessage = payload.detail.find((item) => item.msg)?.msg
    if (firstMessage) {
      return firstMessage
    }
  }

  if (status >= 500) {
    return '服务暂时不可用，请稍后重试'
  }

  return '请求没有成功，请重试'
}

export async function apiRequest<T>(
  path: string,
  options: {
    signal?: AbortSignal
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: unknown
  } = {},
): Promise<T> {
  const isFormData = options.body instanceof FormData
  const requestBody: BodyInit | undefined = options.body instanceof FormData
    ? options.body
    : options.body === undefined
      ? undefined
      : JSON.stringify(options.body)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal: options.signal,
    method: options.method ?? 'GET',
    body: requestBody,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined || isFormData
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
  })

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null

    try {
      payload = (await response.json()) as ApiErrorPayload
    } catch {
      payload = null
    }

    throw new ApiError(response.status, getErrorMessage(payload, response.status))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
