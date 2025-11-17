const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnCapture = document.getElementById("btnCapture");
const statusEl = document.getElementById("status");
const hudText = document.getElementById("hud-text");
const toastEl = document.getElementById("toast");

let lat = null;
let lng = null;
let currentTramo = null;
let currentPR = null;   // { pr, metros } o null

// ---------------------------
// Utilidad: mostrar toast
// ---------------------------
function showToast(message) {
    if (!toastEl) {
        alert(message);
        return;
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    setTimeout(() => {
        toastEl.classList.remove("show");
    }, 2500);
}

// ---------------------------
// CÁMARA
// ---------------------------
async function initCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Este navegador no soporta cámara.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
}

// ---------------------------
// GEOLOCALIZACIÓN (Promise)
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
                console.log("Ubicación:", lat, lng);
                // Cada vez que tengamos ubicación, intentamos recalcular tramo/PR
                updatePRFromLocation();
                resolve();
            },
            err => {
                reject(err);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// ---------------------------
// Calcular tramo y PR con la ubicación actual
// ---------------------------
function updatePRFromLocation() {
    if (lat == null || lng == null) return;
    if (typeof nearestTramo !== "function" || typeof findPR !== "function") {
        // Aún no cargan los KML / PRs
        return;
    }

    const tramo = nearestTramo(lat, lng);
    if (!tramo) {
        currentTramo = null;
        currentPR = null;
        return;
    }

    currentTramo = tramo;

    // Por ahora seguimos con distancia = 0 (luego se puede cambiar a distancia real)
    const distancia = 0;
    currentPR = findPR(tramo, distancia);
}

// ---------------------------
// HUD en vivo (fecha/hora, coords, tramo, PR)
// ---------------------------
function updateHUD() {
    if (!hudText) return;

    const now = new Date();
    const fechaStr = now.toLocaleString();

    let lines = [`Fecha: ${fechaStr}`];

    if (lat != null && lng != null) {
        lines.push(`Lat: ${lat.toFixed(6)} Lng: ${lng.toFixed(6)}`);
    } else {
        lines.push("Ubicación: obteniendo…");
    }

    if (currentTramo) {
        const prStr = currentPR
            ? `${currentPR.pr}+${currentPR.metros}m`
            : "calculando…";
        lines.push(`Tramo: ${currentTramo}`);
        lines.push(`PR: ${prStr}`);
    } else {
        lines.push("Tramo/PR: calculando…");
    }

    hudText.textContent = lines.join(" | ");
}

// Actualizar HUD cada segundo
setInterval(updateHUD, 1000);

// ---------------------------
// AUTO-INICIO AL CARGAR
// ---------------------------
async function autoStart() {
    statusEl.textContent = "Solicitando permisos de cámara y ubicación...";

    try {
        await Promise.all([
            initCamera(),
            getLocationOnce()
        ]);

        btnCapture.disabled = false;
        statusEl.textContent = "Listo para capturar ✅";
    } catch (err) {
        console.error("Error en autoStart:", err);
        statusEl.textContent =
            "No se pudo activar automáticamente la cámara. Revisa los permisos del navegador o del sistema.";
    }
}

// Arrancamos cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    autoStart();
});

// ---------------------------
// CAPTURAR FOTO + PR + COMPARTIR
// ---------------------------
btnCapture.addEventListener("click", async () => {
    if (!lat || !lng) {
        alert("Todavía no tengo la ubicación. Espera unos segundos e inténtalo de nuevo.");
        return;
    }

    if (typeof nearestTramo !== "function" || typeof findPR !== "function") {
        alert("Datos de tramo/PR aún no cargados. Espera unos segundos.");
        return;
    }

    const tramo = currentTramo || nearestTramo(lat, lng) || "SIN TRAMO";

    const distancia = 0; // pendiente: sustituir por distancia real
    const prInfo = currentPR || findPR(tramo, distancia);

    const ctx = canvas.getContext("2d");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    canvas.width = w;
    canvas.height = h;

    // Dibujamos el frame actual del video
    ctx.drawImage(video, 0, 0, w, h);

    const fechaStr = new Date().toLocaleString();

    const textLines = [
        `Fecha: ${fechaStr}`,
        `Lat: ${lat.toFixed(6)}`,
        `Lng: ${lng.toFixed(6)}`,
        `Tramo: ${tramo}`,
        `PR: ${prInfo.pr}+${prInfo.metros}m`
    ];

    // Fondo semitransparente para el texto (similar al HUD)
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    const boxWidth = w * 0.8;
    const boxHeight = 150;
    ctx.fillRect(10, 10, boxWidth, boxHeight);

    ctx.fillStyle = "yellow";
    ctx.font = "24px Arial";
    let y = 40;
    for (const line of textLines) {
        ctx.fillText(line, 20, y);
        y += 28;
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
                // Aquí sabemos que el usuario cerró la hoja de compartir
                showToast("Foto enviada o guardada desde el sistema.");
            } catch (e) {
                console.error("Error al compartir:", e);
                showToast("Compartir cancelado.");
            }
        } else {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            showToast("Imagen generada. Puedes guardarla desde el visor.");
        }
    }, "image/jpeg");
});
