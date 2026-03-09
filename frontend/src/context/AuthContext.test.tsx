import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthContext'

const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

const storage: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value },
  removeItem: (key: string) => { delete storage[key] },
  clear: () => { for (const k of Object.keys(storage)) delete storage[k] },
  get length() { return Object.keys(storage).length },
  key: (i: number) => Object.keys(storage)[i] ?? null,
}

function TestConsumer() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="guest">{String(auth.isGuest)}</span>
      <span data-testid="username">{auth.user?.username ?? 'none'}</span>
      <span data-testid="admin">{String(auth.isAdmin)}</span>
      <button type="button" onClick={() => auth.loginAsGuest()}>
        Guest
      </button>
      <button type="button" onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(globalThis, { localStorage: localStorageMock })
    localStorageMock.clear()
  })

  it('useAuth throws when used outside AuthProvider', () => {
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider')
  })

  it('when no token and not guest, sets isLoading to false and user remains null', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('username')).toHaveTextContent('none')
  })

  it('when isGuest in localStorage, sets guest user and not loading', async () => {
    localStorage.setItem('isGuest', 'true')
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('guest')).toHaveTextContent('true')
    expect(screen.getByTestId('username')).toHaveTextContent('Guest')
  })

  it('loginAsGuest sets guest state and stores in localStorage', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Guest' }))
    expect(screen.getByTestId('guest')).toHaveTextContent('true')
    expect(screen.getByTestId('username')).toHaveTextContent('Guest')
    expect(localStorage.getItem('isGuest')).toBe('true')
  })

  it('logout clears user and localStorage', async () => {
    localStorage.setItem('isGuest', 'true')
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('username')).toHaveTextContent('Guest')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(screen.getByTestId('username')).toHaveTextContent('none')
    expect(screen.getByTestId('guest')).toHaveTextContent('false')
    expect(localStorage.getItem('isGuest')).toBeNull()
  })

  it('when token in localStorage, fetches user and sets isAdmin from role', async () => {
    localStorage.setItem('token', 'fake-token')
    mockGet.mockResolvedValueOnce({
      data: { id: 1, username: 'admin', email: 'a@b.com', role: 'admin' },
    })
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('username')).toHaveTextContent('admin')
    expect(screen.getByTestId('admin')).toHaveTextContent('true')
  })

  it('when token in localStorage but fetch fails, clears token', async () => {
    localStorage.setItem('token', 'bad-token')
    mockGet.mockRejectedValueOnce(new Error('Unauthorized'))
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.getByTestId('username')).toHaveTextContent('none')
  })
})
