'use client';

import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '@/lib/db/store';
import { AdminAuditLog } from '@/types';
import { History, Shield } from 'lucide-react';

export default function AuditLogAdminPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const data = await getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="w-6 h-6 text-amber-500" />
          <span>Administrative Audit Trail</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Complete change log for manual overrides, vendor updates, and candidate approvals
        </p>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Admin User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target Entity</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Loading audit log...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">No administrative events recorded yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400">
                      {new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
                    </td>
                    <td className="p-3.5 font-semibold text-white">{log.adminUserId}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px] uppercase border border-amber-500/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300 font-mono">
                      {log.affectedEntity}:{log.entityId}
                    </td>
                    <td className="p-3.5 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                      {JSON.stringify(log.newState || {})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
