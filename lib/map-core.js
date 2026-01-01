/**
 * IndigenousAccess Maps - Core Map Module
 *
 * Provides base map initialization and shared utilities for all embeddable maps.
 * Uses Leaflet with multiple basemap options appropriate for Tribal territories.
 */

const IndigenousAccessMaps = (function() {
    'use strict';

    // Default map configuration
    const DEFAULT_CONFIG = {
        // Pacific Northwest center
        center: [47.5, -120.5],
        zoom: 7,
        minZoom: 4,
        maxZoom: 18,

        // Region bounds for PNW focus
        maxBounds: [
            [41.0, -130.0],  // Southwest
            [54.0, -110.0]   // Northeast
        ]
    };

    // Basemap definitions
    const BASEMAPS = {
        // Clean, label-friendly base
        cartodb_light: {
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            name: 'Light'
        },
        // Terrain for geographic context
        stamen_terrain: {
            url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
            attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            name: 'Terrain'
        },
        // Satellite imagery
        esri_imagery: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: '&copy; Esri, Maxar, Earthstar Geographics',
            name: 'Satellite'
        },
        // OpenStreetMap standard
        osm: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            name: 'OpenStreetMap'
        }
    };

    // Region definitions for PNW states and Tribal areas
    const REGIONS = {
        pnw: { center: [47.0, -120.5], zoom: 6, name: 'Pacific Northwest' },
        wa: { center: [47.4, -120.5], zoom: 7, name: 'Washington' },
        or: { center: [43.8, -120.5], zoom: 7, name: 'Oregon' },
        id: { center: [44.4, -114.7], zoom: 7, name: 'Idaho' },
        mt: { center: [46.9, -110.4], zoom: 7, name: 'Montana' },
        ak: { center: [64.2, -152.5], zoom: 4, name: 'Alaska' }
    };

    // Private state
    let _map = null;
    let _baseLayers = {};
    let _overlayLayers = {};
    let _layerControl = null;
    let _currentRegion = 'pnw';

    /**
     * Initialize the map on a container element
     * @param {string} containerId - DOM element ID for the map
     * @param {Object} options - Configuration options
     * @returns {L.Map} Leaflet map instance
     */
    function initMap(containerId, options = {}) {
        const config = { ...DEFAULT_CONFIG, ...options };

        // Parse URL parameters for initial state
        const params = parseUrlParams();
        if (params.region && REGIONS[params.region]) {
            config.center = REGIONS[params.region].center;
            config.zoom = REGIONS[params.region].zoom;
            _currentRegion = params.region;
        }

        // Create map
        _map = L.map(containerId, {
            center: config.center,
            zoom: config.zoom,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            zoomControl: true,
            attributionControl: true
        });

        // Position zoom control
        _map.zoomControl.setPosition('topright');

        // Add base layers
        const defaultBasemap = options.basemap || 'cartodb_light';
        Object.entries(BASEMAPS).forEach(([key, layer]) => {
            _baseLayers[layer.name] = L.tileLayer(layer.url, {
                attribution: layer.attribution,
                maxZoom: 19
            });
        });

        // Add default basemap
        _baseLayers[BASEMAPS[defaultBasemap].name].addTo(_map);

        // Add layer control if not disabled
        if (options.controls !== 'none') {
            _layerControl = L.control.layers(_baseLayers, _overlayLayers, {
                position: 'topright',
                collapsed: options.controls === 'minimal'
            }).addTo(_map);
        }

        // Add scale bar
        L.control.scale({
            position: 'bottomleft',
            imperial: true,
            metric: true
        }).addTo(_map);

        return _map;
    }

    /**
     * Parse URL query parameters
     * @returns {Object} Parsed parameters
     */
    function parseUrlParams() {
        const params = {};
        const searchParams = new URLSearchParams(window.location.search);

        ['region', 'tribe', 'layers', 'controls', 'lat', 'lon', 'zoom'].forEach(key => {
            if (searchParams.has(key)) {
                params[key] = searchParams.get(key);
            }
        });

        return params;
    }

    /**
     * Focus map on a specific region
     * @param {string} regionCode - Region code (wa, or, id, mt, pnw)
     * @param {Object} options - Additional options like animation
     */
    function focusRegion(regionCode, options = {}) {
        const region = REGIONS[regionCode.toLowerCase()];
        if (!region) {
            console.warn(`Unknown region: ${regionCode}`);
            return;
        }

        _currentRegion = regionCode.toLowerCase();

        if (options.animate !== false) {
            _map.flyTo(region.center, region.zoom, {
                duration: 1.0
            });
        } else {
            _map.setView(region.center, region.zoom);
        }
    }

    /**
     * Focus map on a specific Tribal territory
     * @param {string} tribeCode - Tribal code or name
     * @param {Object} bounds - Optional L.LatLngBounds for the territory
     */
    function focusTribe(tribeCode, bounds) {
        if (bounds && bounds instanceof L.LatLngBounds) {
            _map.fitBounds(bounds, { padding: [20, 20] });
        }
        // If no bounds provided, the tribal-boundaries module will handle lookup
    }

    /**
     * Add an overlay layer to the map
     * @param {string} name - Display name for the layer
     * @param {L.Layer} layer - Leaflet layer object
     * @param {boolean} visible - Whether to show by default
     */
    function addOverlayLayer(name, layer, visible = false) {
        _overlayLayers[name] = layer;

        if (_layerControl) {
            _layerControl.addOverlay(layer, name);
        }

        if (visible) {
            layer.addTo(_map);
        }
    }

    /**
     * Remove an overlay layer
     * @param {string} name - Layer name to remove
     */
    function removeOverlayLayer(name) {
        const layer = _overlayLayers[name];
        if (layer) {
            _map.removeLayer(layer);
            if (_layerControl) {
                _layerControl.removeLayer(layer);
            }
            delete _overlayLayers[name];
        }
    }

    /**
     * Show loading indicator
     * @param {string} message - Loading message
     */
    function showLoading(message = 'Loading...') {
        let loader = document.getElementById('ia-map-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'ia-map-loader';
            loader.className = 'ia-loader';
            document.body.appendChild(loader);
        }
        loader.textContent = message;
        loader.style.display = 'flex';
    }

    /**
     * Hide loading indicator
     */
    function hideLoading() {
        const loader = document.getElementById('ia-map-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    function showError(message) {
        console.error('IndigenousAccessMaps:', message);
        // Could add a toast notification here
    }

    /**
     * Get the current map instance
     * @returns {L.Map} Current Leaflet map
     */
    function getMap() {
        return _map;
    }

    /**
     * Get current region code
     * @returns {string} Current region code
     */
    function getCurrentRegion() {
        return _currentRegion;
    }

    /**
     * Get region definitions
     * @returns {Object} Region definitions
     */
    function getRegions() {
        return { ...REGIONS };
    }

    // Public API
    return {
        init: initMap,
        getMap: getMap,
        focusRegion: focusRegion,
        focusTribe: focusTribe,
        addOverlay: addOverlayLayer,
        removeOverlay: removeOverlayLayer,
        showLoading: showLoading,
        hideLoading: hideLoading,
        showError: showError,
        parseParams: parseUrlParams,
        getRegions: getRegions,
        getCurrentRegion: getCurrentRegion,
        BASEMAPS: BASEMAPS,
        REGIONS: REGIONS
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndigenousAccessMaps;
}
