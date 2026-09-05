'use client';

import React, { useState, useEffect } from 'react';
import {
  getAppearances,
  getVendors,
  getVenues,
  saveAppearance,
  deleteAppearance,
  addAuditLog,
} from '@/lib/db/store';
import { Appearance, Vendor, Venue, AppearanceStatus } from '@/types';
import { formatDateDisplay, formatTimeDisplay, getTodayDateLA } from '@/lib/timezone';
import { Calendar, Plus, Filter, ArrowUpDown, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';

export default function AppearancesAdminPage() {
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [vendorFilter, setVendorFilter] = useState<string>('');
  const [venueFilter, setVenueFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortField, setSortField] = useState<'date' | 'vendor' | 'venue'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal State for New/Edit Appearance
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingApp, setEditingApp] = useState<Partial<Appearance>>({
    date: getTodayDateLA(),
    startTime: '16:00',
    endTime: '20:00',
    status: 'scheduled',
    isPublished: true,
    isManualOverride: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [appList, vList, venueList] = await Promise.all([
        getAppearances(),
        getVendors(),
        getVenues(),
      ]);
      setAppearances(appList);
      setVendors(vList);
      setVenues(venueList);
    } catch (err) {
      console.error('Failed to load appearances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp.vendorId || !editingApp.venueId || !editingApp.date) {
      alert('Please select a vendor, venue, and date.');
      return;
    }

    const appToSave: Appearance = {
      id: editingApp.id || `app-manual-${Date.now()}`,
      vendorId: editingApp.vendorId,
      venueId: editingApp.venueId,
      date: editingApp.date,
      startTime: editingApp.startTime || '16:00',
      endTime: editingApp.endTime || '20:00',
      status: (editingApp.status as AppearanceStatus) || 'scheduled',
      isPublished: editingApp.isPublished ?? true,
      isManualOverride: true,
      observationIds: editingApp.observationIds || [],
      notes: editingApp.notes || 'Manual admin entry',
      createdBy: editingApp.createdBy || 'admin-user',
      updatedBy: 'admin-user',
      createdAt: editingApp.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveAppearance(appToSave);
    await addAuditLog({
      adminUserId: 'admin-user',
      action: editingApp.id ? 'edit_appearance' : 'create_appearance',
      affectedEntity: 'appearance',
      entityId: appToSave.id,
      newState: appToSave,
    });

    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled appearance?')) return;
    await deleteAppearance(id);
    await addAuditLog({
      adminUserId: 'admin-user',
      action: 'delete_appearance',
      affectedEntity: 'appearance',
      entityId: id,
    });
    loadData();
  };

  // Filter & Sort Logic
  let filtered = appearances.filter((a) => {
    if (vendorFilter && a.vendorId !== vendorFilter) return false;
    if (venueFilter && a.venueId !== venueFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    return true;
  });

  filtered.sort((a, b) => {
    let comp = 0;
    if (sortField === 'date') {
      comp = a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
    } else if (sortField === 'vendor') {
      const vA = vendors.find((v) => v.id === a.vendorId)?.name || '';
      const vB = vendors.find((v) => v.id === b.vendorId)?.name || '';
      comp = vA.localeCompare(vB);
    } else if (sortField === 'venue') {
      const vA = venues.find((v) => v.id === a.venueId)?.canonicalName || '';
      const vB = venues.find((v) => v.id === b.venueId)?.canonicalName || '';
      comp = vA.localeCompare(vB);
    }
    return sortDirection === 'asc' ? comp : -comp;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-500" />
            <span>Appearance Administration Table</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Fast sortable table for managing vendor scheduled appearances across Sonoma County
          </p>
        </div>

        <button
          onClick={() => {
            setEditingApp({
              date: getTodayDateLA(),
              startTime: '16:00',
              endTime: '20:00',
              status: 'scheduled',
              isPublished: true,
              isManualOverride: true,
              vendorId: vendors[0]?.id,
              venueId: venues[0]?.id,
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-lg"
        >
          <Plus className="w-4 h-4" /> Create Appearance
        </button>
      </div>

      {/* Filter Controls Row */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Vendor</label>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
          >
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Venue</label>
          <select
            value={venueFilter}
            onChange={(e) => setVenueFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
          >
            <option value="">All Venues</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.canonicalName} ({v.city})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="tentative">Tentative</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th
                  className="p-3.5 cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={() => {
                    setSortField('date');
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Date & Time</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="p-3.5 cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={() => {
                    setSortField('vendor');
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Vendor</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="p-3.5 cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={() => {
                    setSortField('venue');
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Venue (City)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Provenance</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Loading appearances table...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No scheduled appearances found matching filters.</td>
                </tr>
              ) : (
                filtered.map((app) => {
                  const vendor = vendors.find((v) => v.id === app.vendorId);
                  const venue = venues.find((v) => v.id === app.venueId);

                  return (
                    <tr key={app.id} className="hover:bg-slate-850/60 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-amber-400">{formatDateDisplay(app.date)}</div>
                        <div className="text-slate-400 text-[11px]">
                          {formatTimeDisplay(app.startTime)} – {formatTimeDisplay(app.endTime)}
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-white">
                        {vendor?.name || app.vendorId}
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-200 font-medium">{venue?.canonicalName || app.venueId}</div>
                        <div className="text-slate-500 text-[11px]">{venue?.city}</div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            app.status === 'scheduled'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : app.status === 'cancelled'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-[11px] text-slate-400">
                        {app.isManualOverride ? (
                          <span className="text-amber-400 font-mono">Manual Override</span>
                        ) : (
                          <span>Extracted ({app.observationIds.length} obs)</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingApp(app);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700"
                          title="Edit Appearance"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-slate-700"
                          title="Delete Appearance"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {editingApp.id ? 'Edit Scheduled Appearance' : 'Create New Appearance'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Vendor</label>
                <select
                  value={editingApp.vendorId || ''}
                  onChange={(e) => setEditingApp({ ...editingApp, vendorId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Venue</label>
                <select
                  value={editingApp.venueId || ''}
                  onChange={(e) => setEditingApp({ ...editingApp, venueId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                >
                  <option value="">Select Venue</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.canonicalName} ({v.city})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Date</label>
                  <input
                    type="date"
                    value={editingApp.date || ''}
                    onChange={(e) => setEditingApp({ ...editingApp, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Start Time</label>
                  <input
                    type="time"
                    value={editingApp.startTime || '16:00'}
                    onChange={(e) => setEditingApp({ ...editingApp, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">End Time</label>
                  <input
                    type="time"
                    value={editingApp.endTime || '20:00'}
                    onChange={(e) => setEditingApp({ ...editingApp, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Status</label>
                <select
                  value={editingApp.status || 'scheduled'}
                  onChange={(e) => setEditingApp({ ...editingApp, status: e.target.value as AppearanceStatus })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                  <option value="tentative">Tentative</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold"
                >
                  Save Appearance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
