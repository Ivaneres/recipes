import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecipeCook from './RecipeCook'

const mockGet = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

const storage: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value
  },
  removeItem: (key: string) => {
    delete storage[key]
  },
  clear: () => {
    for (const k of Object.keys(storage)) delete storage[k]
  },
  get length() {
    return Object.keys(storage).length
  },
  key: (i: number) => Object.keys(storage)[i] ?? null,
}

function renderCook() {
  return render(
    <MemoryRouter initialEntries={['/recipes/1/cook']}>
      <Routes>
        <Route path="/recipes/:id/cook" element={<RecipeCook />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RecipeCook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(globalThis, { localStorage: localStorageMock })
    localStorageMock.clear()

    mockGet.mockResolvedValue({
      data: {
        id: 1,
        title: 'Test Recipe',
        cover_image: null,
        ingredients: [
          { name: 'Flour', quantity: 200, unit: 'g' },
          { name: 'Water', quantity: 100, unit: 'ml' },
        ],
        instructions: 'First step.\n\nSecond step.\n\nThird step.',
      },
    })
  })

  it('auto-advances to the next step when completing the current step', async () => {
    const user = userEvent.setup()
    renderCook()

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('First step.')
    })

    expect(screen.getByTestId('complete-step-button')).toHaveTextContent('Complete step')

    await user.click(screen.getByTestId('complete-step-button'))

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('Second step.')
    })

    // Step 1 should now be marked done in the scan map.
    expect(screen.getByTestId('step-map-item-0')).toHaveTextContent('✓')
  })

  it('jumps to a clicked step in the scan map', async () => {
    const user = userEvent.setup()
    renderCook()

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('First step.')
    })

    await user.click(screen.getByTestId('step-map-item-2'))

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('Third step.')
    })
  })
})

