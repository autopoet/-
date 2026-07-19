import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'

export type User = {
  id: number
  username: string
  role: 'reviewer' | 'contributor'
}

export type Credentials = {
  username: string
  password: string
}

export const authKeys = {
  currentUser: ['auth', 'current-user'] as const,
}

export function register(credentials: Credentials) {
  return apiRequest<User>('/auth/register', {
    method: 'POST',
    body: credentials,
  })
}

export function login(credentials: Credentials) {
  return apiRequest<User>('/auth/login', {
    method: 'POST',
    body: credentials,
  })
}

export function logout() {
  return apiRequest<void>('/auth/logout', { method: 'POST' })
}

export function getCurrentUser(signal?: AbortSignal) {
  return apiRequest<User>('/auth/me', { signal })
}

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.currentUser,
    queryFn: ({ signal }) => getCurrentUser(signal),
    retry: false,
  })
}
