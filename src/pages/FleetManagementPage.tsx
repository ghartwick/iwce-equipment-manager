import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EquipmentManagement } from '../components/EquipmentManagement';
import { fleetManagementService } from '../services/fleetManagementService';

export default function FleetManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <EquipmentManagement
      asPage
      title="Fleet"
      service={fleetManagementService}
      useEmployeeColumn
      hideTimecardColumn
      hideParentUnit
      categoryGroupFilter="fleet"
      showClearAll
      onClose={() => navigate(-1)}
      currentUser={user ? { username: user.username, role: user.role } : null}
    />
  );
}
