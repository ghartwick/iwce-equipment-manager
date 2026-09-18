import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Download, Eye, FileText, Map as MapIcon, Upload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { SitePlan, sitePlanService } from '../services/sitePlanService';

/**
 * Read-only library of site plans. Groups every uploaded plan by site and
 * shows only sites that have at least one document. Uploads happen on the
 * site edit page (Manage Sites -> site -> Plans).
 */

interface SiteGroup {
  siteId: string;
  siteName: string;
  plans: SitePlan[];
}

export default function PlansPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [plans, setPlans] = useState<SitePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSiteId, setOpenSiteId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (plan: SitePlan) => {
    setDownloadingId(plan.id);
    setError(null);
    try {
      await sitePlanService.downloadPlan(plan);
    } catch (err: any) {
      setError(err?.message || `Failed to download "${plan.fileName}"`);
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setPlans(await sitePlanService.getAllPlans());
      } catch (err: any) {
        setError(err?.message || 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const groups = useMemo<SiteGroup[]>(() => {
    const bySite = new Map<string, SiteGroup>();
    for (const plan of plans) {
      const group = bySite.get(plan.siteId) ?? {
        siteId: plan.siteId,
        siteName: plan.siteName,
        plans: []
      };
      group.plans.push(plan);
      bySite.set(plan.siteId, group);
    }
    return [...bySite.values()].sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [plans]);

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl">
          {/* Header */}
          <div className="bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 text-yellow-100 dark:text-yellow-400 hover:text-yellow-200 dark:hover:text-yellow-300 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300 flex items-center gap-2">
                <MapIcon className="h-5 w-5" /> Plans
              </h2>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/manage/sites')}
                className="flex items-center space-x-2 px-4 py-2 border border-yellow-600 text-yellow-100 dark:text-yellow-300 rounded-lg hover:bg-yellow-600 hover:text-black transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span>Upload via Manage Sites</span>
              </button>
            )}
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-red-600 dark:text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
                Loading plans...
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-yellow-600 dark:text-yellow-400">
                <MapIcon className="h-8 w-8 mx-auto mb-2 opacity-60" />
                No plans uploaded yet.
                {isAdmin && (
                  <p className="text-sm mt-1">
                    Upload plans from Manage Sites &rarr; pick a site &rarr; Plans.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(group => {
                  const isOpen = openSiteId === group.siteId;
                  return (
                    <div
                      key={group.siteId}
                      className="border border-yellow-300 dark:border-yellow-800 rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenSiteId(isOpen ? null : group.siteId)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 text-left hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
                      >
                        <span className="font-medium text-gray-900 dark:text-yellow-100">
                          {group.siteName}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-400 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100">
                            {group.plans.length} {group.plans.length === 1 ? 'plan' : 'plans'}
                          </span>
                          <ChevronDown
                            className={`h-5 w-5 text-yellow-600 dark:text-yellow-400 transition-transform ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </span>
                      </button>

                      {isOpen && (
                        <ul className="divide-y divide-yellow-200 dark:divide-yellow-800 border-t border-yellow-200 dark:border-yellow-800">
                          {group.plans.map(plan => (
                            <li
                              key={plan.id}
                              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                            >
                              <span className="flex items-center gap-3 min-w-0">
                                <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-gray-900 dark:text-yellow-100 truncate">
                                    {plan.fileName}
                                  </span>
                                  <span className="block text-xs text-yellow-600 dark:text-yellow-500">
                                    {plan.createdAt.toLocaleDateString()}
                                    {plan.uploadedBy ? ` · uploaded by ${plan.uploadedBy}` : ''}
                                  </span>
                                </span>
                              </span>
                              <span className="flex items-center gap-2 flex-shrink-0">
                                <a
                                  href={plan.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-yellow-600 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/40 transition-colors"
                                >
                                  <Eye className="h-3 w-3" /> View
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDownload(plan)}
                                  disabled={downloadingId === plan.id}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50"
                                >
                                  <Download className="h-3 w-3" />
                                  {downloadingId === plan.id ? 'Saving...' : 'Download'}
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
