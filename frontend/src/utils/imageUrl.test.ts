import { describe, it, expect } from 'vitest'
import { getImageUrl, fixImageUrls } from './imageUrl'

describe('getImageUrl', () => {
  it('returns null for null, undefined, or empty string', () => {
    expect(getImageUrl(null)).toBeNull()
    expect(getImageUrl(undefined)).toBeNull()
    expect(getImageUrl('')).toBeNull()
  })

  it('returns full URL unchanged when path starts with http', () => {
    expect(getImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png')
    expect(getImageUrl('http://cdn.example.com/photo.jpg')).toBe('http://cdn.example.com/photo.jpg')
  })

  it('builds URL with base (strips /api from default VITE_API_URL)', () => {
    const result = getImageUrl('/uploads/abc.jpg')
    expect(result).toContain('/uploads/abc.jpg')
    expect(result).not.toContain('/api/uploads')
    expect(result).toMatch(/^https?:\/\//)
  })

  it('adds leading slash to path when missing', () => {
    const result = getImageUrl('uploads/foo.png')
    expect(result).toContain('/uploads/foo.png')
  })
})

describe('fixImageUrls', () => {
  it('returns empty string unchanged', () => {
    expect(fixImageUrls('')).toBe('')
  })

  it('replaces /api/uploads with base URL in src attributes', () => {
    const html = '<img src="/api/uploads/foo.jpg">'
    const result = fixImageUrls(html)
    expect(result).not.toContain('/api/uploads/')
    expect(result).toContain('/uploads/foo.jpg')
  })

  it('replaces /uploads with full base URL in src attributes', () => {
    const html = '<img src="/uploads/bar.png">'
    const result = fixImageUrls(html)
    expect(result).toContain('/uploads/bar.png')
    expect(result).toMatch(/src="[^"]*\/uploads\/bar\.png"/)
  })

  it('leaves other content unchanged', () => {
    const html = '<p>Hello</p><img src="/uploads/a.jpg">'
    expect(fixImageUrls(html)).toContain('<p>Hello</p>')
  })
})
