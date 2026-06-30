import { Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ClientManagement } from '../components/ClientManagement';

export default function SiteManagementPage() {
  const { user } = useAuth();
  const currentUser = user ? { username: user.username, role: user.role } : null;

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
          <div className="bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700">
            <div className="flex items-center space-x-2">
              <Building2 className="h-6 w-6 text-yellow-100 dark:text-yellow-300" />
              <h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">Client Management</h2>
            </div>
            <p className="text-xs text-yellow-200 dark:text-yellow-400 mt-1">Create a client, then add its sites underneath it.</p>
          </div>
          <div className="p-6">
            <ClientManagement currentUser={currentUser} />
          </div>
        </div>
      </div>
    </div>
  );
}
