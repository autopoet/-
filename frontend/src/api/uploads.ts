import { apiRequest } from './client'

export type ImageUpload = {
  url: string
  media_type: string
  size: number
}

export function uploadImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiRequest<ImageUpload>('/uploads/images', {
    method: 'POST',
    body: form,
  })
}
