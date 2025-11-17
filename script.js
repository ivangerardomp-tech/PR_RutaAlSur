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
    toastEl.textContent = message;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2500);
}

// ---------------------------
// Activar cámara
// ---------------------------
async function initCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
}

// ---------------------------
// Ubicación
// ---------------------------
function getLocationOnce() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            pos => {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                updatePRFromLocation();
                resolve();
            },
            err => reject(err),
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
        const distancia = 0; // se puede reemplazar luego por distancia real
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

    if (lat != null) lines.push(`Lat: ${lat.toFixed(6)} Lng: ${lng.toFixed(6)}`);
    else lines.push("Ubicación: obteniendo…");

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

        // Esperar metadatos del video
        await new Promise(resolve => {
            if (video.readyState >= 1 && video.videoWidth > 0) resolve();
            else video.onloadedmetadata = () => resolve();
        });

        btnCapture.disabled = false;
        statusEl.textContent = "Cámara lista ✓";

    } catch (err) {
        console.error("Error:", err);
        statusEl.textContent = "No se pudo activar la cámara. Revisa permisos.";
    }
}

document.addEventListener("DOMContentLoaded", autoStart);

// ---------------------------
// Fallback para PWA iOS (tocar video si está negro)
// ---------------------------
video.addEventListener("click", async () => {
    if (!video.videoWidth || !video.videoHeight) {
        try {
            await initCamera();
            await new Promise(resolve => {
                if (video.readyState >= 1 && video.videoWidth > 0) resolve();
                else video.onloadedmetadata = () => resolve();
            });
            statusEl.textContent = "Cámara activa ✓";
        } catch (e) {
            console.error(e);
        }
    }
});

// ---------------------------
// Capturar imagen con texto ABAJO
// ---------------------------
btnCapture.addEventListener("click", async () => {
    if (!lat || !lng) {
        alert("Ubicación no disponible aún.");
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

    ctx.drawImage(video, 0, 0, w, h);

    const fechaStr = new Date().toLocaleString();
    const textLines = [
        `Fecha: ${fechaStr}`,
        `Lat: ${lat.toFixed(6)}`,
        `Lng: ${lng.toFixed(6)}`,
        `Tramo: ${tramo}`,
        `PR: ${prInfo.pr}+${prInfo.metros}m`
    ];

    ctx.font = "24px Arial";
    const lineHeight = 28;
    const margin = 18;
    const totalTextHeight = lineHeight * textLines.length;

    const boxPaddingX = 10;
    const boxPaddingY = 8;
    const boxWidth = w * 0.9;
    const boxHeight = totalTextHeight + boxPaddingY * 2;

    const boxX = (w - boxWidth) / 2;
    const boxY = h - margin - boxHeight;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = "yellow";
    let y = boxY + boxPaddingY + lineHeight;
    const textX = boxX + boxPaddingX;
    for (const line of textLines) {
        ctx.fillText(line, textX, y);
        y += lineHeight;
    }

    canvas.toBlob(async blob => {
        if (!blob) return alert("No se pudo generar la imagen.");

        const file = new File([blob], "foto_pr.jpg", { type: "image/jpeg" });

        if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "Foto PR",
                    text: "Foto con PR y coordenadas"
                });
                showToast("Foto guardada/enviada");
            } catch {
                showToast("Compartir cancelado");
            }
        } else {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            showToast("Imagen generada");
        }
    }, "image/jpeg");
});
