import { describe, it, expect } from 'vitest'
import api from './api'

describe('api', () => {
  it('has axios-like methods', () => {
    expect(api.get).toBeDefined()
    expect(api.post).toBeDefined()
    expect(api.put).toBeDefined()
    expect(api.delete).toBeDefined()
  })

  it('has baseURL ending with /api', () => {
    expect(api.defaults.baseURL).toBeDefined()
    expect(api.defaults.baseURL).toMatch(/\/api$/)
  })

  it('has request and response interceptors registered', () => {
    const requestHandlers = (api.interceptors.request as unknown as { handlers: unknown[] }).handlers
    const responseHandlers = (api.interceptors.response as unknown as { handlers: unknown[] }).handlers
    expect(requestHandlers.length).toBeGreaterThan(0)
    expect(responseHandlers.length).toBeGreaterThan(0)
  })
})
