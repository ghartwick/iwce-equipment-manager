import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SiteManagement } from '../components/SiteManagement';

export default function SiteManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <SiteManagement
      asPage
      onClose={() => navigate(-1)}
      currentUser={user ? { username: user.username, role: user.role } : null}
    />
  );
}
