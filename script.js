const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btn = document.getElementById("btnCapture");

let lat = null, lng = null;

async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });
        video.srcObject = stream;
    } catch (e) {
        alert("No se pudo activar la cámara");
    }
}

function getLocation() {
    navigator.geolocation.getCurrentPosition(pos => {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
    });
}

btn.addEventListener("click", async () => {
    if (!lat) {
        alert("Esperando ubicación…");
        return;
    }

    const tramo = nearestTramo(lat, lng);

    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0);

    const distancia = 0; // puedes calcular si tienes dist densificada
    const prInfo = findPR(tramo, distancia);

    const text = `
Fecha: ${new Date().toLocaleString()}
Lat: ${lat.toFixed(6)}
Lng: ${lng.toFixed(6)}
Tramo: ${tramo}
PR: ${prInfo.pr}+${prInfo.metros}m`;

    context.fillStyle = "yellow";
    context.font = "32px Arial";
    context.fillText(text, 20, 40);

    canvas.toBlob(async blob => {
        const file = new File([blob], "foto_pr.jpg", { type: "image/jpeg" });

        if (navigator.share) {
            await navigator.share({
                files: [file],
                title: "Foto PR",
                text: "Foto con PR y coordenadas"
            });
        } else {
            alert("Tu dispositivo no soporta compartir");
        }
    }, "image/jpeg");
});

initCamera();
getLocation();
