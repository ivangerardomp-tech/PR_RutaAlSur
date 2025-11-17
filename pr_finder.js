let PR_TABLE = [];

async function loadPRs() {
    const text = await fetch("PRs.csv").then(r => r.text());
    const lines = text.split("\n");

    lines.slice(1).forEach(row => {
        let [tramo, dist, pr] = row.split(",");
        if (!tramo) return;
        PR_TABLE.push({
            tramo: tramo.trim(),
            dist: parseFloat(dist),
            pr: pr.trim()
        });
    });
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat/2)**2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon/2)**2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestTramo(lat, lng) {
    let best = null;
    let bestDist = 9999999;

    for (const sec of SECCIONES) {
        sec.coords.forEach(pt => {
            const d = haversine(lat, lng, pt[0], pt[1]);
            if (d < bestDist) {
                bestDist = d;
                best = sec.tramo;
            }
        });
    }
    return best;
}

function findPR(tramo, distancia) {
    let matches = PR_TABLE.filter(r => r.tramo === tramo);
    matches.sort((a,b) => a.dist - b.dist);

    let last = matches[0];
    for (const row of matches) {
        if (row.dist <= distancia) last = row;
        else break;
    }

    return {
        pr: last.pr,
        metros: Math.round(distancia - last.dist)
    };
}

loadPRs();
