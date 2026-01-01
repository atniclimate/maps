/**
 * IndigenousAccess Maps - Controls Module
 *
 * Provides UI controls for region selection and Tribal territory dropdown.
 * Designed for consistency with IndigenousAccess.org styling.
 */

const IAControls = (function() {
    'use strict';

    // Pacific Northwest Tribal Nations
    // Synced with BIA LAR data (52 territories)
    // Organized by state for easier navigation
    const TRIBAL_NATIONS = {
        wa: {
            name: 'Washington',
            tribes: [
                { code: 'celilo', name: 'Celilo' },
                { code: 'chehalis', name: 'Confederated Tribes of the Chehalis Reservation' },
                { code: 'colville', name: 'Confederated Tribes of the Colville Reservation' },
                { code: 'cowlitz', name: 'Cowlitz Indian Tribe' },
                { code: 'hoh', name: 'Hoh Indian Tribe' },
                { code: 'jamestown', name: 'Jamestown S\'Klallam Tribe' },
                { code: 'kalispel', name: 'Kalispel Tribe of Indians' },
                { code: 'lower-elwha', name: 'Lower Elwha Klallam Tribe' },
                { code: 'lummi', name: 'Lummi Nation' },
                { code: 'makah', name: 'Makah Tribe' },
                { code: 'muckleshoot', name: 'Muckleshoot Indian Tribe' },
                { code: 'nisqually', name: 'Nisqually Indian Tribe' },
                { code: 'nooksack', name: 'Nooksack Indian Tribe' },
                { code: 'port-gamble', name: 'Port Gamble S\'Klallam Tribe' },
                { code: 'port-madison', name: 'Port Madison (Suquamish)' },
                { code: 'puyallup', name: 'Puyallup Tribe of Indians' },
                { code: 'quileute', name: 'Quileute Tribe' },
                { code: 'quinault', name: 'Quinault Indian Nation' },
                { code: 'sauk-suiattle', name: 'Sauk-Suiattle Indian Tribe' },
                { code: 'shoalwater', name: 'Shoalwater Bay Indian Tribe' },
                { code: 'skokomish', name: 'Skokomish Indian Tribe' },
                { code: 'spokane', name: 'Spokane Tribe of Indians' },
                { code: 'squaxin-island', name: 'Squaxin Island Tribe' },
                { code: 'stillaguamish', name: 'Stillaguamish Tribe of Indians' },
                { code: 'swinomish', name: 'Swinomish Indian Tribal Community' },
                { code: 'tulalip', name: 'Tulalip Tribes' },
                { code: 'umatilla', name: 'Confederated Tribes of the Umatilla Indian Reservation' },
                { code: 'upper-skagit', name: 'Upper Skagit Indian Tribe' },
                { code: 'yakama', name: 'Confederated Tribes and Bands of the Yakama Nation' }
            ]
        },
        or: {
            name: 'Oregon',
            tribes: [
                { code: 'burns-paiute', name: 'Burns Paiute Tribe' },
                { code: 'coquille-of-oregon', name: 'Coquille Indian Tribe' },
                { code: 'cow-creek', name: 'Cow Creek Band of Umpqua Tribe' },
                { code: 'fort-mcdermitt', name: 'Fort McDermitt Paiute-Shoshone' },
                { code: 'grand-ronde', name: 'Confederated Tribes of Grand Ronde' },
                { code: 'klamath', name: 'Klamath Tribes' },
                { code: 'siletz', name: 'Confederated Tribes of Siletz Indians' },
                { code: 'smith-river', name: 'Smith River Rancheria' },
                { code: 'the-dalles-unit', name: 'The Dalles Unit' },
                { code: 'warm-springs', name: 'Confederated Tribes of Warm Springs' }
            ]
        },
        id: {
            name: 'Idaho',
            tribes: [
                { code: 'blackfeet', name: 'Blackfeet Nation' },
                { code: 'coeur-dalene', name: 'Coeur d\'Alene Tribe' },
                { code: 'duck-valley', name: 'Duck Valley Shoshone-Paiute' },
                { code: 'flathead', name: 'Confederated Salish and Kootenai Tribes' },
                { code: 'fort-hall', name: 'Shoshone-Bannock Tribes of Fort Hall' },
                { code: 'kootenai', name: 'Kootenai Tribe of Idaho' },
                { code: 'nez-perce', name: 'Nez Perce Tribe' },
                { code: 'northwestern-shoshoni', name: 'Northwestern Band of Shoshoni' }
            ]
        },
        mt: {
            name: 'Montana',
            tribes: [
                { code: 'crow', name: 'Crow Tribe' },
                { code: 'fort-belknap', name: 'Fort Belknap Indian Community' },
                { code: 'fort-peck', name: 'Fort Peck Assiniboine and Sioux Tribes' },
                { code: 'northern-cheyenne', name: 'Northern Cheyenne Tribe' },
                { code: 'rocky-boys', name: 'Chippewa Cree Tribe of Rocky Boy\'s' }
            ]
        }
    };

    let _container = null;
    let _onRegionChange = null;
    let _onTribeChange = null;

    /**
     * Create region selector buttons
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Configuration options
     */
    function createRegionSelector(container, options = {}) {
        _container = container;

        const regions = IndigenousAccessMaps.getRegions();
        const currentRegion = IndigenousAccessMaps.getCurrentRegion();

        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'ia-region-selector';
        selectorDiv.innerHTML = '<label>Region:</label>';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'ia-region-buttons';

        // Filter regions if specified
        const showRegions = options.regions || ['pnw', 'wa', 'or', 'id', 'mt'];

        showRegions.forEach(code => {
            const region = regions[code];
            if (!region) return;

            const btn = document.createElement('button');
            btn.className = 'ia-region-btn' + (code === currentRegion ? ' active' : '');
            btn.dataset.region = code;
            btn.textContent = code.toUpperCase();
            btn.title = region.name;

            btn.addEventListener('click', () => {
                // Update active state
                buttonContainer.querySelectorAll('.ia-region-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');

                // Focus map on region
                IndigenousAccessMaps.focusRegion(code);

                // Callback
                if (_onRegionChange) {
                    _onRegionChange(code, region);
                }
            });

            buttonContainer.appendChild(btn);
        });

        selectorDiv.appendChild(buttonContainer);
        container.appendChild(selectorDiv);

        return selectorDiv;
    }

    /**
     * Create Tribal territory dropdown
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Configuration options
     */
    function createTribalDropdown(container, options = {}) {
        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'ia-tribal-dropdown';
        dropdownDiv.innerHTML = '<label for="ia-tribe-select">Tribal Nation:</label>';

        const select = document.createElement('select');
        select.id = 'ia-tribe-select';
        select.className = 'ia-select';

        // Default option
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Select a Tribal Nation --';
        select.appendChild(defaultOpt);

        // Filter states if specified
        const showStates = options.states || Object.keys(TRIBAL_NATIONS);

        showStates.forEach(stateCode => {
            const stateData = TRIBAL_NATIONS[stateCode];
            if (!stateData) return;

            // Create optgroup for each state
            const optgroup = document.createElement('optgroup');
            optgroup.label = stateData.name;

            stateData.tribes.forEach(tribe => {
                const opt = document.createElement('option');
                opt.value = tribe.code;
                opt.textContent = tribe.name;
                opt.dataset.state = stateCode;
                optgroup.appendChild(opt);
            });

            select.appendChild(optgroup);
        });

        select.addEventListener('change', (e) => {
            const tribeCode = e.target.value;
            if (tribeCode && _onTribeChange) {
                const selectedOption = e.target.selectedOptions[0];
                const stateCode = selectedOption.dataset.state;
                _onTribeChange(tribeCode, stateCode);
            }
        });

        dropdownDiv.appendChild(select);
        container.appendChild(dropdownDiv);

        return dropdownDiv;
    }

    /**
     * Create the full control panel
     * @param {string} containerId - DOM element ID for the controls
     * @param {Object} options - Configuration options
     */
    function createControlPanel(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Control container not found:', containerId);
            return;
        }

        container.className = 'ia-control-panel';

        // Add region selector
        if (options.showRegions !== false) {
            createRegionSelector(container, options);
        }

        // Add tribal dropdown
        if (options.showTribalDropdown !== false) {
            createTribalDropdown(container, options);
        }

        // Add layer toggles if specified
        if (options.layerToggles) {
            createLayerToggles(container, options.layerToggles);
        }

        return container;
    }

    /**
     * Create layer toggle switches
     * @param {HTMLElement} container - Container element
     * @param {Array} layers - Layer definitions
     */
    function createLayerToggles(container, layers) {
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'ia-layer-toggles';
        toggleDiv.innerHTML = '<label>Layers:</label>';

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'ia-toggle-container';

        layers.forEach(layer => {
            const toggleWrapper = document.createElement('label');
            toggleWrapper.className = 'ia-toggle-wrapper';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `layer-${layer.id}`;
            checkbox.checked = layer.default || false;

            checkbox.addEventListener('change', (e) => {
                if (layer.onChange) {
                    layer.onChange(e.target.checked);
                }
            });

            const slider = document.createElement('span');
            slider.className = 'ia-toggle-slider';

            const labelText = document.createElement('span');
            labelText.className = 'ia-toggle-label';
            labelText.textContent = layer.name;

            toggleWrapper.appendChild(checkbox);
            toggleWrapper.appendChild(slider);
            toggleWrapper.appendChild(labelText);
            toggleContainer.appendChild(toggleWrapper);
        });

        toggleDiv.appendChild(toggleContainer);
        container.appendChild(toggleDiv);

        return toggleDiv;
    }

    /**
     * Set callback for region changes
     * @param {Function} callback - Function(regionCode, regionData)
     */
    function onRegionChange(callback) {
        _onRegionChange = callback;
    }

    /**
     * Set callback for tribe selection
     * @param {Function} callback - Function(tribeCode, stateCode)
     */
    function onTribeChange(callback) {
        _onTribeChange = callback;
    }

    /**
     * Get Tribal Nation data
     * @param {string} code - Tribe code
     * @returns {Object|null} Tribe data
     */
    function getTribe(code) {
        for (const state of Object.values(TRIBAL_NATIONS)) {
            const tribe = state.tribes.find(t => t.code === code);
            if (tribe) return tribe;
        }
        return null;
    }

    /**
     * Get all tribes for a state
     * @param {string} stateCode - State code
     * @returns {Array} Array of tribe objects
     */
    function getTribesForState(stateCode) {
        const state = TRIBAL_NATIONS[stateCode.toLowerCase()];
        return state ? state.tribes : [];
    }

    // Public API
    return {
        createControlPanel: createControlPanel,
        createRegionSelector: createRegionSelector,
        createTribalDropdown: createTribalDropdown,
        createLayerToggles: createLayerToggles,
        onRegionChange: onRegionChange,
        onTribeChange: onTribeChange,
        getTribe: getTribe,
        getTribesForState: getTribesForState,
        TRIBAL_NATIONS: TRIBAL_NATIONS
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IAControls;
}
