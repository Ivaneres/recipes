import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import Login from './pages/Login';
import RecipeList from './pages/RecipeList';
import RecipeDetail from './pages/RecipeDetail';
import RecipeEdit from './pages/RecipeEdit';
import RecipeImport from './pages/RecipeImport';
import MealPlans from './pages/MealPlans';
import MealPlanDetail from './pages/MealPlanDetail';
import Cook from './pages/Cook';
import AddRecipe from './pages/AddRecipe';
import RecipeCook from './pages/RecipeCook';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/recipes" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/recipes"
              element={
                <ProtectedRoute>
                  <RecipeList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/:id"
              element={
                <ProtectedRoute>
                  <RecipeDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/:id/cook"
              element={
                <ProtectedRoute>
                  <RecipeCook />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/:id/edit"
              element={
                <ProtectedRoute requireAuth>
                  <RecipeEdit />
                </ProtectedRoute>
              }
            />

            <Route
              path="/cook"
              element={
                <ProtectedRoute>
                  <Cook />
                </ProtectedRoute>
              }
            />

            <Route
              path="/add"
              element={
                <ProtectedRoute requireAuth>
                  <AddRecipe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add/manual"
              element={
                <ProtectedRoute requireAuth>
                  <RecipeEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add/import"
              element={
                <ProtectedRoute requireAuth>
                  <RecipeImport />
                </ProtectedRoute>
              }
            />

            {/* Legacy entrypoints (kept for now; may redirect later) */}
            <Route
              path="/recipes/new"
              element={
                <ProtectedRoute requireAuth>
                  <Navigate to="/add/manual" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipes/import"
              element={
                <ProtectedRoute requireAuth>
                  <Navigate to="/add/import" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/meal-plans"
              element={
                <ProtectedRoute requireAuth>
                  <MealPlans />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meal-plans/:id"
              element={
                <ProtectedRoute requireAuth>
                  <MealPlanDetail />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/recipes" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
