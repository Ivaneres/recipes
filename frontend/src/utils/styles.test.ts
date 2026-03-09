import { describe, it, expect } from 'vitest'
import { sharedStyles } from './styles'

describe('sharedStyles', () => {
  it('is a non-empty string', () => {
    expect(typeof sharedStyles).toBe('string')
    expect(sharedStyles.length).toBeGreaterThan(0)
  })

  it('includes common action button classes', () => {
    expect(sharedStyles).toContain('action-button')
    expect(sharedStyles).toContain('action-button-primary')
    expect(sharedStyles).toContain('action-button-secondary')
    expect(sharedStyles).toContain('action-button-danger')
    expect(sharedStyles).toContain('action-button-success')
  })

  it('includes form and card classes', () => {
    expect(sharedStyles).toContain('form-input')
    expect(sharedStyles).toContain('form-label')
    expect(sharedStyles).toContain('form-group')
    expect(sharedStyles).toContain('card')
  })

  it('includes alert classes', () => {
    expect(sharedStyles).toContain('alert')
    expect(sharedStyles).toContain('alert-error')
    expect(sharedStyles).toContain('alert-success')
    expect(sharedStyles).toContain('alert-info')
  })

  it('includes page layout classes', () => {
    expect(sharedStyles).toContain('page-container')
    expect(sharedStyles).toContain('page-title')
    expect(sharedStyles).toContain('page-subtitle')
  })
})
