import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navigation from './Navigation'

vi.mock('../context/AuthContext')

function renderNav(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Navigation />
    </MemoryRouter>
  )
}

describe('Navigation', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: 'alice', email: 'a@b.com', role: 'reader' },
      isGuest: false,
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>)
  })

  it('renders Home and Recipes links', () => {
    renderNav()
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /Recipes/ })).toHaveAttribute('href', '/recipes')
  })

  it('renders Meal Plans when not guest', () => {
    renderNav()
    expect(screen.getByRole('link', { name: /Meal Plans/ })).toBeInTheDocument()
  })

  it('renders username and Logout when not guest', () => {
    renderNav()
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
  })

  it('calls logout when Logout is clicked', async () => {
    const mockLogout = vi.fn()
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: 'alice', email: 'a@b.com', role: 'reader' },
      isGuest: false,
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuth>)
    renderNav()
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(mockLogout).toHaveBeenCalled()
  })
})

describe('Navigation as guest', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 0, username: 'Guest', email: '', role: 'reader' },
      isGuest: true,
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>)
  })

  it('does not render Meal Plans and shows Guest and Login button', () => {
    renderNav()
    expect(screen.queryByRole('link', { name: /Meal Plans/ })).not.toBeInTheDocument()
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })
})

describe('Navigation on login page', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isGuest: false,
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>)
  })

  it('renders nothing on /login', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Navigation />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: /Home/ })).not.toBeInTheDocument()
  })
})
