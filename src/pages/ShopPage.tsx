import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { shopHistoryFirebaseService, ShopReport } from '../services/shopHistoryFirebaseService';
import { shopAttachmentService } from '../services/shopAttachmentService';
import { ShopForm } from '../components/ShopForm';
import { useAuth } from '../hooks/useAuth';

export function ShopPage() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [equipmentName, setEquipmentName] = useState<string>('');
  const [shopReports, setShopReports] = useState<ShopReport[]>([]);
  const [expandedShopReport, setExpandedShopReport] = useState<string | null>(null);
  const [shopAttachments, setShopAttachments] = useState<Record<string, any[]>>({});
  const [showShopForm, setShowShopForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (equipmentId) {
      loadShopReports();
    }
  }, [equipmentId]);

  const loadShopReports = async () => {
    if (!equipmentId) return;
    
    try {
      setLoading(true);
      const reports = await shopHistoryFirebaseService.getEquipmentShopHistory(equipmentId);
      setShopReports(reports);
      if (reports.length > 0) {
        setEquipmentName(reports[0].equipmentName);
      }
    } catch (error) {
      console.error('Error loading shop reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShopSubmit = async (shopReport: { lastServicedDate?: string; lastServiceHours?: number; serviceInterval?: number; notes?: string }, files?: File[]) => {
    if (!equipmentId || !user || !equipmentName) return;
    
    try {
      const reportId = await shopHistoryFirebaseService.addShopReport(
        equipmentId,
        equipmentName,
        shopReport,
        { username: user.username, role: user.role }
      );
      
      // Upload files if provided
      if (files && files.length > 0) {
        for (const file of files) {
          await shopAttachmentService.uploadAttachment({
            shopReportId: reportId,
            equipmentId,
            equipmentName,
            file,
            uploadedBy: user.id
          });
        }
      }
      
      setShowShopForm(false);
      // Refresh shop reports
      const reports = await shopHistoryFirebaseService.getEquipmentShopHistory(equipmentId);
      setShopReports(reports);
    } catch (error) {
      console.error('Error submitting shop report:', error);
      throw error;
    }
  };

  const handleShopReportExpand = async (reportId: string | null) => {
    const newExpanded = expandedShopReport === reportId ? null : reportId;
    setExpandedShopReport(newExpanded);
    
    if (newExpanded && reportId) {
      try {
        const attachments = await shopAttachmentService.getAttachmentsForReport(reportId);
        setShopAttachments(prev => ({ ...prev, [reportId]: attachments }));
      } catch (error) {
        console.error('Error fetching shop attachments:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-yellow-800 dark:text-yellow-200">
              Shop Reports - {equipmentName || 'Loading...'}
            </h1>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowShopForm(true)}
              className="px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 font-medium transition-colors"
            >
              Add Shop Report
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-yellow-600 dark:text-yellow-400">Loading...</div>
          </div>
        ) : (
          <>
            {/* Shop Reports List */}
            {shopReports.length > 0 ? (
              <div className="space-y-2 mt-3">
                {shopReports.map((report) => (
                  <div key={report.id} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
                    <button
                      type="button"
                      onClick={() => handleShopReportExpand(report.id || null)}
                      className="w-full px-3 py-2 flex items-center justify-between text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">
                            by {report.createdBy}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {report.lastServicedDate && `Serviced Date: ${report.lastServicedDate}`}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {report.lastServiceHours && `Serviced Hours At: ${report.lastServiceHours}`}
                        </div>
                        {report.notes && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Notes: {report.notes.substring(0, 50)}{report.notes.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </div>
                      {expandedShopReport === report.id ? (
                        <ChevronUp className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      )}
                    </button>
                    
                    {expandedShopReport === report.id && (
                      <div className="px-3 pb-3 pt-0 border-t border-yellow-200 dark:border-yellow-800">
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-700 dark:text-gray-300">
                          <div><strong>Serviced Date:</strong> {report.lastServicedDate || 'N/A'}</div>
                          <div><strong>Serviced Hours At:</strong> {report.lastServiceHours || 'N/A'}</div>
                          <div><strong>Service Interval:</strong> {report.serviceInterval || 'N/A'}</div>
                        </div>
                        {report.notes && (
                          <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                            <div className="text-xs text-gray-700 dark:text-gray-300">
                              <strong>Notes:</strong> {report.notes}
                            </div>
                          </div>
                        )}
                        {shopAttachments[report.id!] && shopAttachments[report.id!].length > 0 && (
                          <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                            <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                              <strong>Attachments:</strong>
                            </div>
                            <div className="space-y-1">
                              {shopAttachments[report.id!].map((attachment, index) => (
                                <a
                                  key={index}
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs text-yellow-600 dark:text-yellow-400 hover:underline"
                                >
                                  {attachment.fileName}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">No shop reports yet.</p>
            )}
          </>
        )}

        {/* Shop Form Modal */}
        {showShopForm && (
          <ShopForm
            equipmentId={equipmentId!}
            equipmentName={equipmentName}
            onClose={() => setShowShopForm(false)}
            onSubmit={handleShopSubmit}
            initialServiceInterval={shopReports.length > 0 ? shopReports[0].serviceInterval : undefined}
          />
        )}
      </div>
    </div>
  );
}

export default ShopPage;
