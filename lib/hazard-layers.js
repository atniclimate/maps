/**
 * IndigenousAccess Maps - Weather Hazard Layers Module
 *
 * Loads and displays NWS weather alerts, watches, and warnings.
 * Real-time hazard polygons from NWS API.
 */

const IAHazardLayers = (function() {
    'use strict';

    // NWS API endpoint
    const NWS_API = 'https://api.weather.gov';

    // Alert severity colors
    const SEVERITY_COLORS = {
        'Extreme': '#FF0000',    // Red
        'Severe': '#FF6600',     // Orange
        'Moderate': '#FFCC00',   // Yellow
        'Minor': '#99CC00',      // Yellow-green
        'Unknown': '#808080'     // Gray
    };

    // Alert type icons (for point markers)
    const ALERT_ICONS = {
        'Tornado Warning': '🌪️',
        'Tornado Watch': '⚠️🌪️',
        'Severe Thunderstorm Warning': '⛈️',
        'Severe Thunderstorm Watch': '⚠️⛈️',
        'Flash Flood Warning': '🌊',
        'Flood Warning': '💧',
        'Flood Watch': '⚠️💧',
        'Winter Storm Warning': '❄️',
        'Winter Storm Watch': '⚠️❄️',
        'Blizzard Warning': '🌨️',
        'Fire Weather Watch': '🔥',
        'Red Flag Warning': '🚩',
        'Excessive Heat Warning': '🌡️',
        'Heat Advisory': '☀️',
        'Tsunami Warning': '🌊',
        'Earthquake Warning': '📳',
        'default': '⚠️'
    };

    let _layer = null;
    let _data = null;
    let _refreshInterval = null;

    /**
     * Fetch active alerts from NWS API
     * @param {Object} options - Query options
     * @returns {Promise<Object>} GeoJSON FeatureCollection
     */
    async function fetchAlerts(options = {}) {
        let url = `${NWS_API}/alerts/active`;

        const params = new URLSearchParams();

        // Add area filter (state codes)
        if (options.area) {
            params.set('area', Array.isArray(options.area) ? options.area.join(',') : options.area);
        }

        // Add severity filter
        if (options.severity) {
            params.set('severity', Array.isArray(options.severity) ? options.severity.join(',') : options.severity);
        }

        // Add urgency filter
        if (options.urgency) {
            params.set('urgency', options.urgency);
        }

        // Add event type filter
        if (options.event) {
            params.set('event', options.event);
        }

        const queryString = params.toString();
        if (queryString) {
            url += '?' + queryString;
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/geo+json',
                    'User-Agent': 'IndigenousAccess Maps (contact@indigenousaccess.org)'
                }
            });

            if (!response.ok) {
                throw new Error(`NWS API error: ${response.status}`);
            }

            _data = await response.json();
            return _data;
        } catch (error) {
            console.error('NWS API error:', error);
            throw error;
        }
    }

    /**
     * Style function for hazard features
     * @param {Object} feature - GeoJSON feature
     * @returns {Object} Leaflet style
     */
    function styleFeature(feature) {
        const severity = feature.properties.severity || 'Unknown';
        const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.Unknown;

        return {
            color: color,
            weight: 2,
            opacity: 0.9,
            fillColor: color,
            fillOpacity: 0.35,
            dashArray: severity === 'Extreme' ? null : '5, 5'
        };
    }

    /**
     * Create layer from fetched alert data
     * @param {Object} data - GeoJSON data
     * @returns {L.GeoJSON} Leaflet layer
     */
    function createLayer(data) {
        return L.geoJSON(data, {
            style: styleFeature,
            pointToLayer: (feature, latlng) => {
                const event = feature.properties.event || 'Alert';
                const icon = ALERT_ICONS[event] || ALERT_ICONS.default;

                return L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'ia-hazard-marker',
                        html: `<span class="ia-hazard-icon">${icon}</span>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    })
                });
            },
            onEachFeature: (feature, layer) => {
                const popup = IAPopups.weatherHazard(feature.properties);
                layer.bindPopup(popup, { maxWidth: 400 });

                // Highlight on hover
                if (layer.setStyle) {
                    layer.on('mouseover', () => {
                        layer.setStyle({
                            weight: 4,
                            fillOpacity: 0.5
                        });
                        layer.bringToFront();
                    });

                    layer.on('mouseout', () => {
                        _layer.resetStyle(layer);
                    });
                }
            },
            filter: (feature) => {
                // Filter out expired alerts
                const expires = feature.properties.expires;
                if (expires) {
                    return new Date(expires) > new Date();
                }
                return true;
            }
        });
    }

    /**
     * Add hazard layer to map
     * @param {Object} options - Display options
     */
    async function addToMap(options = {}) {
        const map = IndigenousAccessMaps.getMap();
        if (!map) return;

        IndigenousAccessMaps.showLoading('Loading weather alerts...');

        try {
            // Default to PNW states
            const alertOptions = {
                area: options.area || ['WA', 'OR', 'ID', 'MT'],
                ...options
            };

            const data = await fetchAlerts(alertOptions);

            _layer = createLayer(data);
            IndigenousAccessMaps.addOverlay('Weather Alerts', _layer, options.visible !== false);

            // Set up auto-refresh
            if (options.autoRefresh !== false) {
                const interval = options.refreshInterval || 300000; // 5 minutes default
                startAutoRefresh(interval, alertOptions);
            }

            IndigenousAccessMaps.hideLoading();
            return _layer;
        } catch (error) {
            IndigenousAccessMaps.hideLoading();
            IndigenousAccessMaps.showError('Failed to load weather alerts');
        }
    }

    /**
     * Start auto-refresh of alert data
     * @param {number} interval - Refresh interval in ms
     * @param {Object} options - Fetch options
     */
    function startAutoRefresh(interval, options) {
        stopAutoRefresh(); // Clear any existing interval

        _refreshInterval = setInterval(async () => {
            try {
                const data = await fetchAlerts(options);
                if (_layer) {
                    _layer.clearLayers();
                    _layer.addData(data);
                }
            } catch (error) {
                console.warn('Alert refresh failed:', error);
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
     * Remove hazard layer
     */
    function removeFromMap() {
        stopAutoRefresh();

        if (_layer) {
            IndigenousAccessMaps.removeOverlay('Weather Alerts');
            _layer = null;
        }
        _data = null;
    }

    /**
     * Get alerts by severity
     * @param {string} severity - Severity level
     * @returns {Array} Matching features
     */
    function getAlertsBySeverity(severity) {
        if (!_data || !_data.features) return [];
        return _data.features.filter(f => f.properties.severity === severity);
    }

    /**
     * Get alerts by event type
     * @param {string} eventType - Event type (e.g., "Flood Warning")
     * @returns {Array} Matching features
     */
    function getAlertsByEvent(eventType) {
        if (!_data || !_data.features) return [];
        return _data.features.filter(f =>
            f.properties.event.toLowerCase().includes(eventType.toLowerCase())
        );
    }

    /**
     * Get count of active alerts by severity
     * @returns {Object} Counts by severity
     */
    function getAlertCounts() {
        if (!_data || !_data.features) {
            return { Extreme: 0, Severe: 0, Moderate: 0, Minor: 0, Unknown: 0, total: 0 };
        }

        const counts = { Extreme: 0, Severe: 0, Moderate: 0, Minor: 0, Unknown: 0, total: 0 };

        _data.features.forEach(f => {
            const severity = f.properties.severity || 'Unknown';
            counts[severity] = (counts[severity] || 0) + 1;
            counts.total++;
        });

        return counts;
    }

    /**
     * Check if any extreme/severe alerts are active
     * @returns {boolean}
     */
    function hasHighSeverityAlerts() {
        const counts = getAlertCounts();
        return counts.Extreme > 0 || counts.Severe > 0;
    }

    /**
     * Get legend items
     * @returns {Array}
     */
    function getLegend() {
        return [
            { severity: 'Extreme', color: SEVERITY_COLORS.Extreme, label: 'Extreme' },
            { severity: 'Severe', color: SEVERITY_COLORS.Severe, label: 'Severe' },
            { severity: 'Moderate', color: SEVERITY_COLORS.Moderate, label: 'Moderate' },
            { severity: 'Minor', color: SEVERITY_COLORS.Minor, label: 'Minor' }
        ];
    }

    /**
     * Force refresh of alerts
     * @param {Object} options - Fetch options
     */
    async function refresh(options = {}) {
        if (!_layer) return;

        const alertOptions = {
            area: options.area || ['WA', 'OR', 'ID', 'MT'],
            ...options
        };

        try {
            const data = await fetchAlerts(alertOptions);
            _layer.clearLayers();
            _layer.addData(data);
        } catch (error) {
            console.error('Alert refresh failed:', error);
        }
    }

    /**
     * Get the current layer
     * @returns {L.GeoJSON}
     */
    function getLayer() {
        return _layer;
    }

    /**
     * Get raw alert data
     * @returns {Object}
     */
    function getData() {
        return _data;
    }

    // Public API
    return {
        addToMap: addToMap,
        removeFromMap: removeFromMap,
        fetchAlerts: fetchAlerts,
        refresh: refresh,
        getAlertsBySeverity: getAlertsBySeverity,
        getAlertsByEvent: getAlertsByEvent,
        getAlertCounts: getAlertCounts,
        hasHighSeverityAlerts: hasHighSeverityAlerts,
        getLegend: getLegend,
        startAutoRefresh: startAutoRefresh,
        stopAutoRefresh: stopAutoRefresh,
        getLayer: getLayer,
        getData: getData,
        SEVERITY_COLORS: SEVERITY_COLORS,
        ALERT_ICONS: ALERT_ICONS
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IAHazardLayers;
}
