const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnCapture = document.getElementById("btnCapture");
const hudText = document.getElementById("hud-text");
const toastEl = document.getElementById("toast");

let lat = null;
let lng = null;
let currentTramo = null;
let currentPR = null;
let hudLines = []; // mismas líneas para HUD y para captura

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
        throw new Error("Este navegador no soporta acceso a la cámara.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
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
        const distancia = 0; // luego lo cambias por distancia real sobre la ruta
        currentPR = findPR(currentTramo, distancia);
    }
}

// ---------------------------
// Actualizar HUD en vivo (y hudLines)
// ---------------------------
function updateHUD() {
    const now = new Date();
    const fechaStr = now.toLocaleString();

    const lines = [];
    lines.push(`Fecha: ${fechaStr}`);

    if (lat != null && lng != null) {
        lines.push(`Lat: ${lat.toFixed(6)}`);
        lines.push(`Lng: ${lng.toFixed(6)}`);
    } else {
        lines.push("Ubicación: obteniendo…");
    }

    if (currentTramo) {
        const prStr = currentPR ? `${currentPR.pr}+${currentPR.metros}m` : "calculando…";
        lines.push(`Tramo: ${currentTramo}`);
        lines.push(`PR: ${prStr}`);
    } else {
        lines.push("Tramo/PR: calculando…");
    }

    hudLines = lines;                // 👈 mismas líneas para la captura
    hudText.innerHTML = lines.join("<br>");
}
setInterval(updateHUD, 1000);

// ---------------------------
// Auto-inicio
// ---------------------------
async function autoStart() {
    try {
        await Promise.all([
            initCamera(),
            getLocationOnce()
        ]);

        // Esperar a que el video tenga metadatos de tamaño
        await new Promise(resolve => {
            if (video.readyState >= 1 && video.videoWidth > 0) {
                resolve();
            } else {
                video.onloadedmetadata = () => resolve();
            }
        });

        btnCapture.disabled = false;
    } catch (err) {
        console.error("Error al iniciar:", err);
        showToast(err.message || "No se pudo activar la cámara o ubicación.");
    }
}

document.addEventListener("DOMContentLoaded", autoStart);

// ---------------------------
// TAP EN VIDEO: reintentar cámara si fuera necesario
// ---------------------------
video.addEventListener("click", async () => {
    if (video.videoWidth && video.videoHeight) {
        return; // ya está funcionando
    }

    try {
        await initCamera();
        await new Promise(resolve => {
            if (video.readyState >= 1 && video.videoWidth > 0) resolve();
            else video.onloadedmetadata = () => resolve();
        });
        btnCapture.disabled = false;
    } catch (err) {
        console.error("Error reintentando cámara:", err);
        showToast(err.message || "No se pudo activar la cámara.");
    }
});

// ---------------------------
// Capturar imagen con MISMO estilo que el HUD
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

    // Dibujar la imagen actual de la cámara
    ctx.drawImage(video, 0, 0, w, h);

    // Asegurarnos de que hudLines esté actualizado
    if (!hudLines || hudLines.length === 0) {
        const now = new Date();
        const fechaStr = now.toLocaleString();
        hudLines = [
            `Fecha: ${fechaStr}`,
            lat != null && lng != null ? `Lat: ${lat.toFixed(6)}` : "Ubicación no disponible",
            lat != null && lng != null ? `Lng: ${lng.toFixed(6)}` : "",
            `Tramo: ${tramo}`,
            `PR: ${prInfo.pr}+${prInfo.metros}m`
        ].filter(Boolean);
    }

    // MISMO estilo del HUD: barra negra multilínea en la parte inferior
    ctx.font = "12px Arial";
    const lineHeight = 16;
    const paddingY = 6;
    const paddingX = 8;

    const numLines = hudLines.length;
    const barHeight = numLines * lineHeight + paddingY * 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, h - barHeight, w, barHeight);

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";

    let y = h - barHeight + paddingY;
    for (const line of hudLines) {
        ctx.fillText(line, paddingX, y);
        y += lineHeight;
    }

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
