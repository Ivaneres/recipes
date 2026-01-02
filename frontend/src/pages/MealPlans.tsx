import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { sharedStyles } from '../utils/styles';

interface MealPlan {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  recipes?: Recipe[];
}

interface Recipe {
  id: number;
  title: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
}

interface MealPlanSummary {
  total_prep_time: number | null;
  total_cook_time: number | null;
  total_servings: number | null;
  recipe_count: number;
  combined_ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
}

export default function MealPlans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMealPlanName, setNewMealPlanName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchMealPlans();
  }, []);

  const fetchMealPlans = async () => {
    try {
      const response = await api.get('/meal-plans');
      setMealPlans(response.data);
    } catch (error) {
      console.error('Error fetching meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMealPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMealPlanName.trim()) return;
    setCreating(true);
    try {
      await api.post('/meal-plans', { name: newMealPlanName });
      setNewMealPlanName('');
      setShowCreateForm(false);
      fetchMealPlans();
    } catch (error) {
      console.error('Error creating meal plan:', error);
      alert('Failed to create meal plan');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMealPlan = async (id: number) => {
    if (!confirm('Are you sure you want to delete this meal plan?')) return;
    try {
      await api.delete(`/meal-plans/${id}`);
      fetchMealPlans();
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      alert('Failed to delete meal plan');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666', fontSize: '1.1rem' }}>
          Loading meal plans...
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <style>{sharedStyles}</style>
      
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <h1 className="page-title">Meal Plans</h1>
          <p className="page-subtitle">Plan your meals and generate shopping lists</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="action-button action-button-success"
        >
          + New Meal Plan
        </button>
      </div>

      {showCreateForm && (
        <div className="card" style={{ marginBottom: '32px' }}>
          <form onSubmit={handleCreateMealPlan}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Meal Plan Name</label>
              <input
                type="text"
                value={newMealPlanName}
                onChange={(e) => setNewMealPlanName(e.target.value)}
                placeholder="e.g., Week of Jan 1"
                required
                className="form-input"
                style={{ maxWidth: '400px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                disabled={creating}
                className="action-button action-button-primary"
                style={{ 
                  opacity: creating ? 0.6 : 1,
                  cursor: creating ? 'not-allowed' : 'pointer'
                }}
              >
                {creating ? '⏳ Creating...' : '✨ Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewMealPlanName('');
                }}
                className="action-button action-button-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {mealPlans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: '#666', fontSize: '1.1rem', margin: 0 }}>
            No meal plans yet. Create one to get started!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
          {mealPlans.map((mealPlan) => (
            <MealPlanCard
              key={mealPlan.id}
              mealPlan={mealPlan}
              onDelete={handleDeleteMealPlan}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MealPlanCard({ mealPlan, onDelete }: { mealPlan: MealPlan; onDelete: (id: number) => void }) {
  const [summary, setSummary] = useState<MealPlanSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    fetchMealPlanDetails();
  }, [mealPlan.id]);

  const fetchMealPlanDetails = async () => {
    try {
      setLoading(true);
      const [planRes, summaryRes] = await Promise.all([
        api.get(`/meal-plans/${mealPlan.id}`),
        api.get(`/meal-plans/${mealPlan.id}/summary`),
      ]);
      setRecipes(planRes.data.recipes || []);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching meal plan details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ 
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: '#213547', margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
          {mealPlan.name}
        </h3>
        <button
          onClick={() => onDelete(mealPlan.id)}
          className="action-button action-button-danger"
          style={{ padding: '8px 16px', fontSize: '0.875rem' }}
        >
          🗑️ Delete
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Loading...</div>
      ) : (
        <>
          {summary && (
            <div style={{ 
              marginBottom: '20px', 
              padding: '16px', 
              background: '#f8f9fa', 
              borderRadius: '8px',
              borderLeft: '3px solid #007bff'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
                Summary
              </div>
              <div style={{ fontSize: '0.95rem', color: '#213547', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong>{summary.recipe_count}</strong> {summary.recipe_count === 1 ? 'recipe' : 'recipes'}
                </div>
                {summary.total_prep_time && (
                  <div style={{ marginBottom: '4px' }}>
                    ⏱️ <strong>{summary.total_prep_time}</strong> min prep time
                  </div>
                )}
                {summary.total_cook_time && (
                  <div style={{ marginBottom: '4px' }}>
                    🔥 <strong>{summary.total_cook_time}</strong> min cook time
                  </div>
                )}
                {summary.total_servings && (
                  <div>
                    👥 <strong>{summary.total_servings}</strong> total servings
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '12px', fontWeight: '500' }}>
              Recipes ({recipes.length})
            </div>
            {recipes.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>
                No recipes added yet.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.95rem', lineHeight: '1.8' }}>
                {recipes.map((recipe) => (
                  <li key={recipe.id} style={{ marginBottom: '4px' }}>
                    <Link
                      to={`/recipes/${recipe.id}`}
                      style={{ 
                        color: '#007bff', 
                        textDecoration: 'none',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0056b3'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#007bff'}
                    >
                      {recipe.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to={`/meal-plans/${mealPlan.id}`}
            className="action-button action-button-primary"
            style={{ 
              textDecoration: 'none', 
              width: '100%', 
              justifyContent: 'center',
              display: 'flex'
            }}
          >
            View Details →
          </Link>
        </>
      )}
    </div>
  );
}
