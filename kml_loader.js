// kml_loader.js

(function () {
    const KML_TRAMOS = [
        { id: "4503", url: "4503.kml" },
        { id: "4505", url: "4505.kml" },
        { id: "45HLB", url: "45HLB.kml" },
        { id: "45HLC", url: "ruta_densa_10m_45HLC.kml" }
    ];

    const Rutas = {}; // TRAMO -> { points: [{lat,lng,dist}], distMax }

    function toRad(deg) {
        return (deg * Math.PI) / 180;
    }

    // Distancia Haversine en metros
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000; // m
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    async function loadKmlForTramo(tramo) {
        try {
            const resp = await fetch(tramo.url);
            if (!resp.ok) {
                console.error("No se pudo cargar KML de tramo", tramo.id, resp.status);
                return;
            }
            const text = await resp.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, "application/xml");

            const coordNodes = xml.getElementsByTagName("coordinates");
            if (!coordNodes.length) {
                console.warn("KML sin <coordinates> para tramo", tramo.id);
                return;
            }

            const coordText = coordNodes[0].textContent.trim();
            const tokens = coordText.split(/\s+/);

            const points = [];
            let distAcum = 0;
            let prevLat = null;
            let prevLng = null;

            for (const token of tokens) {
                const parts = token.split(",");
                if (parts.length < 2) continue;

                const lon = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

                if (prevLat !== null && prevLng !== null) {
                    distAcum += haversine(prevLat, prevLng, lat, lon);
                }

                points.push({ lat, lng: lon, dist: distAcum });
                prevLat = lat;
                prevLng = lon;
            }

            if (!points.length) {
                console.warn("KML sin puntos válidos para tramo", tramo.id);
                return;
            }

            Rutas[tramo.id] = {
                tramoId: tramo.id,
                points,
                distMax: distAcum,
            };

            console.log(
                `Tramo ${tramo.id}: ${points.length} puntos, longitud ~${Math.round(
                    distAcum
                )} m`
            );
        } catch (e) {
            console.error("Error cargando KML de tramo", tramo.id, e);
        }
    }

    async function initKml() {
        await Promise.all(KML_TRAMOS.map(loadKmlForTramo));
        console.log("KML cargados:", Object.keys(Rutas));
    }

    window.kmlReady = initKml();

    // Devuelve el TRAMO cuyo eje está más cerca de (lat,lng)
    window.nearestTramo = function (lat, lng) {
        if (!Object.keys(Rutas).length) return null;

        let bestTramo = null;
        let bestDist = Infinity;

        for (const tramoId of Object.keys(Rutas)) {
            const route = Rutas[tramoId];
            const pts = route.points;

            // Para velocidad, muestreamos cada N puntos (aquí cada 10)
            const step = Math.max(1, Math.floor(pts.length / 200)); // adaptativo
            for (let i = 0; i < pts.length; i += step) {
                const p = pts[i];
                const d = haversine(lat, lng, p.lat, p.lng);
                if (d < bestDist) {
                    bestDist = d;
                    bestTramo = tramoId;
                }
            }
        }

        return bestTramo;
    };

    // Distancia acumulada (m) desde el origen del TRAMO hasta el punto del eje
    // más cercano a (lat,lng)
    window.distanciaDesdeOrigenTramo = function (tramoId, lat, lng) {
        const route = Rutas[tramoId];
        if (!route) return null;

        const pts = route.points;
        let bestIdx = -1;
        let bestDist = Infinity;

        // Aquí recorremos todos; si fuese muy pesado se puede muestrear
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const d = haversine(lat, lng, p.lat, p.lng);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }

        if (bestIdx < 0) return null;
        return pts[bestIdx].dist; // metros desde el inicio del tramo
    };
})();
