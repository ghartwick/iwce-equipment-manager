import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { SmallToolsManagement } from '../components/SmallToolsManagement';

export default function SmallToolsManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <SmallToolsManagement
      asPage
      onClose={() => navigate(-1)}
      currentUser={user ? { username: user.username, role: user.role } : null}
    />
  );
}
