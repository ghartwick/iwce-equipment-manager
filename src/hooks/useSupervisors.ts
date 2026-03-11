import { useState, useEffect } from 'react';
import { UserManagementService, AppUser } from '../services/userManagementService';

export const useSupervisors = () => {
  const [supervisors, setSupervisors] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        setLoading(true);
        const userManagementService = new UserManagementService();
        const allUsers = await userManagementService.getAllUsers();
        
        // Filter only active supervisors
        const supervisorUsers = allUsers.filter(user => 
          user.role === 'supervisor' && user.isActive
        );
        
        setSupervisors(supervisorUsers);
      } catch (err) {
        setError('Failed to fetch supervisors');
        console.error('Error fetching supervisors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisors();
  }, []);

  return {
    supervisors,
    loading,
    error,
  };
};
