import { Navigate } from 'react-router-dom';

// Legacy /dashboard area replaced by /app. Redirect to canonical portal.
export default function Dashboard() {
  return <Navigate to="/app" replace />;
}