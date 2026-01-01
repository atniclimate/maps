/**
 * IndigenousAccess Maps - Tribal Boundaries Module
 *
 * Loads and displays Tribal boundary data from BIA LAR and Census AIAN sources.
 * Provides styling and interaction for Tribal territory display.
 */

const IATribalBoundaries = (function() {
    'use strict';

    // Data source URLs
    const DATA_SOURCES = {
        // Local GeoJSON - simplified for fast loading (831 KB)
        local: './data/tribal-boundaries/pnw-tribal-boundaries-simplified.geojson',

        // Full resolution local GeoJSON (4.8 MB) - use for detailed views
        local_full: './data/tribal-boundaries/pnw-tribal-boundaries.geojson',

        // BIA LAR Feature Service (live query)
        bia_lar: 'https://biamaps.geoplatform.gov/server/rest/services/DivLTR/BIA_AIAN_National_LAR/MapServer/0',

        // Census AIAN (backup)
        census: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/AIANNHA/MapServer/0'
    };

    // Styling configuration
    const STYLES = {
        default: {
            color: '#8B4513',        // Saddle brown
            weight: 2,
            opacity: 0.8,
            fillColor: '#DEB887',    // Burlywood
            fillOpacity: 0.3
        },
        highlighted: {
            color: '#4A2511',
            weight: 3,
            opacity: 1,
            fillColor: '#CD853F',    // Peru
            fillOpacity: 0.5
        },
        selected: {
            color: '#8B0000',        // Dark red
            weight: 4,
            opacity: 1,
            fillColor: '#FFD700',    // Gold
            fillOpacity: 0.4
        }
    };

    let _layer = null;
    let _data = null;
    let _selectedFeature = null;
    let _onFeatureClick = null;

    /**
     * Load Tribal boundary data
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} GeoJSON data
     */
    async function loadData(options = {}) {
        const source = options.source || 'local';

        IndigenousAccessMaps.showLoading('Loading Tribal boundaries...');

        try {
            if (source === 'local') {
                const response = await fetch(DATA_SOURCES.local);
                if (!response.ok) {
                    throw new Error(`Failed to load local data: ${response.status}`);
                }
                _data = await response.json();
            } else if (source === 'bia_lar') {
                _data = await loadFromArcGIS(DATA_SOURCES.bia_lar, options);
            }

            IndigenousAccessMaps.hideLoading();
            return _data;
        } catch (error) {
            IndigenousAccessMaps.hideLoading();
            IndigenousAccessMaps.showError(`Failed to load Tribal boundaries: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load data from ArcGIS Feature Service
     * @param {string} url - Service URL
     * @param {Object} options - Query options
     * @returns {Promise<Object>} GeoJSON data
     */
    async function loadFromArcGIS(url, options = {}) {
        const params = new URLSearchParams({
            where: options.where || '1=1',
            outFields: '*',
            f: 'geojson',
            returnGeometry: true
        });

        // Add spatial filter if bounds provided
        if (options.bounds) {
            const b = options.bounds;
            params.set('geometry', JSON.stringify({
                xmin: b.getWest(),
                ymin: b.getSouth(),
                xmax: b.getEast(),
                ymax: b.getNorth(),
                spatialReference: { wkid: 4326 }
            }));
            params.set('geometryType', 'esriGeometryEnvelope');
            params.set('spatialRel', 'esriSpatialRelIntersects');
        }

        const response = await fetch(`${url}/query?${params}`);
        if (!response.ok) {
            throw new Error(`ArcGIS query failed: ${response.status}`);
        }
        return response.json();
    }

    /**
     * Create the Leaflet layer from loaded data
     * @param {Object} options - Layer options
     * @returns {L.GeoJSON} Leaflet GeoJSON layer
     */
    function createLayer(options = {}) {
        if (!_data) {
            console.error('No Tribal boundary data loaded. Call loadData() first.');
            return null;
        }

        _layer = L.geoJSON(_data, {
            style: feature => getFeatureStyle(feature, 'default'),
            onEachFeature: (feature, layer) => {
                // Add popup
                const popupContent = IAPopups.tribalBoundary(feature.properties);
                layer.bindPopup(popupContent);

                // Add hover effects
                layer.on('mouseover', () => {
                    if (_selectedFeature !== feature) {
                        layer.setStyle(STYLES.highlighted);
                        layer.bringToFront();
                    }
                });

                layer.on('mouseout', () => {
                    if (_selectedFeature !== feature) {
                        layer.setStyle(getFeatureStyle(feature, 'default'));
                    }
                });

                // Add click handler
                layer.on('click', (e) => {
                    // Deselect previous
                    if (_selectedFeature && _selectedFeature !== feature) {
                        _layer.resetStyle();
                    }

                    // Select new
                    _selectedFeature = feature;
                    layer.setStyle(STYLES.selected);
                    layer.bringToFront();

                    if (_onFeatureClick) {
                        _onFeatureClick(feature, layer, e);
                    }
                });
            }
        });

        return _layer;
    }

    /**
     * Get style for a feature
     * @param {Object} feature - GeoJSON feature
     * @param {string} state - Style state (default, highlighted, selected)
     * @returns {Object} Leaflet style object
     */
    function getFeatureStyle(feature, state) {
        // Could customize per-Tribe colors here
        return STYLES[state] || STYLES.default;
    }

    /**
     * Add the layer to the map
     * @param {Object} options - Display options
     */
    async function addToMap(options = {}) {
        const map = IndigenousAccessMaps.getMap();
        if (!map) {
            console.error('Map not initialized');
            return;
        }

        // Load data if not already loaded
        if (!_data) {
            await loadData(options);
        }

        // Create layer if not exists
        if (!_layer) {
            createLayer(options);
        }

        // Add to map
        IndigenousAccessMaps.addOverlay('Tribal Boundaries', _layer, options.visible !== false);

        return _layer;
    }

    /**
     * Remove the layer from the map
     */
    function removeFromMap() {
        if (_layer) {
            IndigenousAccessMaps.removeOverlay('Tribal Boundaries');
            _layer = null;
        }
    }

    /**
     * Focus on a specific Tribal territory
     * @param {string} tribeCode - Tribe code to focus on
     * @returns {boolean} Whether the tribe was found
     */
    function focusTribe(tribeCode) {
        if (!_layer || !_data) {
            console.warn('Tribal boundaries not loaded');
            return false;
        }

        const map = IndigenousAccessMaps.getMap();
        let found = false;

        _layer.eachLayer(layer => {
            const props = layer.feature.properties;
            const code = props.code || props.NAME?.toLowerCase().replace(/\s+/g, '-');

            if (code === tribeCode.toLowerCase()) {
                // Zoom to bounds
                map.fitBounds(layer.getBounds(), { padding: [50, 50] });

                // Select the feature
                _selectedFeature = layer.feature;
                layer.setStyle(STYLES.selected);
                layer.bringToFront();

                // Open popup
                layer.openPopup();

                found = true;
            }
        });

        return found;
    }

    /**
     * Search for Tribes by name
     * @param {string} query - Search query
     * @returns {Array} Matching features
     */
    function searchTribes(query) {
        if (!_data || !_data.features) return [];

        const searchLower = query.toLowerCase();
        return _data.features.filter(feature => {
            const name = feature.properties.name || feature.properties.NAME || '';
            return name.toLowerCase().includes(searchLower);
        });
    }

    /**
     * Get all loaded Tribal boundaries
     * @returns {Array} Array of features
     */
    function getAllTribes() {
        return _data?.features || [];
    }

    /**
     * Set click handler for features
     * @param {Function} handler - Function(feature, layer, event)
     */
    function onFeatureClick(handler) {
        _onFeatureClick = handler;
    }

    /**
     * Clear selection
     */
    function clearSelection() {
        if (_selectedFeature && _layer) {
            _layer.resetStyle();
            _selectedFeature = null;
        }
    }

    /**
     * Get the current layer
     * @returns {L.GeoJSON} Current layer
     */
    function getLayer() {
        return _layer;
    }

    // Public API
    return {
        loadData: loadData,
        createLayer: createLayer,
        addToMap: addToMap,
        removeFromMap: removeFromMap,
        focusTribe: focusTribe,
        searchTribes: searchTribes,
        getAllTribes: getAllTribes,
        onFeatureClick: onFeatureClick,
        clearSelection: clearSelection,
        getLayer: getLayer,
        STYLES: STYLES,
        DATA_SOURCES: DATA_SOURCES
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IATribalBoundaries;
}
