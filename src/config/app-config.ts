import { SystemSettings } from '@/types';

export const APP_CONFIG: SystemSettings = {
  productName: process.env.NEXT_PUBLIC_APP_NAME || 'SoCo Food Truck Finder',
  serviceArea: process.env.NEXT_PUBLIC_SERVICE_AREA || 'Sonoma County, CA',
  defaultMapCenter: {
    lat: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT) || 38.4404,
    lng: Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG) || -122.7141,
  },
  defaultMapZoom: Number(process.env.NEXT_PUBLIC_MAP_ZOOM) || 11,
  mapTileUrl:
    process.env.NEXT_PUBLIC_MAP_TILE_URL ||
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  mapAttribution:
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  geocodingApiUrl: process.env.GEOCODING_API_URL || 'https://nominatim.openstreetmap.org/search',
  autoPublishConfidenceThreshold: 0.95,
};

export const SONOMA_CITIES = [
  'Santa Rosa',
  'Petaluma',
  'Rohnert Park',
  'Cotati',
  'Sebastopol',
  'Windsor',
  'Healdsburg',
  'Sonoma',
  'Cloverdale',
] as const;

export const CUISINE_TAXONOMY = [
  'Tacos & Mexican',
  'Smoked BBQ',
  'Wood-Fired Pizza',
  'Smash Burgers',
  'Asian Fusion',
  'Greek & Mediterranean',
  'Vegan & Organic',
  'Desserts & Coffee',
] as const;

export const DIETARY_TAXONOMY = [
  { id: 'vegetarian', label: 'Vegetarian Options' },
  { id: 'vegan', label: 'Vegan Options' },
  { id: 'gluten_free', label: 'Gluten-Free Options' },
] as const;
