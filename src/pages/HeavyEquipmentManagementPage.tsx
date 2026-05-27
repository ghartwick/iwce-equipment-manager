import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EquipmentManagement } from '../components/EquipmentManagement';

export default function HeavyEquipmentManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <EquipmentManagement
      asPage
      categoryGroupFilter="heavy"
      onClose={() => navigate(-1)}
      currentUser={user ? { username: user.username, role: user.role } : null}
    />
  );
}
