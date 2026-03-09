import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Home from './Home'

vi.mock('../context/AuthContext')

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

describe('Home', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: 'alice', email: 'a@b.com', role: 'reader' },
      isGuest: false,
    } as ReturnType<typeof useAuth>)
  })

  it('renders app title and welcome message', () => {
    renderHome()
    expect(screen.getByRole('heading', { name: 'Recipe Tracking App' })).toBeInTheDocument()
    expect(screen.getByText(/Welcome back, alice/)).toBeInTheDocument()
  })

  it('renders Browse Recipes link', () => {
    renderHome()
    expect(screen.getByRole('link', { name: /Browse Recipes/ })).toHaveAttribute('href', '/recipes')
  })

  it('renders Create Recipe link when not guest', () => {
    renderHome()
    expect(screen.getByRole('link', { name: /Create Recipe/ })).toHaveAttribute('href', '/recipes/new')
  })

  it('hides Create Recipe link when guest', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 0, username: 'Guest', email: '', role: 'reader' },
      isGuest: true,
    } as ReturnType<typeof useAuth>)
    renderHome()
    expect(screen.getByText(/Welcome back, Guest/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Create Recipe/ })).not.toBeInTheDocument()
  })
})
