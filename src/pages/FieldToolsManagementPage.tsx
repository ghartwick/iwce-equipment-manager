import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FieldToolsManagement } from '../components/FieldToolsManagement';

export default function FieldToolsManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <FieldToolsManagement
      asPage
      onClose={() => navigate(-1)}
      currentUser={user ? { username: user.username, role: user.role } : null}
    />
  );
}
