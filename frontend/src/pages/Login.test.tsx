import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockLoginAsGuest = vi.fn()
const mockNavigate = vi.fn()
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    loginAsGuest: mockLoginAsGuest,
  }),
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form by default', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Login as Guest/ })).toBeInTheDocument()
  })

  it('switches to register form when Register is clicked', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Register' }))
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
  })

  it('shows Passwords do not match when register with mismatched passwords', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Register' }))
    await userEvent.type(screen.getByPlaceholderText('Enter your username'), 'testuser')
    await userEvent.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
    await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'pass123')
    await userEvent.type(screen.getByPlaceholderText('Confirm your password'), 'pass456')
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('calls login and navigate on successful sign in', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('Enter your username'), 'admin')
    await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'admin')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('shows API error when login fails', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { detail: 'Invalid credentials' } } })
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('Enter your username'), 'bad')
    await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'bad')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('calls loginAsGuest and navigate when Login as Guest is clicked', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /Login as Guest/ }))
    expect(mockLoginAsGuest).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
