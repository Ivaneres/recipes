import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

const mockUseAuth = vi.fn()
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRouter(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Loading when isLoading is true', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isGuest: false,
      isAdmin: false,
      isLoading: true,
    })
    renderWithRouter()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('redirects to /login when no user and not guest', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isGuest: false,
      isAdmin: false,
      isLoading: false,
    })
    renderWithRouter()
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when user is set', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'alice', email: 'a@b.com', role: 'reader' },
      isGuest: false,
      isAdmin: false,
      isLoading: false,
    })
    renderWithRouter()
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('renders children when isGuest is true (no requireAuth)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 0, username: 'Guest', email: '', role: 'reader' },
      isGuest: true,
      isAdmin: false,
      isLoading: false,
    })
    renderWithRouter()
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to /login when requireAuth is true and isGuest', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 0, username: 'Guest', email: '', role: 'reader' },
      isGuest: true,
      isAdmin: false,
      isLoading: false,
    })
    render(
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route
            path="/admin-only"
            element={
              <ProtectedRoute requireAuth>
                <div>Admin only content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Admin only content')).not.toBeInTheDocument()
  })

  it('redirects to / when requireAdmin is true and user is not admin', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'reader', email: 'r@b.com', role: 'reader' },
      isGuest: false,
      isAdmin: false,
      isLoading: false,
    })
    render(
      <MemoryRouter initialEntries={['/admin-area']}>
        <Routes>
          <Route
            path="/admin-area"
            element={
              <ProtectedRoute requireAdmin>
                <div>Admin area</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument()
  })

  it('renders children when requireAdmin is true and user is admin', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', email: 'a@b.com', role: 'admin' },
      isGuest: false,
      isAdmin: true,
      isLoading: false,
    })
    render(
      <MemoryRouter initialEntries={['/admin-area']}>
        <Routes>
          <Route
            path="/admin-area"
            element={
              <ProtectedRoute requireAdmin>
                <div>Admin area</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Admin area')).toBeInTheDocument()
  })
})
