/**
 * IndigenousAccess Maps - Popup Templates Module
 *
 * Provides consistent popup templates for different feature types.
 * Designed for accessibility and mobile-friendly display.
 */

const IAPopups = (function() {
    'use strict';

    /**
     * Format a date for display
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date string
     */
    function formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    /**
     * Format a timestamp for display
     * @param {string|Date} timestamp - Timestamp to format
     * @returns {string} Formatted timestamp
     */
    function formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';
        const d = new Date(timestamp);
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    }

    /**
     * Create popup for Tribal boundary feature
     * @param {Object} properties - GeoJSON feature properties
     * @returns {string} HTML content for popup
     */
    function tribalBoundary(properties) {
        const name = properties.name || properties.NAMELSAD || 'Unknown Tribal Land';
        const type = properties.type || properties.MTFCC || '';
        const landArea = properties.ALAND ? (properties.ALAND / 2589988).toFixed(1) : null;

        let html = `
            <div class="ia-popup ia-popup-tribal">
                <h3 class="ia-popup-title">${escapeHtml(name)}</h3>
        `;

        if (type) {
            const typeLabel = getTribalLandType(type);
            html += `<p class="ia-popup-subtitle">${typeLabel}</p>`;
        }

        if (landArea) {
            html += `<p class="ia-popup-stat"><strong>Land Area:</strong> ${landArea} sq mi</p>`;
        }

        // Add links if available
        if (properties.website) {
            html += `<a href="${escapeHtml(properties.website)}" target="_blank" rel="noopener" class="ia-popup-link">Visit Tribal Website</a>`;
        }

        html += '</div>';
        return html;
    }

    /**
     * Get human-readable Tribal land type
     * @param {string} code - MTFCC or type code
     * @returns {string} Human-readable type
     */
    function getTribalLandType(code) {
        const types = {
            'G2100': 'American Indian Area',
            'G2120': 'Alaska Native Village Statistical Area',
            'G2130': 'Oklahoma Tribal Statistical Area',
            'G2140': 'State Designated Tribal Statistical Area',
            'G2150': 'American Indian Joint-Use Area',
            'G2160': 'Hawaiian Home Land',
            'reservation': 'Reservation',
            'trust_land': 'Trust Land',
            'off_reservation': 'Off-Reservation Trust Land'
        };
        return types[code] || 'Tribal Territory';
    }

    /**
     * Create popup for FEMA flood zone feature
     * @param {Object} properties - GeoJSON feature properties
     * @returns {string} HTML content for popup
     */
    function floodZone(properties) {
        const zone = properties.FLD_ZONE || properties.zone || 'Unknown';
        const zoneInfo = getFloodZoneInfo(zone);

        let html = `
            <div class="ia-popup ia-popup-flood">
                <h3 class="ia-popup-title">Flood Zone ${escapeHtml(zone)}</h3>
                <p class="ia-popup-risk ia-risk-${zoneInfo.riskLevel}">${zoneInfo.riskLabel}</p>
                <p class="ia-popup-description">${zoneInfo.description}</p>
        `;

        if (properties.STATIC_BFE) {
            html += `<p class="ia-popup-stat"><strong>Base Flood Elevation:</strong> ${properties.STATIC_BFE} ft</p>`;
        }

        if (properties.SFHA_TF === 'T') {
            html += `<p class="ia-popup-warning">Special Flood Hazard Area - Flood insurance required for federally-backed mortgages</p>`;
        }

        html += `
                <p class="ia-popup-source">Source: FEMA National Flood Hazard Layer</p>
            </div>
        `;
        return html;
    }

    /**
     * Get flood zone information
     * @param {string} zone - FEMA flood zone code
     * @returns {Object} Zone info with risk level and description
     */
    function getFloodZoneInfo(zone) {
        const zones = {
            'A': { riskLevel: 'high', riskLabel: 'High Risk', description: '1% annual chance of flooding (100-year flood)' },
            'AE': { riskLevel: 'high', riskLabel: 'High Risk', description: '1% annual chance with base flood elevations' },
            'AH': { riskLevel: 'high', riskLabel: 'High Risk', description: 'Shallow flooding (1-3 ft depth)' },
            'AO': { riskLevel: 'high', riskLabel: 'High Risk', description: 'Sheet flow on sloping terrain' },
            'V': { riskLevel: 'high', riskLabel: 'High Risk - Coastal', description: 'Coastal high hazard with wave action' },
            'VE': { riskLevel: 'high', riskLabel: 'High Risk - Coastal', description: 'Coastal with base flood elevations' },
            'X': { riskLevel: 'low', riskLabel: 'Minimal Risk', description: 'Outside 500-year flood zone' },
            'B': { riskLevel: 'moderate', riskLabel: 'Moderate Risk', description: '0.2% annual chance (500-year flood)' },
            'C': { riskLevel: 'low', riskLabel: 'Minimal Risk', description: 'Minimal flood hazard' },
            'D': { riskLevel: 'unknown', riskLabel: 'Undetermined', description: 'Flood hazard not determined' }
        };
        return zones[zone] || { riskLevel: 'unknown', riskLabel: 'Unknown', description: 'Zone classification not available' };
    }

    /**
     * Create popup for NWS weather hazard
     * @param {Object} properties - Alert properties from NWS API
     * @returns {string} HTML content for popup
     */
    function weatherHazard(properties) {
        const event = properties.event || 'Weather Alert';
        const severity = properties.severity || 'Unknown';
        const urgency = properties.urgency || '';
        const headline = properties.headline || '';
        const description = properties.description || '';
        const instruction = properties.instruction || '';
        const expires = properties.expires;

        const severityClass = getSeverityClass(severity);

        let html = `
            <div class="ia-popup ia-popup-hazard ia-severity-${severityClass}">
                <h3 class="ia-popup-title">${escapeHtml(event)}</h3>
                <p class="ia-popup-severity">${severity}${urgency ? ' - ' + urgency : ''}</p>
        `;

        if (headline) {
            html += `<p class="ia-popup-headline">${escapeHtml(headline)}</p>`;
        }

        if (expires) {
            html += `<p class="ia-popup-expires"><strong>Expires:</strong> ${formatTimestamp(expires)}</p>`;
        }

        if (description) {
            // Truncate long descriptions
            const shortDesc = description.length > 300 ? description.substring(0, 300) + '...' : description;
            html += `<p class="ia-popup-description">${escapeHtml(shortDesc)}</p>`;
        }

        if (instruction) {
            html += `<p class="ia-popup-instruction"><strong>Action:</strong> ${escapeHtml(instruction)}</p>`;
        }

        html += `
                <p class="ia-popup-source">Source: National Weather Service</p>
            </div>
        `;
        return html;
    }

    /**
     * Get CSS class for severity level
     * @param {string} severity - NWS severity string
     * @returns {string} CSS class suffix
     */
    function getSeverityClass(severity) {
        const mapping = {
            'Extreme': 'extreme',
            'Severe': 'severe',
            'Moderate': 'moderate',
            'Minor': 'minor',
            'Unknown': 'unknown'
        };
        return mapping[severity] || 'unknown';
    }

    /**
     * Create popup for river/stream gage
     * @param {Object} properties - USGS gage properties
     * @returns {string} HTML content for popup
     */
    function riverGage(properties) {
        const siteName = properties.siteName || properties.station_nm || 'River Gage';
        const siteCode = properties.siteCode || properties.site_no || '';
        const streamflow = properties.streamflow || properties.value;
        const gageHeight = properties.gageHeight || properties.gage_ht;
        const dateTime = properties.dateTime;
        const floodStage = properties.floodStage;

        let html = `
            <div class="ia-popup ia-popup-river">
                <h3 class="ia-popup-title">${escapeHtml(siteName)}</h3>
                ${siteCode ? `<p class="ia-popup-subtitle">USGS ${siteCode}</p>` : ''}
        `;

        if (streamflow !== undefined && streamflow !== null) {
            html += `<p class="ia-popup-stat ia-stat-primary"><strong>Streamflow:</strong> ${Number(streamflow).toLocaleString()} cfs</p>`;
        }

        if (gageHeight !== undefined && gageHeight !== null) {
            let heightClass = '';
            if (floodStage && gageHeight >= floodStage) {
                heightClass = 'ia-flood-warning';
            }
            html += `<p class="ia-popup-stat ${heightClass}"><strong>Gage Height:</strong> ${gageHeight} ft</p>`;
        }

        if (floodStage) {
            html += `<p class="ia-popup-stat"><strong>Flood Stage:</strong> ${floodStage} ft</p>`;
        }

        if (dateTime) {
            html += `<p class="ia-popup-timestamp">As of ${formatTimestamp(dateTime)}</p>`;
        }

        html += `
                <a href="https://waterdata.usgs.gov/monitoring-location/${siteCode}/" target="_blank" rel="noopener" class="ia-popup-link">View Full Data</a>
                <p class="ia-popup-source">Source: USGS National Water Information System</p>
            </div>
        `;
        return html;
    }

    /**
     * Create popup for generic point of interest
     * @param {Object} properties - Feature properties
     * @returns {string} HTML content for popup
     */
    function genericPoint(properties) {
        const name = properties.name || properties.NAME || 'Location';
        const description = properties.description || '';

        let html = `
            <div class="ia-popup ia-popup-generic">
                <h3 class="ia-popup-title">${escapeHtml(name)}</h3>
        `;

        // Add any additional properties
        const excludeKeys = ['name', 'NAME', 'description', 'geometry'];
        Object.entries(properties).forEach(([key, value]) => {
            if (!excludeKeys.includes(key) && value && typeof value !== 'object') {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                html += `<p class="ia-popup-stat"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</p>`;
            }
        });

        if (description) {
            html += `<p class="ia-popup-description">${escapeHtml(description)}</p>`;
        }

        html += '</div>';
        return html;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Create a Leaflet popup with options
     * @param {string} content - HTML content
     * @param {Object} options - Popup options
     * @returns {L.Popup} Leaflet popup
     */
    function createPopup(content, options = {}) {
        const defaultOptions = {
            maxWidth: 350,
            minWidth: 200,
            maxHeight: 400,
            autoPan: true,
            closeButton: true,
            className: 'ia-leaflet-popup'
        };

        return L.popup({ ...defaultOptions, ...options }).setContent(content);
    }

    // Public API
    return {
        tribalBoundary: tribalBoundary,
        floodZone: floodZone,
        weatherHazard: weatherHazard,
        riverGage: riverGage,
        genericPoint: genericPoint,
        createPopup: createPopup,
        formatDate: formatDate,
        formatTimestamp: formatTimestamp,
        escapeHtml: escapeHtml
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IAPopups;
}
