'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getVendors, saveVendor, addAuditLog } from '@/lib/db/store';
import { Vendor, VendorType, PriceRange } from '@/types';
import { Truck, Plus, Edit, ExternalLink } from 'lucide-react';
import { CUISINE_TAXONOMY, DIETARY_TAXONOMY } from '@/config/app-config';

export default function VendorsAdminPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor>>({
    vendorType: 'food_truck',
    priceRange: '$$',
    cuisines: ['Tacos & Mexican'],
    dietaryTags: ['vegetarian'],
  });

  const loadVendors = async () => {
    setLoading(true);
    try {
      const data = await getVendors();
      setVendors(data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor.name) {
      alert('Please enter a vendor name.');
      return;
    }

    const vendorToSave: Vendor = {
      id: editingVendor.id || `vendor-manual-${Date.now()}`,
      slug: editingVendor.slug || editingVendor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: editingVendor.name,
      isDemo: editingVendor.isDemo ?? false,
      heroImage: editingVendor.heroImage || 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?auto=format&fit=crop&w=1000&q=80',
      images: editingVendor.images || [],
      vendorType: (editingVendor.vendorType as VendorType) || 'food_truck',
      cuisines: editingVendor.cuisines || ['Tacos & Mexican'],
      description: editingVendor.description || '',
      priceRange: (editingVendor.priceRange as PriceRange) || '$$',
      dietaryTags: editingVendor.dietaryTags || [],
      websiteUrl: editingVendor.websiteUrl,
      instagramUrl: editingVendor.instagramUrl,
      favoriteCount: editingVendor.favoriteCount || 0,
      lastScheduleUpdate: new Date().toISOString(),
      createdAt: editingVendor.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveVendor(vendorToSave);
    await addAuditLog({
      adminUserId: 'admin-user',
      action: editingVendor.id ? 'edit_vendor' : 'create_vendor',
      affectedEntity: 'vendor',
      entityId: vendorToSave.id,
      newState: vendorToSave,
    });

    setIsModalOpen(false);
    loadVendors();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-500" />
            <span>Vendors Directory Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage mobile food trucks, carts, trailers, and pop-ups</p>
        </div>

        <button
          onClick={() => {
            setEditingVendor({
              vendorType: 'food_truck',
              priceRange: '$$',
              cuisines: ['Tacos & Mexican'],
              dietaryTags: ['vegetarian'],
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-400 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-slate-500 text-xs">Loading vendors...</p>
        ) : (
          vendors.map((v) => (
            <div key={v.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-start gap-4">
              <img src={v.heroImage} alt={v.name} className="w-20 h-20 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-white text-base truncate">{v.name}</h3>
                  <button
                    onClick={() => {
                      setEditingVendor(v);
                      setIsModalOpen(true);
                    }}
                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-amber-400"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-amber-400 font-medium mt-1">{v.cuisines.join(', ')}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                  <span className="capitalize">{v.vendorType.replace('_', ' ')}</span>
                  <span>&bull;</span>
                  <span>{v.priceRange}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{editingVendor.id ? 'Edit Vendor' : 'Add New Vendor'}</h3>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Vendor Name</label>
                <input
                  type="text"
                  value={editingVendor.name || ''}
                  onChange={(e) => setEditingVendor({ ...editingVendor, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea
                  value={editingVendor.description || ''}
                  onChange={(e) => setEditingVendor({ ...editingVendor, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">Save Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
