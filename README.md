# IndigenousAccess Maps

External map server for IndigenousAccess.org providing advanced GIS capabilities that exceed Squarespace's native features.

## Architecture

```
indigenousaccess-maps/
├── index.html              # Demo/testing page
├── embed/                  # Embeddable map pages for Squarespace iframes
│   ├── hazards.html        # Weather hazards map
│   ├── flood-zones.html    # FEMA flood zone map
│   ├── rivers.html         # River/stream monitoring
│   └── tribal-lands.html   # Tribal boundaries focus
├── lib/                    # Shared JavaScript modules
│   ├── map-core.js         # Base map setup, common utilities
│   ├── tribal-boundaries.js # Tribal boundary layer logic
│   ├── flood-zones.js      # FEMA flood zone rendering
│   ├── hazard-layers.js    # NWS hazard polygons
│   ├── rivers.js           # Hydrography layers
│   ├── popups.js           # Feature popup templates
│   └── controls.js         # Region selector, Tribal dropdown
├── data/                   # Static GeoJSON data files
│   ├── tribal-boundaries/  # BIA LAR/AIAN boundary data
│   ├── regions/            # PNW region definitions
│   └── config.json         # Layer configurations
├── styles/                 # CSS for maps and controls
│   └── map.css
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Pages deployment
```

## Embedding in Squarespace

Each map in `/embed/` is designed for iframe embedding:

```html
<iframe
  src="https://indigenousaccess.github.io/maps/embed/hazards.html?region=wa"
  width="100%"
  height="500"
  frameborder="0">
</iframe>
```

### URL Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `region` | `wa`, `or`, `id`, `mt`, `pnw` | Initial region focus |
| `tribe` | Tribal code | Center on specific Tribal territory |
| `layers` | Comma-separated | Pre-enabled layers |
| `controls` | `full`, `minimal`, `none` | UI control visibility |

## Data Sources

- **Tribal Boundaries**: BIA LAR, Census AIAN
- **Flood Zones**: FEMA NFHL via OpenFEMA
- **Hazards**: NWS API alerts and watches
- **Rivers**: USGS NHD, real-time gage data

## Development

```bash
# Local development server
npx serve .

# Or Python
python -m http.server 8000
```

## Deployment

Push to `main` branch triggers automatic GitHub Pages deployment.

---

*Part of the IndigenousACCESS-Dashboard project*
