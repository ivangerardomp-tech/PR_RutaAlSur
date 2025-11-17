let SECCIONES = [];  // [{ tramo, coords: [ [lat,lng], ... ] }]

async function loadKML(url, tramoName) {
    const text = await fetch(url).then(r => r.text());
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");

    const coords = [...xml.getElementsByTagName("coordinates")];

    const puntos = coords.flatMap(c => {
        return c.textContent.trim().split(/\s+/).map(line => {
            const [lng, lat] = line.split(",").map(Number);
            return [lat, lng];
        });
    });

    SECCIONES.push({ tramo: tramoName, coords: puntos });
}

async function loadAllKML() {
    await loadKML("4505.kml", "4505");
    await loadKML("4503.kml", "4503");
    await loadKML("45HLB.kml", "45HLB");

    document.getElementById("status").textContent = "Listo ✓";
}

loadAllKML();
