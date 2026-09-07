'use client';

import React, { useState, useEffect } from 'react';
import { getSources, saveSource, addAuditLog } from '@/lib/db/store';
import { Source } from '@/types';
import { Link2, RefreshCw, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export default function SourcesAdminPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await getSources();
      setSources(data);
    } catch (err) {
      console.error('Failed to load sources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleCheckSourceNow = async (source: Source) => {
    setCheckingId(source.id);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/sources/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(`Source checked successfully! Extracted ${data.candidatesGenerated} candidate(s) sent to Review Queue.`);
        await addAuditLog({
          adminUserId: 'admin-user',
          action: 'check_source_now',
          affectedEntity: 'source',
          entityId: source.id,
          newState: { fetchId: data.fetchId, candidatesGenerated: data.candidatesGenerated },
        });
      } else if (data.status === 'restricted') {
        setMessage(`Instagram data restricted: ${data.message}`);
      } else {
        setMessage(`Source check warning: ${data.errorMessage || data.error || 'Failed to fetch source'}`);
      }

      await loadSources();
    } catch (err: any) {
      console.error('Error checking source:', err);
      setMessage(`Network error checking source: ${err.message}`);
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-6 h-6 text-amber-500" />
            <span>Ingestion Data Sources</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real server-side URL fetching pipeline attached to Vendors, Venues, Events, or System feeds
          </p>
        </div>
      </div>

      {message && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-3.5">Source Name</th>
                <th className="p-3.5">Scope & Entity</th>
                <th className="p-3.5">Purpose</th>
                <th className="p-3.5">Type & Frequency</th>
                <th className="p-3.5">Status & Operational Log</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Loading sources...</td>
                </tr>
              ) : sources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No sources configured.</td>
                </tr>
              ) : (
                sources.map((src) => (
                  <tr key={src.id} className="hover:bg-slate-850/60 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-white">{src.name}</div>
                      <a href={src.url} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline text-[11px] truncate block max-w-xs">
                        {src.url}
                      </a>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase border border-slate-700">
                        {src.entityType}
                      </span>
                      <div className="text-[11px] text-slate-400 mt-1">{src.entityId}</div>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-200 capitalize">
                      {src.purpose}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-300 capitalize">{src.sourceType}</div>
                      <div className="text-[11px] text-slate-500">Every {src.checkFrequencyHours}h</div>
                    </td>
                    <td className="p-3.5">
                      {src.lastError ? (
                        <div className="text-rose-400 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate max-w-xs">{src.lastError}</span>
                        </div>
                      ) : (
                        <div className="text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Active & Verified</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleCheckSourceNow(src)}
                        disabled={checkingId === src.id}
                        data-testid={`check-source-${src.id}`}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 disabled:opacity-50 flex items-center gap-1 ml-auto"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingId === src.id ? 'animate-spin' : ''}`} />
                        <span>Check Now</span>
                      </button>
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
