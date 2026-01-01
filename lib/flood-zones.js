/**
 * IndigenousAccess Maps - Flood Zones Module
 *
 * Loads and displays FEMA National Flood Hazard Layer data.
 * Provides flood zone classification and styling.
 */

const IAFloodZones = (function() {
    'use strict';

    // FEMA NFHL MapServer endpoint
    const NFHL_SERVICE = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer';

    // Layer IDs in the NFHL MapServer
    const LAYERS = {
        floodZones: 28,      // S_FLD_HAZ_AR - Flood Hazard Areas
        baseFloodElev: 14,   // S_BFE - Base Flood Elevations
        floodway: 12,        // S_FW - Regulatory Floodway
        firmPanels: 3        // S_FIRM_PAN - FIRM Panels
    };

    // Color scheme for flood zones
    const ZONE_COLORS = {
        // High risk zones (Special Flood Hazard Areas)
        'A': '#0066CC',       // Blue
        'AE': '#0066CC',
        'AH': '#3399FF',
        'AO': '#3399FF',
        'AR': '#6699CC',
        'A99': '#6699CC',

        // Coastal high hazard
        'V': '#CC0066',       // Magenta
        'VE': '#CC0066',

        // Moderate risk
        'B': '#FFCC00',       // Yellow
        'X500': '#FFCC00',    // 0.2% annual chance

        // Minimal risk
        'C': '#99CC99',       // Light green
        'X': '#99CC99',

        // Undetermined
        'D': '#CCCCCC',       // Gray

        // Default
        'default': '#808080'
    };

    let _layer = null;
    let _currentBounds = null;

    /**
     * Style function for flood zone features
     * @param {Object} feature - GeoJSON feature
     * @returns {Object} Leaflet style
     */
    function styleFeature(feature) {
        const zone = feature.properties.FLD_ZONE || 'default';
        const color = ZONE_COLORS[zone] || ZONE_COLORS.default;

        // Determine if this is a Special Flood Hazard Area
        const isSFHA = feature.properties.SFHA_TF === 'T';

        return {
            color: color,
            weight: isSFHA ? 2 : 1,
            opacity: 0.8,
            fillColor: color,
            fillOpacity: isSFHA ? 0.4 : 0.2
        };
    }

    /**
     * Query flood zones for a bounding box
     * @param {L.LatLngBounds} bounds - Map bounds
     * @param {Object} options - Query options
     * @returns {Promise<Object>} GeoJSON data
     */
    async function queryFloodZones(bounds, options = {}) {
        const geometry = {
            xmin: bounds.getWest(),
            ymin: bounds.getSouth(),
            xmax: bounds.getEast(),
            ymax: bounds.getNorth(),
            spatialReference: { wkid: 4326 }
        };

        const params = new URLSearchParams({
            geometry: JSON.stringify(geometry),
            geometryType: 'esriGeometryEnvelope',
            spatialRel: 'esriSpatialRelIntersects',
            outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,DEPTH,VELOCITY,AR_REVERT,AR_SUBTRV,DUAL_ZONE',
            returnGeometry: true,
            f: 'geojson',
            outSR: 4326
        });

        // Add zone filter if specified
        if (options.zoneFilter) {
            params.set('where', `FLD_ZONE IN (${options.zoneFilter.map(z => `'${z}'`).join(',')})`);
        }

        const layerId = options.layerId || LAYERS.floodZones;
        const url = `${NFHL_SERVICE}/${layerId}/query?${params}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`FEMA query failed: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            console.error('Flood zone query error:', error);
            throw error;
        }
    }

    /**
     * Load flood zones for current map view
     * @param {Object} options - Load options
     */
    async function loadForCurrentView(options = {}) {
        const map = IndigenousAccessMaps.getMap();
        if (!map) return;

        const bounds = map.getBounds();

        // Skip if bounds haven't changed significantly
        if (_currentBounds && boundsEqual(_currentBounds, bounds)) {
            return;
        }

        _currentBounds = bounds;
        IndigenousAccessMaps.showLoading('Loading flood zones...');

        try {
            const data = await queryFloodZones(bounds, options);

            // Update or create layer
            if (_layer) {
                _layer.clearLayers();
                _layer.addData(data);
            } else {
                _layer = L.geoJSON(data, {
                    style: styleFeature,
                    onEachFeature: (feature, layer) => {
                        const popup = IAPopups.floodZone(feature.properties);
                        layer.bindPopup(popup);

                        layer.on('mouseover', () => {
                            layer.setStyle({
                                weight: 3,
                                fillOpacity: 0.6
                            });
                        });

                        layer.on('mouseout', () => {
                            _layer.resetStyle(layer);
                        });
                    }
                });
            }

            IndigenousAccessMaps.hideLoading();
        } catch (error) {
            IndigenousAccessMaps.hideLoading();
            IndigenousAccessMaps.showError('Failed to load flood zones');
        }
    }

    /**
     * Check if two bounds are approximately equal
     * @param {L.LatLngBounds} a - First bounds
     * @param {L.LatLngBounds} b - Second bounds
     * @returns {boolean}
     */
    function boundsEqual(a, b) {
        const threshold = 0.01;
        return (
            Math.abs(a.getWest() - b.getWest()) < threshold &&
            Math.abs(a.getSouth() - b.getSouth()) < threshold &&
            Math.abs(a.getEast() - b.getEast()) < threshold &&
            Math.abs(a.getNorth() - b.getNorth()) < threshold
        );
    }

    /**
     * Add flood zone layer to map
     * @param {Object} options - Display options
     */
    async function addToMap(options = {}) {
        const map = IndigenousAccessMaps.getMap();
        if (!map) return;

        // Initial load
        await loadForCurrentView(options);

        // Add to map overlay control
        if (_layer) {
            IndigenousAccessMaps.addOverlay('FEMA Flood Zones', _layer, options.visible !== false);
        }

        // Set up dynamic loading on map move
        if (options.dynamicLoad !== false) {
            map.on('moveend', () => loadForCurrentView(options));
        }

        return _layer;
    }

    /**
     * Remove flood zone layer
     */
    function removeFromMap() {
        const map = IndigenousAccessMaps.getMap();
        if (map) {
            map.off('moveend', loadForCurrentView);
        }

        if (_layer) {
            IndigenousAccessMaps.removeOverlay('FEMA Flood Zones');
            _layer = null;
        }
        _currentBounds = null;
    }

    /**
     * Query flood zone at a specific point
     * @param {L.LatLng} latlng - Point coordinates
     * @returns {Promise<Object>} Flood zone data
     */
    async function queryPoint(latlng) {
        const params = new URLSearchParams({
            geometry: JSON.stringify({
                x: latlng.lng,
                y: latlng.lat,
                spatialReference: { wkid: 4326 }
            }),
            geometryType: 'esriGeometryPoint',
            spatialRel: 'esriSpatialRelIntersects',
            outFields: '*',
            returnGeometry: false,
            f: 'json'
        });

        const url = `${NFHL_SERVICE}/${LAYERS.floodZones}/query?${params}`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.features?.[0]?.attributes || null;
        } catch (error) {
            console.error('Point query error:', error);
            return null;
        }
    }

    /**
     * Get legend items for flood zones
     * @returns {Array} Legend items
     */
    function getLegend() {
        return [
            { zone: 'AE', color: ZONE_COLORS.AE, label: 'High Risk (1% Annual Chance)' },
            { zone: 'VE', color: ZONE_COLORS.VE, label: 'Coastal High Hazard' },
            { zone: 'X500', color: ZONE_COLORS.X500, label: 'Moderate Risk (0.2% Annual Chance)' },
            { zone: 'X', color: ZONE_COLORS.X, label: 'Minimal Risk' },
            { zone: 'D', color: ZONE_COLORS.D, label: 'Undetermined' }
        ];
    }

    /**
     * Check if a zone is a Special Flood Hazard Area
     * @param {string} zone - Flood zone code
     * @returns {boolean}
     */
    function isSFHA(zone) {
        const sfhaZones = ['A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE'];
        return sfhaZones.includes(zone);
    }

    /**
     * Get the current layer
     * @returns {L.GeoJSON}
     */
    function getLayer() {
        return _layer;
    }

    // Public API
    return {
        addToMap: addToMap,
        removeFromMap: removeFromMap,
        queryFloodZones: queryFloodZones,
        queryPoint: queryPoint,
        loadForCurrentView: loadForCurrentView,
        getLegend: getLegend,
        isSFHA: isSFHA,
        getLayer: getLayer,
        ZONE_COLORS: ZONE_COLORS,
        LAYERS: LAYERS
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IAFloodZones;
}
