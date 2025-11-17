// pr_finder.js

(function () {
  const tramoToPR = {}; // TRAMO -> { dists: [], prs: [] }

  // Parsear números con separador de coma
  function parseNumber(str) {
    if (str == null) return NaN;
    return Number(String(str).trim().replace(",", "."));
  }

  // Cargar PRs desde el archivo CSV
  async function loadPRs() {
    try {
      const resp = await fetch("PRs.csv");
      if (!resp.ok) {
        console.error("No se pudo cargar PRs.csv", resp.status);
        return;
      }

      const text = await resp.text();
      const lines = text.trim().split(/\r?\n/);
      if (!lines.length) return;

      const header = lines[0].split(",");
      const idxTramo = header.indexOf("TRAMO");
      const idxPR = header.indexOf("PR");
      const idxDist = header.indexOf("DISTANCIA");

      if (idxTramo === -1 || idxPR === -1 || idxDist === -1) {
        console.error(
          "PRs.csv no tiene columnas esperadas: TRAMO, PR, DISTANCIA"
        );
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(",");
        if (cols.length < header.length) continue;

        const tramo = String(cols[idxTramo]).trim();
        const pr = String(cols[idxPR]).trim();
        const dist = parseNumber(cols[idxDist]);
        if (!tramo || !pr || !isFinite(dist)) continue;

        if (!tramoToPR[tramo]) tramoToPR[tramo] = [];
        tramoToPR[tramo].push({ dist, pr });
      }

      // Ordenar por distancia y convertir a arrays
      for (const tramo of Object.keys(tramoToPR)) {
        const arr = tramoToPR[tramo].sort((a, b) => a.dist - b.dist);
        tramoToPR[tramo] = {
          dists: arr.map((x) => x.dist),
          prs: arr.map((x) => x.pr),
        };
      }

      console.log(
        "PRs cargados para tramos:",
        Object.keys(tramoToPR),
        " (total filas:",
        lines.length - 1,
        ")"
      );
    } catch (e) {
      console.error("Error cargando PRs.csv:", e);
    }
  }

  // Función para buscar el PR correspondiente dado el tramo y la distancia
  // - Busca el mayor DISTANCIA <= distancia_objetivo para el TRAMO dado.
  // - Devuelve ese PR y los metros = objetivo - DISTANCIA_PR.
  function findPR(tramo, distanciaM) {
    const data = tramoToPR[tramo];
    if (!data || !data.dists.length || !isFinite(distanciaM)) {
      return { pr: "?", metros: 0 };
    }

    const dists = data.dists;
    const prs = data.prs;

    // Búsqueda binaria para obtener el PR correspondiente
    let lo = 0;
    let hi = dists.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dists[mid] <= distanciaM) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    let idx = lo - 1; // Mayor DISTANCIA <= distanciaM
    if (idx < 0) idx = 0;

    const baseDist = dists[idx];
    let metros = Math.round(distanciaM - baseDist);
    if (metros < 0) metros = 0; // Por si la distancia cae antes del primer PR

    return { pr: prs[idx], metros };
  }

  window.findPR = findPR;
  window.prsReady = loadPRs().catch((e) =>
    console.error("Error en carga PRs:", e)
  );
})();
