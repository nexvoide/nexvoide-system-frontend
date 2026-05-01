import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Calendar, CheckCircle, Loader } from 'lucide-react';
import { getClosableMonthYear, getMonthLabel, closeMonth } from '../../utils/monthlyClosing.js';
import { useAppStore } from '../../stores/appStore.js';
import ProjectReviewDialog from './ProjectReviewDialog.jsx';

export default function MonthlyClosingDialog({ open, onClose, onSuccess }) {
  const { user, currency, rate, refreshProjects, projects } = useAppStore();
  const [step, setStep] = useState(1); // 1: confirmation, 2: review projects, 3: processing
  const [showReview, setShowReview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [closeResult, setCloseResult] = useState(null);
  
  const current = getClosableMonthYear();
  const monthLabel = getMonthLabel(current.year, current.month);

  const handleStartReview = () => {
    setShowReview(true);
  };

  const handleReviewConfirm = async (options) => {
    setShowReview(false);
    setStep(3);
    setProcessing(true);
    setError(null);

    try {
      const userId = user?.id || user?.username || 'admin';
      const result = await closeMonth(current.year, current.month, userId, {
        currency,
        rate,
        ...options
      });

      // Store result for display
      setCloseResult(result);

      // Wait a moment for database to process all updates
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh projects to remove archived ones from active view
      // This ensures pulled-forward projects are visible in the next month
      try {
        await refreshProjects();
        console.log('✅ Projects refreshed after closing month');
        console.log(`✅ Pulled forward ${result.pulledProjects} projects`);
        console.log(`✅ Archived ${result.archivedProjects} projects`);
        
        // Verify pulled-forward projects are in the refreshed list
        const refreshedProjects = useAppStore.getState().projects;
        const pulledForwardProjects = refreshedProjects.filter(p => 
          p.pulled_forward === true || p.pulledForward === true
        );
        console.log(`🔍 Verification: Found ${pulledForwardProjects.length} pulled-forward projects in refreshed list:`, 
          pulledForwardProjects.map(p => ({ 
            id: p.id, 
            name: p.project_name || p.projectName, 
            pulled_forward: p.pulled_forward || p.pulledForward,
            start_date: p.start_date || p.startDate,
            status: p.status
          }))
        );
        
        if (pulledForwardProjects.length === 0 && result.pulledProjects > 0) {
          console.error('❌ WARNING: Projects were pulled forward but not found in refreshed list!');
          console.error('  - This might be a refresh timing issue or database sync problem');
        }
      } catch (refreshError) {
        console.warn('⚠️ Failed to refresh projects after closing:', refreshError);
      }

      if (onSuccess) {
        onSuccess(result);
      }
      
      // Reset and close
      setTimeout(() => {
        setStep(1);
        setProcessing(false);
        setCloseResult(null);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error closing month:', err);
      setError(err.message || 'Failed to close month. Please try again.');
      setProcessing(false);
      setStep(1);
    }
  };

  const handleCancel = () => {
    setStep(1);
    setError(null);
    onClose();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.position = '';
        document.body.style.width = '';
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-2 md:p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative glass rounded-none sm:rounded-xl md:rounded-2xl p-4 sm:p-4 md:p-6 max-w-md w-full min-h-full sm:min-h-0 max-h-full sm:max-h-[90vh] overflow-hidden flex flex-col my-0 sm:my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto flex-1 scrollbar-thin pb-safe">
            {step === 1 && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sm:mb-6 flex-shrink-0 sticky top-0 bg-transparent z-10 pb-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="p-2 sm:p-3 rounded-xl bg-yellow-500/20 flex-shrink-0">
                      <AlertTriangle size={20} className="sm:w-6 sm:h-6 text-yellow-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-white">Close Month</h2>
                      <p className="text-xs sm:text-sm text-slate-400">Archive current month data</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 ml-2"
                  >
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                {/* Warning Message */}
                <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-200">
                      <div className="font-semibold mb-1">Important: Closing Month</div>
                      <div className="text-yellow-300/80">
                        Closing <strong>{monthLabel}</strong> will:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Archive all completed projects and financial data</li>
                          <li>Move incomplete projects to next month</li>
                          <li>Reset counters and statistics for the new month</li>
                          <li>Keep chat, messages, and notifications unchanged</li>
                        </ul>
                        <div className="mt-2 text-yellow-400">
                          <strong>Note:</strong> If this month was already closed, it will be updated with new data.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Month Info */}
                <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar size={18} className="text-blue-400" />
                    <span className="font-semibold text-white">Month to Close</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{monthLabel}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    Year: {current.year} • Month: {current.month}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                    <div className="text-sm text-red-300">{error}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-slate-700">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartReview}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold transition-all"
                  >
                    Review Projects
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="text-center py-8">
                {processing ? (
                  <>
                    <Loader size={48} className="mx-auto mb-4 text-blue-400 animate-spin" />
                    <div className="text-lg font-semibold text-white mb-2">Closing Month...</div>
                    <div className="text-sm text-slate-400">
                      Archiving data and moving incomplete projects
                    </div>
                  </>
                ) : error ? (
                  <>
                    <AlertTriangle size={48} className="mx-auto mb-4 text-red-400" />
                    <div className="text-lg font-semibold text-red-400 mb-2">Error</div>
                    <div className="text-sm text-slate-400 mb-4">{error}</div>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
                    <div className="text-lg font-semibold text-white mb-2">
                      {closeResult?.isUpdate ? 'Month Updated Successfully!' : 'Month Closed Successfully!'}
                    </div>
                    <div className="text-sm text-slate-400">
                      {closeResult?.isUpdate 
                        ? 'Archive data has been updated with the latest information.'
                        : 'All data has been archived and the new month has started.'}
                    </div>
                  </>
                )}
              </div>
            )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Project Review Dialog */}
      <ProjectReviewDialog
        open={showReview}
        onClose={() => setShowReview(false)}
        year={current.year}
        month={current.month}
        onConfirm={handleReviewConfirm}
      />
    </>
  );
}

