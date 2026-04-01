import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserManagement } from '../components/UserManagement';

export default function UserManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <UserManagement
      asPage
      onClose={() => navigate(-1)}
      currentUser={user}
    />
  );
}
