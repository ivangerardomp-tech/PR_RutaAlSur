const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnCapture = document.getElementById("btnCapture");
const statusEl = document.getElementById("status");
const hudText = document.getElementById("hud-text");
const toastEl = document.getElementById("toast");

let lat = null;
let lng = null;
let currentTramo = null;
let currentPR = null;

// ---------------------------
// Toast / notificación
// ---------------------------
function showToast(message) {
    if (!toastEl) {
        alert(message);
        return;
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2500);
}

// ---------------------------
// Activar cámara
// ---------------------------
async function initCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Este navegador no soporta cámara.");
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error getUserMedia:", err);
        throw err;
    }
}

// ---------------------------
// Ubicación
// ---------------------------
function getLocationOnce() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error("Geolocalización no soportada."));
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                updatePRFromLocation();
                resolve();
            },
            err => {
                console.error("Error geolocalización:", err);
                reject(err);
            },
            { enableHighAccuracy: true }
        );
    });
}

// ---------------------------
// Calcular tramo + PR
// ---------------------------
function updatePRFromLocation() {
    if (lat == null || lng == null) return;
    if (typeof nearestTramo !== "function") return;

    currentTramo = nearestTramo(lat, lng);

    if (!currentTramo) {
        currentPR = null;
        return;
    }

    if (typeof findPR === "function") {
        const distancia = 0; // luego se puede cambiar por distancia real
        currentPR = findPR(currentTramo, distancia);
    }
}

// ---------------------------
// Actualizar HUD en vivo
// ---------------------------
function updateHUD() {
    const now = new Date();
    const fechaStr = now.toLocaleString();

    let lines = [`Fecha: ${fechaStr}`];

    if (lat != null) {
        lines.push(`Lat: ${lat.toFixed(6)} Lng: ${lng.toFixed(6)}`);
    } else {
        lines.push("Ubicación: obteniendo…");
    }

    if (currentTramo) {
        let prStr = currentPR ? `${currentPR.pr}+${currentPR.metros}m` : "calculando…";
        lines.push(`Tramo: ${currentTramo}`);
        lines.push(`PR: ${prStr}`);
    } else {
        lines.push("Tramo/PR: calculando…");
    }

    hudText.textContent = lines.join(" | ");
}
setInterval(updateHUD, 1000);

// ---------------------------
// Auto-inicio
// ---------------------------
async function autoStart() {
    statusEl.textContent = "Solicitando permisos...";

    try {
        await Promise.all([
            initCamera(),
            getLocationOnce()
        ]);

        // Esperar metadatos del video (ancho/alto válidos)
        await new Promise(resolve => {
            if (video.readyState >= 1 && video.videoWidth > 0) {
                resolve();
            } else {
                video.onloadedmetadata = () => resolve();
            }
        });

        btnCapture.disabled = false;
        statusEl.textContent = "Cámara lista ✓";

    } catch (err) {
        console.error("Error en autoStart:", err);
        statusEl.textContent = "No se pudo activar la cámara. Revisa permisos.";
    }
}

document.addEventListener("DOMContentLoaded", autoStart);

// ---------------------------
// TAP EN VIDEO: reintentar cámara (especialmente PWA iOS)
// ---------------------------
video.addEventListener("click", async () => {
    try {
        statusEl.textContent = "Reintentando cámara...";
        await initCamera();
        await new Promise(resolve => {
            if (video.readyState >= 1 && video.videoWidth > 0) {
                resolve();
            } else {
                video.onloadedmetadata = () => resolve();
            }
        });
        statusEl.textContent = "Cámara activa ✓";
    } catch (err) {
        console.error("Error reintentando cámara:", err);
        statusEl.textContent = "No se pudo activar la cámara. Verifica permisos en Ajustes.";
    }
});

// ---------------------------
// Capturar imagen con MISMO estilo del HUD
// ---------------------------
btnCapture.addEventListener("click", async () => {
    if (!lat || !lng) {
        alert("Ubicación no disponible aún.");
        return;
    }

    if (typeof nearestTramo !== "function" || typeof findPR !== "function") {
        alert("Datos de tramo/PR aún no cargados. Espera unos segundos.");
        return;
    }

    const tramo = currentTramo || nearestTramo(lat, lng) || "SIN TRAMO";
    const distancia = 0;
    const prInfo = currentPR || findPR(tramo, distancia);

    const ctx = canvas.getContext("2d");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    canvas.width = w;
    canvas.height = h;

    // Dibujar frame actual
    ctx.drawImage(video, 0, 0, w, h);

    // 🔹 Usar EXACTAMENTE el mismo texto que el HUD
    const hudString = hudText.textContent || "";

    // Mismo estilo: barra negra semitransparente abajo, texto blanco pequeño
    ctx.font = "12px Arial";
    const paddingY = 6;
    const barHeight = 12 + paddingY * 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, h - barHeight, w, barHeight);

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";

    // Pequeño margen a la izquierda
    const textX = 8;
    const textY = h - barHeight / 2;
    ctx.fillText(hudString, textX, textY);

    canvas.toBlob(async blob => {
        if (!blob) {
            alert("No se pudo generar la imagen.");
            return;
        }

        const file = new File([blob], "foto_pr.jpg", { type: "image/jpeg" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "Foto PR",
                    text: "Foto con PR y coordenadas"
                });
                showToast("Foto guardada/enviada");
            } catch (e) {
                console.error("Error al compartir:", e);
                showToast("Compartir cancelado");
            }
        } else {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            showToast("Imagen generada");
        }
    }, "image/jpeg");
});
