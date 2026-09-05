'use client';

import React, { useState, useEffect } from 'react';
import { getVenues, saveVenue, addAuditLog } from '@/lib/db/store';
import { Venue } from '@/types';
import { MapPin, Plus, Edit, Tag, Navigation } from 'lucide-react';
import { SONOMA_CITIES } from '@/config/app-config';

export default function VenuesAdminPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVenue, setEditingVenue] = useState<Partial<Venue>>({
    city: 'Santa Rosa',
    aliases: [],
    status: 'active',
    lat: 38.4404,
    lng: -122.7141,
  });
  const [aliasInput, setAliasInput] = useState<string>('');

  const loadVenues = async () => {
    setLoading(true);
    try {
      const data = await getVenues();
      setVenues(data);
    } catch (err) {
      console.error('Failed to load venues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVenues();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenue.canonicalName || !editingVenue.address) {
      alert('Please enter a canonical venue name and address.');
      return;
    }

    const venueToSave: Venue = {
      id: editingVenue.id || `venue-manual-${Date.now()}`,
      slug: editingVenue.slug || editingVenue.canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      canonicalName: editingVenue.canonicalName,
      address: editingVenue.address,
      city: editingVenue.city || 'Santa Rosa',
      lat: Number(editingVenue.lat) || 38.4404,
      lng: Number(editingVenue.lng) || -122.7141,
      websiteUrl: editingVenue.websiteUrl,
      photoUrl: editingVenue.photoUrl,
      aliases: editingVenue.aliases || [],
      status: (editingVenue.status as 'active' | 'inactive') || 'active',
      isDemo: editingVenue.isDemo ?? false,
      createdAt: editingVenue.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveVenue(venueToSave);
    await addAuditLog({
      adminUserId: 'admin-user',
      action: editingVenue.id ? 'edit_venue' : 'create_venue',
      affectedEntity: 'venue',
      entityId: venueToSave.id,
      newState: venueToSave,
    });

    setIsModalOpen(false);
    loadVenues();
  };

  const handleAddAlias = () => {
    if (!aliasInput.trim()) return;
    const current = editingVenue.aliases || [];
    if (!current.includes(aliasInput.trim())) {
      setEditingVenue({ ...editingVenue, aliases: [...current, aliasInput.trim()] });
    }
    setAliasInput('');
  };

  const handleRemoveAlias = (alias: string) => {
    const current = editingVenue.aliases || [];
    setEditingVenue({ ...editingVenue, aliases: current.filter((a) => a !== alias) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-amber-500" />
            <span>Venues & Aliases Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage Sonoma County host venues and alias matching rules</p>
        </div>

        <button
          onClick={() => {
            setEditingVenue({
              city: 'Santa Rosa',
              aliases: [],
              status: 'active',
              lat: 38.4404,
              lng: -122.7141,
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-400 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Venue
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-slate-500 text-xs">Loading venues...</p>
        ) : (
          venues.map((v) => (
            <div key={v.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">{v.canonicalName}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{v.address}, {v.city}</p>
                </div>
                <button
                  onClick={() => {
                    setEditingVenue(v);
                    setIsModalOpen(true);
                  }}
                  className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-amber-400"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs text-slate-500 flex items-center gap-2 font-mono">
                <span>Lat: {v.lat.toFixed(4)}</span>
                <span>Lng: {v.lng.toFixed(4)}</span>
              </div>

              {v.aliases.length > 0 && (
                <div className="pt-2 border-t border-slate-850">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Matched Aliases</div>
                  <div className="flex flex-wrap gap-1">
                    {v.aliases.map((a) => (
                      <span key={a} className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{editingVenue.id ? 'Edit Venue' : 'Add New Venue'}</h3>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Canonical Venue Name</label>
                <input
                  type="text"
                  value={editingVenue.canonicalName || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, canonicalName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Address</label>
                <input
                  type="text"
                  value={editingVenue.address || ''}
                  onChange={(e) => setEditingVenue({ ...editingVenue, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">City</label>
                  <select
                    value={editingVenue.city || 'Santa Rosa'}
                    onChange={(e) => setEditingVenue({ ...editingVenue, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  >
                    {SONOMA_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editingVenue.lat || 38.4404}
                    onChange={(e) => setEditingVenue({ ...editingVenue, lat: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editingVenue.lng || -122.7141}
                    onChange={(e) => setEditingVenue({ ...editingVenue, lng: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              {/* Alias Manager */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="block text-slate-400 font-semibold">Alias Resolution Matcher</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add alias (e.g. 'Hen House Beer')"
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                  <button type="button" onClick={handleAddAlias} className="px-3 py-2 bg-slate-800 text-slate-200 font-bold rounded-xl">Add</button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(editingVenue.aliases || []).map((alias) => (
                    <span key={alias} className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 flex items-center gap-1">
                      {alias}
                      <button type="button" onClick={() => handleRemoveAlias(alias)} className="text-slate-500 hover:text-rose-400">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">Save Venue</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
