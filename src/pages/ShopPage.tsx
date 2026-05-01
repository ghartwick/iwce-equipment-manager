import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
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
  const [shopAttachments, setShopAttachments] = useState<Record<string, any[]>>({});
  const [showShopForm, setShowShopForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [equipmentDataNotes, setEquipmentDataNotes] = useState<string[]>([]);

  const addEquipmentDataNote = () => {
    setEquipmentDataNotes([...equipmentDataNotes, '']);
  };

  const removeEquipmentDataNote = (index: number) => {
    setEquipmentDataNotes(equipmentDataNotes.filter((_, i) => i !== index));
  };

  const updateEquipmentDataNote = (index: number, value: string) => {
    const newNotes = [...equipmentDataNotes];
    newNotes[index] = value;
    setEquipmentDataNotes(newNotes);
  };

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
        
        // Load all attachments for all reports
        const attachmentsMap: Record<string, any[]> = {};
        for (const report of reports) {
          if (report.id) {
            const attachments = await shopAttachmentService.getAttachmentsForReport(report.id);
            attachmentsMap[report.id] = attachments;
          }
        }
        setShopAttachments(attachmentsMap);
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
      // Refresh shop reports and attachments
      const reports = await shopHistoryFirebaseService.getEquipmentShopHistory(equipmentId);
      setShopReports(reports);
      
      // Load all attachments for all reports
      const attachmentsMap: Record<string, any[]> = {};
      for (const report of reports) {
        if (report.id) {
          const attachments = await shopAttachmentService.getAttachmentsForReport(report.id);
          attachmentsMap[report.id] = attachments;
        }
      }
      setShopAttachments(attachmentsMap);
    } catch (error) {
      console.error('Error submitting shop report:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate(-1)}
                className="p-1 text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <h3 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">{equipmentName || 'Loading...'}</h3>
            </div>
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowShopForm(true)}
                className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 p-1"
                title="Add Shop Report"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Equipment Data Notes */}
          <div className="space-y-2 mb-4">
            {equipmentDataNotes.map((note, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => updateEquipmentDataNote(index, e.target.value)}
                  placeholder="Enter equipment data note..."
                  className="flex-1 px-2 py-1.5 border border-yellow-600 rounded-md bg-yellow-200 dark:bg-black text-gray-900 dark:text-yellow-100 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <button
                  type="button"
                  onClick={() => removeEquipmentDataNote(index)}
                  className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addEquipmentDataNote}
              className="flex items-center space-x-1 px-2 py-1 text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 dark:hover:text-yellow-300 border border-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Add Note</span>
            </button>
          </div>

          {/* Services Header */}
          <div className="border-t border-yellow-400 dark:border-yellow-600 pt-4">
            <h2 className="text-base sm:text-lg font-semibold text-yellow-600 dark:text-yellow-400">
              Services
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Loading...</div>
            </div>
          ) : (
            <>
              {/* Services Reports List */}
              {shopReports.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {shopReports.map((report) => (
                    <div key={report.id} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 dark:border-yellow-700">
                      <div className="px-3 py-2">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">
                            by {report.createdBy}
                          </span>
                        </div>
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
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">No service reports yet.</p>
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
    </div>
  );
}

export default ShopPage;
