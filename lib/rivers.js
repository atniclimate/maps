/**
 * IndigenousAccess Maps - Rivers and Streams Module
 *
 * Displays river/stream networks and USGS gage data.
 * Supports real-time water level monitoring.
 */

const IARivers = (function() {
    'use strict';

    // USGS Water Services API
    const USGS_API = 'https://waterservices.usgs.gov/nwis';

    // NHDPlus HR WFS for stream networks (USGS)
    const NHD_SERVICE = 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer';

    // Parameter codes for common measurements
    const PARAMETER_CODES = {
        discharge: '00060',      // Streamflow (cfs)
        gageHeight: '00065',     // Gage height (ft)
        temperature: '00010',    // Water temperature
        precipitation: '00045',  // Precipitation
        turbidity: '63680'       // Turbidity
    };

    // Flood stage thresholds (relative styling)
    const STAGE_COLORS = {
        major: '#CC00CC',     // Purple - major flood
        moderate: '#FF0000', // Red - moderate flood
        minor: '#FF9900',    // Orange - minor flood
        action: '#FFFF00',   // Yellow - action stage
        normal: '#00CC00',   // Green - normal
        low: '#00CCFF',      // Light blue - below normal
        unknown: '#808080'   // Gray - no data
    };

    let _gageLayer = null;
    let _streamLayer = null;
    let _gageData = null;
    let _refreshInterval = null;

    /**
     * Fetch USGS gage data
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Gage data
     */
    async function fetchGageData(options = {}) {
        const params = new URLSearchParams({
            format: 'json',
            parameterCd: options.parameters || PARAMETER_CODES.discharge + ',' + PARAMETER_CODES.gageHeight,
            siteStatus: 'active'
        });

        // Add state filter
        if (options.states) {
            params.set('stateCd', Array.isArray(options.states) ? options.states.join(',') : options.states);
        }

        // Add bounding box filter
        if (options.bounds) {
            const b = options.bounds;
            params.set('bBox', `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`);
        }

        // Add site type filter
        if (options.siteType) {
            params.set('siteType', options.siteType);
        } else {
            params.set('siteType', 'ST'); // Stream sites by default
        }

        const url = `${USGS_API}/iv/?${params}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`USGS API error: ${response.status}`);
            }
            _gageData = await response.json();
            return _gageData;
        } catch (error) {
            console.error('USGS API error:', error);
            throw error;
        }
    }

    /**
     * Convert USGS data to GeoJSON
     * @param {Object} data - USGS API response
     * @returns {Object} GeoJSON FeatureCollection
     */
    function convertToGeoJSON(data) {
        if (!data.value || !data.value.timeSeries) {
            return { type: 'FeatureCollection', features: [] };
        }

        const features = [];
        const siteMap = new Map();

        data.value.timeSeries.forEach(series => {
            const siteCode = series.sourceInfo.siteCode[0].value;
            const siteName = series.sourceInfo.siteName;
            const lat = series.sourceInfo.geoLocation.geogLocation.latitude;
            const lon = series.sourceInfo.geoLocation.geogLocation.longitude;
            const paramCode = series.variable.variableCode[0].value;

            // Get latest value
            const values = series.values[0].value;
            const latestValue = values.length > 0 ? values[values.length - 1] : null;

            // Group parameters by site
            if (!siteMap.has(siteCode)) {
                siteMap.set(siteCode, {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lon, lat]
                    },
                    properties: {
                        siteCode: siteCode,
                        siteName: siteName,
                        dateTime: latestValue?.dateTime
                    }
                });
            }

            const feature = siteMap.get(siteCode);

            // Add parameter value
            if (paramCode === PARAMETER_CODES.discharge && latestValue) {
                feature.properties.streamflow = parseFloat(latestValue.value);
            } else if (paramCode === PARAMETER_CODES.gageHeight && latestValue) {
                feature.properties.gageHeight = parseFloat(latestValue.value);
            }
        });

        return {
            type: 'FeatureCollection',
            features: Array.from(siteMap.values())
        };
    }

    /**
     * Determine flood status based on gage height
     * @param {Object} properties - Feature properties
     * @returns {string} Status key
     */
    function determineFloodStatus(properties) {
        // This would ideally use NWS flood stage thresholds per site
        // For now, use a simplified approach
        const height = properties.gageHeight;
        const flow = properties.streamflow;

        if (height === undefined && flow === undefined) return 'unknown';

        // Placeholder logic - in production, compare to actual flood stages
        // from NWS Advanced Hydrologic Prediction Service
        return 'normal';
    }

    /**
     * Create marker icon for gage
     * @param {Object} properties - Feature properties
     * @returns {L.DivIcon}
     */
    function createGageIcon(properties) {
        const status = determineFloodStatus(properties);
        const color = STAGE_COLORS[status];

        return L.divIcon({
            className: 'ia-gage-marker',
            html: `
                <div class="ia-gage-icon" style="background-color: ${color}">
                    <span class="ia-gage-symbol">💧</span>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });
    }

    /**
     * Create gage layer from data
     * @param {Object} geojson - GeoJSON data
     * @returns {L.GeoJSON}
     */
    function createGageLayer(geojson) {
        return L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) => {
                return L.marker(latlng, {
                    icon: createGageIcon(feature.properties)
                });
            },
            onEachFeature: (feature, layer) => {
                const popup = IAPopups.riverGage(feature.properties);
                layer.bindPopup(popup);
            }
        });
    }

    /**
     * Add river gages to map
     * @param {Object} options - Display options
     */
    async function addGagesToMap(options = {}) {
        const map = IndigenousAccessMaps.getMap();
        if (!map) return;

        IndigenousAccessMaps.showLoading('Loading river gages...');

        try {
            const gageOptions = {
                states: options.states || ['WA', 'OR', 'ID', 'MT'],
                ...options
            };

            const data = await fetchGageData(gageOptions);
            const geojson = convertToGeoJSON(data);

            _gageLayer = createGageLayer(geojson);
            IndigenousAccessMaps.addOverlay('River Gages', _gageLayer, options.visible !== false);

            // Auto-refresh
            if (options.autoRefresh !== false) {
                const interval = options.refreshInterval || 900000; // 15 minutes
                startAutoRefresh(interval, gageOptions);
            }

            IndigenousAccessMaps.hideLoading();
            return _gageLayer;
        } catch (error) {
            IndigenousAccessMaps.hideLoading();
            IndigenousAccessMaps.showError('Failed to load river gages');
        }
    }

    /**
     * Query stream network from NHDPlus
     * @param {L.LatLngBounds} bounds - Map bounds
     * @param {Object} options - Query options
     * @returns {Promise<Object>} GeoJSON data
     */
    async function queryStreamNetwork(bounds, options = {}) {
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
            outFields: 'GNIS_NAME,LENGTHKM,FCODE,FTYPE',
            returnGeometry: true,
            f: 'geojson',
            outSR: 4326
        });

        // Filter by stream order if specified
        if (options.minStreamOrder) {
            params.set('where', `StreamOrde >= ${options.minStreamOrder}`);
        }

        const layerId = 6; // Flowlines layer
        const url = `${NHD_SERVICE}/${layerId}/query?${params}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NHD query failed: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            console.error('NHD query error:', error);
            throw error;
        }
    }

    /**
     * Add stream network to map
     * @param {Object} options - Display options
     */
    async function addStreamNetworkToMap(options = {}) {
        const map = IndigenousAccessMaps.getMap();
        if (!map) return;

        IndigenousAccessMaps.showLoading('Loading stream network...');

        try {
            const bounds = map.getBounds();
            const data = await queryStreamNetwork(bounds, options);

            _streamLayer = L.geoJSON(data, {
                style: {
                    color: '#0066CC',
                    weight: 2,
                    opacity: 0.7
                },
                onEachFeature: (feature, layer) => {
                    const name = feature.properties.GNIS_NAME || 'Unnamed Stream';
                    layer.bindPopup(`<strong>${name}</strong>`);
                }
            });

            IndigenousAccessMaps.addOverlay('Streams', _streamLayer, options.visible !== false);
            IndigenousAccessMaps.hideLoading();
            return _streamLayer;
        } catch (error) {
            IndigenousAccessMaps.hideLoading();
            console.warn('Stream network not loaded:', error);
        }
    }

    /**
     * Start auto-refresh of gage data
     * @param {number} interval - Refresh interval in ms
     * @param {Object} options - Fetch options
     */
    function startAutoRefresh(interval, options) {
        stopAutoRefresh();

        _refreshInterval = setInterval(async () => {
            try {
                const data = await fetchGageData(options);
                const geojson = convertToGeoJSON(data);
                if (_gageLayer) {
                    _gageLayer.clearLayers();
                    _gageLayer.addData(geojson);
                }
            } catch (error) {
                console.warn('Gage refresh failed:', error);
            }
        }, interval);
    }

    /**
     * Stop auto-refresh
     */
    function stopAutoRefresh() {
        if (_refreshInterval) {
            clearInterval(_refreshInterval);
            _refreshInterval = null;
        }
    }

    /**
     * Remove all river layers
     */
    function removeFromMap() {
        stopAutoRefresh();

        if (_gageLayer) {
            IndigenousAccessMaps.removeOverlay('River Gages');
            _gageLayer = null;
        }

        if (_streamLayer) {
            IndigenousAccessMaps.removeOverlay('Streams');
            _streamLayer = null;
        }

        _gageData = null;
    }

    /**
     * Get gage by site code
     * @param {string} siteCode - USGS site code
     * @returns {Object|null} Gage feature
     */
    function getGageBySiteCode(siteCode) {
        if (!_gageLayer) return null;

        let found = null;
        _gageLayer.eachLayer(layer => {
            if (layer.feature.properties.siteCode === siteCode) {
                found = layer.feature;
            }
        });
        return found;
    }

    /**
     * Get legend items
     * @returns {Array}
     */
    function getLegend() {
        return [
            { status: 'major', color: STAGE_COLORS.major, label: 'Major Flood' },
            { status: 'moderate', color: STAGE_COLORS.moderate, label: 'Moderate Flood' },
            { status: 'minor', color: STAGE_COLORS.minor, label: 'Minor Flood' },
            { status: 'action', color: STAGE_COLORS.action, label: 'Action Stage' },
            { status: 'normal', color: STAGE_COLORS.normal, label: 'Normal' },
            { status: 'low', color: STAGE_COLORS.low, label: 'Below Normal' }
        ];
    }

    // Public API
    return {
        addGagesToMap: addGagesToMap,
        addStreamNetworkToMap: addStreamNetworkToMap,
        removeFromMap: removeFromMap,
        fetchGageData: fetchGageData,
        queryStreamNetwork: queryStreamNetwork,
        getGageBySiteCode: getGageBySiteCode,
        startAutoRefresh: startAutoRefresh,
        stopAutoRefresh: stopAutoRefresh,
        getLegend: getLegend,
        PARAMETER_CODES: PARAMETER_CODES,
        STAGE_COLORS: STAGE_COLORS
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IARivers;
}
