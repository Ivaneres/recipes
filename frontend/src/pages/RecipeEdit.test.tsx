import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecipeEdit from './RecipeEdit'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}))

const mockUseAuth = vi.fn()
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../components/RichTextEditor', () => ({
  default: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string
    onChange: (v: string) => void
    placeholder?: string
  }) => (
    <textarea
      data-testid={`richtext-${placeholder?.replace(/\s/g, '-').slice(0, 20) ?? 'editor'}`}
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}))

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/recipes/new']}>
      <Routes>
        <Route path="/recipes/new" element={<RecipeEdit />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEdit(recipeId: string, recipe?: object) {
  mockGet.mockResolvedValueOnce({ data: recipe ?? defaultRecipe })
  return render(
    <MemoryRouter initialEntries={[`/recipes/${recipeId}/edit`]}>
      <Routes>
        <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
      </Routes>
    </MemoryRouter>
  )
}

const defaultRecipe = {
  id: 1,
  title: 'Existing Recipe',
  description: '<p>Existing description</p>',
  ingredients: [{ name: 'Flour', quantity: 200, unit: 'g' }],
  instructions: '<p>Mix and bake</p>',
  prep_time_minutes: 15,
  cook_time_minutes: 30,
  servings: 4,
  source_url: 'https://example.com/recipe',
  tags: ['dessert'],
  is_private: false,
  cover_image: null,
  created_by: 1,
}

describe('RecipeEdit (create)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', email: 'a@b.com', role: 'admin' },
      isAdmin: true,
    })
  })

  it('renders Create New Recipe form when no id', () => {
    renderCreate()
    expect(screen.getByRole('heading', { name: 'Create New Recipe' })).toBeInTheDocument()
    expect(screen.getByTestId('recipe-title')).toHaveAttribute('placeholder', 'Enter recipe title')
    expect(screen.getByRole('button', { name: /Create Recipe/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Back to Recipes' })).toBeInTheDocument()
  })

  it('submits new recipe and navigates to /recipes', async () => {
    mockPost.mockResolvedValueOnce({})
    renderCreate()
    await userEvent.type(screen.getByTestId('recipe-title'), 'My New Recipe')
    await userEvent.click(screen.getByTestId('recipe-submit'))
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/recipes',
        expect.objectContaining({
          title: 'My New Recipe',
          ingredients: [],
          tags: [],
          is_private: false,
        })
      )
      expect(mockNavigate).toHaveBeenCalledWith('/recipes')
    })
  })

  it('sends optional fields when provided', async () => {
    mockPost.mockResolvedValueOnce({})
    renderCreate()
    await userEvent.type(screen.getByTestId('recipe-title'), 'Pasta')
    const numberInputs = screen.getAllByPlaceholderText('0')
    await userEvent.type(numberInputs[0], '10')
    await userEvent.type(numberInputs[1], '20')
    await userEvent.type(numberInputs[2], '2')
    await userEvent.type(screen.getByPlaceholderText('https://example.com/recipe'), 'https://food.com/pasta')
    await userEvent.click(screen.getByRole('checkbox', { name: /private/ }))
    await userEvent.click(screen.getByTestId('recipe-submit'))
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/recipes',
        expect.objectContaining({
          title: 'Pasta',
          prep_time_minutes: 10,
          cook_time_minutes: 20,
          servings: 2,
          source_url: 'https://food.com/pasta',
          is_private: true,
        })
      )
    })
  })

  it('can add ingredient and include in payload', async () => {
    mockPost.mockResolvedValueOnce({})
    renderCreate()
    await userEvent.type(screen.getByTestId('recipe-title'), 'Soup')
    await userEvent.click(screen.getByTestId('add-ingredient'))
    const nameInput = screen.getByPlaceholderText('Ingredient name')
    await userEvent.type(nameInput, 'Carrots')
    await userEvent.click(screen.getByTestId('recipe-submit'))
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/recipes',
        expect.objectContaining({
          ingredients: [{ name: 'Carrots', quantity: undefined, unit: '' }],
        })
      )
    })
  })

  it('shows error when create fails', async () => {
    mockPost.mockRejectedValueOnce({ response: { data: { detail: 'Title already exists' } } })
    renderCreate()
    await userEvent.type(screen.getByTestId('recipe-title'), 'Duplicate')
    await userEvent.click(screen.getByTestId('recipe-submit'))
    await waitFor(() => {
      expect(screen.getByText('Title already exists')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('Cancel navigates to /recipes', async () => {
    renderCreate()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith('/recipes')
  })
})

describe('RecipeEdit (edit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', email: 'a@b.com', role: 'admin' },
      isAdmin: true,
    })
  })

  it('fetches recipe and shows Edit form with pre-filled data', async () => {
    renderEdit('1')
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/recipes/1')
    })
    expect(screen.getByRole('heading', { name: 'Edit Recipe' })).toBeInTheDocument()
    expect(screen.getByTestId('recipe-title')).toHaveValue('Existing Recipe')
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument()
  })

  it('pre-fills recipe data from fetch', async () => {
    renderEdit('2')
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/recipes/2')
    })
    expect(screen.getByTestId('recipe-title')).toHaveValue('Existing Recipe')
    expect(screen.getByDisplayValue('https://example.com/recipe')).toBeInTheDocument()
  })

  it('submits updated recipe and navigates to /recipes', async () => {
    renderEdit('1')
    await waitFor(() => {
      expect(screen.getByTestId('recipe-title')).toHaveValue('Existing Recipe')
    })
    await userEvent.clear(screen.getByTestId('recipe-title'))
    await userEvent.type(screen.getByTestId('recipe-title'), 'Updated Title')
    await userEvent.click(screen.getByTestId('recipe-submit'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/recipes/1',
        expect.objectContaining({
          title: 'Updated Title',
        })
      )
      expect(mockNavigate).toHaveBeenCalledWith('/recipes')
    })
  })

  it('shows error when fetch fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'))
    render(
      <MemoryRouter initialEntries={['/recipes/99/edit']}>
        <Routes>
          <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
        </Routes>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText('Failed to load recipe')).toBeInTheDocument()
    })
  })

})

describe('RecipeEdit (non-admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'reader', email: 'r@b.com', role: 'reader' },
      isAdmin: false,
    })
  })

  it('renders nothing when user is not admin', () => {
    renderCreate()
    expect(screen.queryByRole('heading', { name: 'Create New Recipe' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('recipe-title')).not.toBeInTheDocument()
  })
})
