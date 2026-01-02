import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

interface Recipe {
  id: number;
  title: string;
  description: string;
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
}

interface MealPlan {
  id: number;
  name: string;
  recipes?: Recipe[];
}

interface MealPlanSummary {
  total_prep_time: number | null;
  total_cook_time: number | null;
  total_servings: number | null;
  recipe_count: number;
  combined_ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
}

export default function MealPlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [summary, setSummary] = useState<MealPlanSummary | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRecipe, setAddingRecipe] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | ''>('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [planRes, summaryRes, recipesRes] = await Promise.all([
        api.get(`/meal-plans/${id}`),
        api.get(`/meal-plans/${id}/summary`),
        api.get('/recipes'),
      ]);
      setMealPlan(planRes.data);
      setSummary(summaryRes.data);
      setAllRecipes(recipesRes.data);
    } catch (error) {
      console.error('Error fetching meal plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipe = async () => {
    if (!selectedRecipeId) return;
    setAddingRecipe(true);
    try {
      await api.post(`/meal-plans/${id}/recipes/${selectedRecipeId}`);
      setSelectedRecipeId('');
      fetchData();
    } catch (error: any) {
      console.error('Error adding recipe:', error);
      alert(error.response?.data?.detail || 'Failed to add recipe');
    } finally {
      setAddingRecipe(false);
    }
  };

  const handleRemoveRecipe = async (recipeId: number) => {
    if (!confirm('Remove this recipe from the meal plan?')) return;
    try {
      await api.delete(`/meal-plans/${id}/recipes/${recipeId}`);
      fetchData();
    } catch (error) {
      console.error('Error removing recipe:', error);
      alert('Failed to remove recipe');
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', color: '#213547' }}>Loading...</div>;
  }

  if (!mealPlan) {
    return <div style={{ padding: '20px', color: '#213547' }}>Meal plan not found</div>;
  }

  const currentRecipeIds = mealPlan.recipes?.map(r => r.id) || [];
  const availableRecipes = allRecipes.filter(r => !currentRecipeIds.includes(r.id));

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', color: '#213547' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/meal-plans" style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Back to Meal Plans
        </Link>
      </div>

      <h1 style={{ color: '#213547' }}>{mealPlan.name}</h1>

      {/* Summary Section */}
      {summary && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
          <h2 style={{ color: '#213547', marginTop: 0 }}>Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#666' }}>Total Recipes</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#213547' }}>{summary.recipe_count}</div>
            </div>
            {summary.total_prep_time && (
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Total Prep Time</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#213547' }}>{summary.total_prep_time} min</div>
              </div>
            )}
            {summary.total_cook_time && (
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Total Cook Time</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#213547' }}>{summary.total_cook_time} min</div>
              </div>
            )}
            {summary.total_servings && (
              <div>
                <div style={{ fontSize: '14px', color: '#666' }}>Total Servings</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#213547' }}>{summary.total_servings}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Combined Ingredients */}
      {summary && summary.combined_ingredients.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#213547' }}>Combined Shopping List</h2>
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef' }}>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {summary.combined_ingredients.map((ing, idx) => (
                <li key={idx} style={{ marginBottom: '5px', color: '#213547' }}>
                  {ing.quantity && `${ing.quantity} `}
                  {ing.unit && `${ing.unit} `}
                  {ing.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Add Recipe Section */}
      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3 style={{ color: '#213547', marginTop: 0 }}>Add Recipe to Meal Plan</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedRecipeId}
            onChange={(e) => setSelectedRecipeId(e.target.value ? Number(e.target.value) : '')}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            <option value="">Select a recipe...</option>
            {availableRecipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.title}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddRecipe}
            disabled={addingRecipe || !selectedRecipeId}
            style={{
              padding: '8px 16px',
              backgroundColor: addingRecipe || !selectedRecipeId ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: addingRecipe || !selectedRecipeId ? 'not-allowed' : 'pointer',
            }}
          >
            {addingRecipe ? 'Adding...' : 'Add Recipe'}
          </button>
        </div>
        {availableRecipes.length === 0 && (
          <p style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>
            All available recipes are already in this meal plan.
          </p>
        )}
      </div>

      {/* Recipes List */}
      <div>
        <h2 style={{ color: '#213547' }}>Recipes in Meal Plan</h2>
        {mealPlan.recipes && mealPlan.recipes.length > 0 ? (
          <div style={{ display: 'grid', gap: '15px' }}>
            {mealPlan.recipes.map((recipe) => (
              <div
                key={recipe.id}
                style={{
                  padding: '15px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                  <Link
                    to={`/recipes/${recipe.id}`}
                    style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#007bff',
                      textDecoration: 'none',
                    }}
                  >
                    {recipe.title}
                  </Link>
                  <button
                    onClick={() => handleRemoveRecipe(recipe.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                  {recipe.prep_time_minutes && `Prep: ${recipe.prep_time_minutes} min `}
                  {recipe.cook_time_minutes && `Cook: ${recipe.cook_time_minutes} min `}
                  {recipe.servings && `Servings: ${recipe.servings}`}
                </div>
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    <strong>Ingredients:</strong> {recipe.ingredients.map(ing => ing.name).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No recipes in this meal plan yet. Add some recipes above!</p>
        )}
      </div>
    </div>
  );
}
