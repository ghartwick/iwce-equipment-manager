import { Navigate, useParams } from 'react-router-dom';

// Servicing now lives on the unit's page, below the inspections. This route is
// kept only so old links and bookmarks still land somewhere useful.
export default function ShopPage() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  return <Navigate to={equipmentId ? `/inventory/equipment/${equipmentId}` : '/inventory'} replace />;
}
