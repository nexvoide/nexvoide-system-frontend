import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Activity, Search, Filter, Clock, User, Briefcase, Building2, 
  Settings, Trash2, Plus, Edit, CheckCircle, XCircle, AlertCircle 
} from "lucide-react";
import { useAppStore } from "../stores/appStore.js";

const actionIcons = {
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  status_changed: CheckCircle,
};

const entityIcons = {
  project: Briefcase,
  employee: User,
  profile: User,
  agency: Building2,
  brand: Building2,
  setting: Settings,
};

const actionColors = {
  created: 'text-green-500 bg-green-50 dark:bg-green-950/20',
  updated: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
  deleted: 'text-red-500 bg-red-50 dark:bg-red-950/20',
  status_changed: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20',
};

export default function ActivityLogs() {
  const { activityLogs, loadActivityLogs, loading } = useAppStore();
  const [query, setQuery] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAction, setFilterAction] = useState("all");

  useEffect(() => {
    loadActivityLogs(200);
  }, [loadActivityLogs]);

  // Helper to parse JSON values
  const parseValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    let logs = Array.isArray(activityLogs) ? activityLogs : [];
    
    // Filter by entity type
    if (filterEntity !== 'all') {
      logs = logs.filter(log => {
        const entityType = log.entityType || log.entity_type;
        return entityType === filterEntity;
      });
    }
    
    // Filter by action
    if (filterAction !== 'all') {
      logs = logs.filter(log => {
        const action = log.action;
        return action === filterAction;
      });
    }
    
    // Filter by search query
    if (query) {
      const lowerQuery = query.toLowerCase();
      logs = logs.filter(log => {
        const description = log.description || '';
        const userName = log.userName || log.user_name || '';
        const entityType = log.entityType || log.entity_type || '';
        return (
          description.toLowerCase().includes(lowerQuery) ||
          userName.toLowerCase().includes(lowerQuery) ||
          entityType.toLowerCase().includes(lowerQuery)
        );
      });
    }
    
    return logs;
  }, [activityLogs, query, filterEntity, filterAction]);

  // Get unique entity types for filter
  const entityTypes = useMemo(() => {
    const types = new Set();
    (Array.isArray(activityLogs) ? activityLogs : []).forEach(log => {
      const type = log.entityType || log.entity_type;
      if (type) types.add(type);
    });
    return Array.from(types).sort();
  }, [activityLogs]);

  if (loading && activityLogs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading activity logs...</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="glass rounded-2xl h-11 px-3 flex items-center">
        <Activity className="mr-2" size={18} />
        <div className="text-sm font-semibold">Activity Logs</div>
      </div>

      {/* Filters */}
      <div className="card p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search activities..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base md:text-sm"
            />
          </div>

          {/* Entity Filter */}
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base md:text-sm"
          >
            <option value="all">All Entities</option>
            {entityTypes.map(type => (
              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base md:text-sm"
          >
            <option value="all">All Actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="status_changed">Status Changed</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-2">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, i) => {
            const entityType = log.entityType || log.entity_type || 'unknown';
            const action = log.action || 'updated';
            const description = log.description || 'No description';
            const userName = log.userName || log.user_name || 'System';
            const createdAt = log.createdAt || log.created_at;
            
            const ActionIcon = actionIcons[action] || AlertCircle;
            const EntityIcon = entityIcons[entityType] || Activity;
            const actionColor = actionColors[action] || actionColors.updated;

            return (
              <motion.div
                key={log.id || i}
                className="card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${actionColor} flex-shrink-0`}>
                    <ActionIcon size={20} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <EntityIcon size={14} className="text-slate-400" />
                      <span className="text-xs text-slate-500 uppercase tracking-wide">
                        {entityType}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">{userName}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                      {description}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock size={12} />
                      <span>{formatDate(createdAt)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="card text-center py-12">
            <Activity className="mx-auto mb-3 text-slate-400" size={48} />
            <div className="text-slate-500">
              {query || filterEntity !== 'all' || filterAction !== 'all' 
                ? 'No activities match your filters'
                : 'No activity logs yet'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




