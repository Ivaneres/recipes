import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireAuth?: boolean; // If true, guests cannot access
}

export default function ProtectedRoute({ children, requireAdmin = false, requireAuth = false }: ProtectedRouteProps) {
  const { user, isGuest, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user && !isGuest) {
    return <Navigate to="/login" replace />;
  }

  if (requireAuth && isGuest) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
