import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { getProjectsForMonth, isProjectCompleted, isProjectIncomplete, calculateProjectFinancials } from '../../utils/monthlyClosing.js';
import { useAppStore, convert } from "../../stores/appStore.js";

export default function ProjectReviewDialog({ 
  open, 
  onClose, 
  year, 
  month, 
  onConfirm 
}) {
  const { currency, rate } = useAppStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && year && month) {
      loadProjects();
    }
  }, [open, year, month]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      // Review dialog should only show currently active projects for this month.
      const monthProjects = await getProjectsForMonth(year, month, false);
      setProjects(monthProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    // Automatically determine which projects to archive and pull forward
    // No checkboxes - just based on status
    const projectsToArchive = [];
    const projectsToPullForward = [];
    
    projects.forEach(p => {
      if (isProjectCompleted(p)) {
        projectsToArchive.push(p.id);
      } else if (isProjectIncomplete(p)) {
        projectsToPullForward.push(p.id);
      }
      // Projects that don't match either status will remain in system as-is
    });
    
    onConfirm({
      projectsToArchive,
      projectsToPullForward
    });
  };

  // Automatically categorize projects - no manual selection needed
  const completedProjects = useMemo(() => 
    projects.filter(p => isProjectCompleted(p)), 
    [projects]
  );
  
  const incompleteProjects = useMemo(() => 
    projects.filter(p => isProjectIncomplete(p)), 
    [projects]
  );
  
  // Other projects that don't fit either category will remain in system
  const otherProjects = useMemo(() => 
    projects.filter(p => 
      !isProjectCompleted(p) && !isProjectIncomplete(p) && 
      !p.archived
    ), 
    [projects]
  );

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
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative glass rounded-none sm:rounded-2xl p-4 sm:p-6 max-w-4xl w-full min-h-full sm:min-h-0 max-h-full sm:max-h-[90vh] overflow-hidden flex flex-col my-0 sm:my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 flex-shrink-0 sticky top-0 bg-transparent z-10 pb-2">
            <div className="flex-1 min-w-0 pr-2">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Review Projects for {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Completed projects will be archived. Incomplete projects will be pulled forward automatically.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="text-slate-400">Loading projects...</div>
              </div>
            ) : (
              <>
                {/* Completed Projects - To Archive */}
                {completedProjects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle size={18} className="text-green-400" />
                      <h3 className="font-semibold text-white">
                        Completed Projects ({completedProjects.length}) - Will be Archived
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {completedProjects.map(project => {
                        const financials = calculateProjectFinancials(project, currency, rate);
                        
                        return (
                          <motion.div
                            key={project.id}
                            className="p-4 rounded-xl border-2 border-green-500/50 bg-green-500/10 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-white">
                                  {project.project_name || project.projectName}
                                </div>
                                <div className="text-sm text-slate-400 mt-1">
                                  Client: {project.client_name || project.clientName} | 
                                  Platform: {project.platform || 'Direct'}
                                </div>
                                <div className="text-sm text-slate-300 mt-2">
                                  Revenue: {financials.revenue.toFixed(2)} {currency} | 
                                  Profit: {financials.profit.toFixed(2)} {currency}
                                </div>
                              </div>
                              <div className="w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center">
                                <CheckCircle size={16} className="text-white" />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Incomplete Projects - To Pull Forward */}
                {incompleteProjects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={18} className="text-yellow-400" />
                      <h3 className="font-semibold text-white">
                        Incomplete Projects ({incompleteProjects.length}) - Will be Pulled Forward
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {incompleteProjects.map(project => {
                        const financials = calculateProjectFinancials(project, currency, rate);
                        
                        return (
                          <motion.div
                            key={project.id}
                            className="p-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-white">
                                  {project.project_name || project.projectName}
                                </div>
                                <div className="text-sm text-slate-400 mt-1">
                                  Client: {project.client_name || project.clientName} | 
                                  Status: {project.status || 'In Progress'}
                                </div>
                                <div className="text-sm text-slate-300 mt-2">
                                  Revenue: {financials.revenue.toFixed(2)} {currency} | 
                                  Remaining: {financials.profit.toFixed(2)} {currency}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <ArrowRight size={16} className="text-yellow-400" />
                                <div className="w-6 h-6 rounded-full border-2 border-yellow-500 bg-yellow-500 flex items-center justify-center">
                                  <CheckCircle size={16} className="text-white" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Other Projects - Will remain in system as-is */}
                {otherProjects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle size={18} className="text-blue-400" />
                      <h3 className="font-semibold text-white">
                        Other Projects ({otherProjects.length}) - Will Remain in System
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {otherProjects.map(project => {
                        const financials = calculateProjectFinancials(project, currency, rate);
                        
                        return (
                          <motion.div
                            key={project.id}
                            className="p-4 rounded-xl border-2 border-slate-600 bg-slate-800/50 transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-white">
                                  {project.project_name || project.projectName}
                                </div>
                                <div className="text-sm text-slate-400 mt-1">
                                  Client: {project.client_name || project.clientName} | 
                                  Status: {project.status || 'Unknown'}
                                </div>
                                <div className="text-sm text-slate-300 mt-2">
                                  Revenue: {financials.revenue.toFixed(2)} {currency} | 
                                  Profit: {financials.profit.toFixed(2)} {currency}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {projects.length === 0 && (
                  <div className="text-center py-12">
                    <AlertCircle size={48} className="mx-auto mb-4 text-slate-400" />
                    <div className="text-slate-400">No projects found for this month</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-slate-700 flex-shrink-0 sticky bottom-0 bg-transparent">
            <div className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
              {completedProjects.length} will be archived • {incompleteProjects.length} will be pulled forward
              {otherProjects.length > 0 && ` • ${otherProjects.length} will remain in system`}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors min-h-[44px] touch-manipulation flex-1 sm:flex-none"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={projects.length === 0}
                className="px-4 sm:px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation flex-1 sm:flex-none"
              >
                Confirm & Close Month
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

