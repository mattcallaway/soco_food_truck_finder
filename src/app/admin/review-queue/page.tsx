'use client';

import React, { useState, useEffect } from 'react';
import {
  getCandidates,
  getVendors,
  getVenues,
  approveCandidate,
  rejectCandidate,
  addAuditLog,
} from '@/lib/db/store';
import { ExtractionCandidate, Vendor, Venue } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { formatDateDisplay, formatTimeDisplay } from '@/lib/timezone';
import { Inbox, CheckCircle, XCircle, AlertTriangle, Sparkles, Edit2 } from 'lucide-react';

export default function ReviewQueuePage() {
  const { user, userProfile } = useAuth();
  const adminUid = user?.uid || userProfile?.uid || 'unknown';
  const [candidates, setCandidates] = useState<ExtractionCandidate[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cList, vList, venueList] = await Promise.all([
        getCandidates(),
        getVendors(),
        getVenues(),
      ]);
      setCandidates(cList);
      setVendors(vList);
      setVenues(venueList);
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (candidate: ExtractionCandidate, selectedVenueId?: string) => {
    const venueId = selectedVenueId || candidate.matchedVenueId;
    const newApp = await approveCandidate(candidate.id, { venueId });

    await addAuditLog({
      adminUserId: adminUid,
      action: 'approve_extraction_candidate',
      affectedEntity: 'extraction_candidate',
      entityId: candidate.id,
      newState: newApp,
    });

    loadData();
  };

  const handleReject = async (candidateId: string) => {
    await rejectCandidate(candidateId);
    await addAuditLog({
      adminUserId: adminUid,
      action: 'reject_extraction_candidate',
      affectedEntity: 'extraction_candidate',
      entityId: candidateId,
    });
    loadData();
  };

  const pendingList = candidates.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Inbox className="w-6 h-6 text-amber-500" />
            <span>Human-in-the-Loop Review Queue</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review schedule candidates extracted from vendor websites, social media, and feeds before publishing
          </p>
        </div>

        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 font-bold text-xs rounded-xl border border-amber-500/30">
          {pendingList.length} Items Awaiting Review
        </span>
      </div>

      {/* Candidates List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-44 bg-slate-900 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : pendingList.length === 0 ? (
        <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 space-y-3">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">Review Queue is Clear!</h3>
          <p className="text-xs text-slate-400">All ingested schedule candidates have been reviewed and published.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingList.map((cand) => {
            const vendor = vendors.find((v) => v.id === cand.vendorId);
            const matchedVenue = venues.find((v) => v.id === cand.matchedVenueId);

            return (
              <div
                key={cand.id}
                className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl relative overflow-hidden"
              >
                {/* Confidence Bar Badge */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{vendor?.name || cand.vendorId}</span>
                    <span className="text-slate-500">&bull; Source ID: {cand.sourceId}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-400">Extraction Confidence:</span>
                    <span
                      className={`font-mono font-bold ${
                        cand.confidenceScore >= 0.85
                          ? 'text-emerald-400'
                          : cand.confidenceScore >= 0.7
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {(cand.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Raw Excerpt Box */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Raw Source Excerpt</div>
                  <p className="leading-relaxed">&ldquo;{cand.rawText}&rdquo;</p>
                </div>

                {/* Extracted Schedule Proposal */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-500 text-[10px] uppercase font-bold">Proposed Date & Time</div>
                    <div className="text-amber-400 font-bold mt-1">
                      {formatDateDisplay(cand.date)} ({formatTimeDisplay(cand.startTime)} – {formatTimeDisplay(cand.endTime)})
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-500 text-[10px] uppercase font-bold">Proposed Venue Text</div>
                    <div className="text-white font-bold mt-1">&ldquo;{cand.proposedVenueText}&rdquo;</div>
                  </div>

                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-500 text-[10px] uppercase font-bold">Canonical Match</div>
                    <div className="text-emerald-400 font-bold mt-1">
                      {matchedVenue ? `${matchedVenue.canonicalName} (${matchedVenue.city})` : '⚠️ Unmatched Venue'}
                    </div>
                  </div>
                </div>

                {/* Validation & Conflict Warnings */}
                {(cand.validationWarnings.length > 0 || cand.hasConflicts) && (
                  <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-xs text-amber-300 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> Validation Flags:
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                      {cand.validationWarnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                      {cand.hasConflicts && <li className="text-rose-400 font-semibold">{cand.conflictNotes}</li>}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3 text-xs">
                  <button
                    onClick={() => handleReject(cand.id)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-rose-400 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject Candidate
                  </button>

                  <button
                    onClick={() => handleApprove(cand)}
                    className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 flex items-center gap-1.5 transition-colors shadow-lg"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve & Publish
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
