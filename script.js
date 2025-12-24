// -------------------- Firebase --------------------
const firebaseConfig = {
  apiKey: "AIzaSyAU-m6n4AURX1VQL6BvKQKmA03WISQctgo",
  authDomain: "tablica-web.firebaseapp.com",
  databaseURL: "https://tablica-web-default-rtdb.firebaseio.com",
  projectId: "tablica-web"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const strokesRef = db.ref("strokes");

// -------------------- Canvas --------------------
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// -------------------- Toolbar --------------------
let drawing = false;
let tool = "pen";
let lastX = 0;
let lastY = 0;

const penBtn = document.getElementById("pen");
const eraserBtn = document.getElementById("eraser");
const clearBtn = document.getElementById("clear");
const saveBtn = document.getElementById("save");

penBtn.onclick = () => tool = "pen";
eraserBtn.onclick = () => tool = "eraser";

clearBtn.onclick = () => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  strokesRef.remove();
  images.length = 0;
};

// -------------------- Draw Helper --------------------
function drawLine(x1, y1, x2, y2, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
}

// -------------------- Image Handling --------------------
let images = [];
let currentImage = null;
let dragging = false;
let resizing = false;
let rotating = false;
let offsetX = 0;
let offsetY = 0;
let handleSize = 10;

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // rysowanie linii z Firebase
  strokesRef.once("value", snap => {
    snap.forEach(child => {
      const s = child.val();
      drawLine(s.x1, s.y1, s.x2, s.y2, s.color, s.size);
    });
  });

  // rysowanie obrazów
  images.forEach(imgObj => {
    ctx.save();
    ctx.translate(imgObj.x + imgObj.width/2, imgObj.y + imgObj.height/2);
    ctx.rotate(imgObj.rotation * Math.PI / 180);
    ctx.drawImage(imgObj.img, -imgObj.width/2, -imgObj.height/2, imgObj.width, imgObj.height);

    // uchwyty dla wybranego obrazu
    if (imgObj === currentImage) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(-imgObj.width/2, -imgObj.height/2, imgObj.width, imgObj.height);

      // róg do skalowania
      ctx.fillStyle = 'blue';
      ctx.fillRect(imgObj.width/2 - handleSize, imgObj.height/2 - handleSize, handleSize, handleSize);
    }

    ctx.restore();
  });
}

// -------------------- Mouse Events --------------------
canvas.addEventListener("mousedown", e => {
  const mx = e.clientX;
  const my = e.clientY;

  currentImage = null;

  for (let i = images.length-1; i>=0; i--) {
    const img = images[i];
    // prostokąt obrazu w obróconych współrzędnych
    const dx = mx - (img.x + img.width/2);
    const dy = my - (img.y + img.height/2);
    const angle = -img.rotation * Math.PI / 180;
    const rx = dx*Math.cos(angle) - dy*Math.sin(angle);
    const ry = dx*Math.sin(angle) + dy*Math.cos(angle);
    if (rx > -img.width/2 && rx < img.width/2 && ry > -img.height/2 && ry < img.height/2) {
      currentImage = img;

      // sprawdź czy kliknięto uchwyt do skalowania
      if (rx > img.width/2 - handleSize && ry > img.height/2 - handleSize) {
        resizing = true;
      } else {
        dragging = true;
        offsetX = dx;
        offsetY = dy;
      }
      redraw();
      return;
    }
  }

  // jeśli nie kliknięto obrazu -> rysowanie
  drawing = true;
  lastX = mx;
  lastY = my;
});

canvas.addEventListener("mousemove", e => {
  const mx = e.clientX;
  const my = e.clientY;

  if (resizing && currentImage) {
    currentImage.width = Math.max(10, mx - currentImage.x);
    currentImage.height = Math.max(10, my - currentImage.y);
    redraw();
    return;
  }

  if (dragging && currentImage) {
    currentImage.x = mx - offsetX - currentImage.width/2;
    currentImage.y = my - offsetY - currentImage.height/2;
    redraw();
    return;
  }

  if (!drawing) return;

  const stroke = {
    x1: lastX,
    y1: lastY,
    x2: mx,
    y2: my,
    color: tool === "eraser" ? "#ffffff" : "#000000",
    size: tool === "eraser" ? 20 : 3
  };

  drawLine(...Object.values(stroke));
  strokesRef.push(stroke);

  lastX = mx;
  lastY = my;
});

window.addEventListener("mouseup", () => {
  drawing = false;
  dragging = false;
  resizing = false;
});

// -------------------- Paste Image --------------------
window.addEventListener("paste", e => {
  const items = e.clipboardData.items;
  for (let i=0; i<items.length; i++) {
    if (items[i].type.indexOf("image") === -1) continue;
    const blob = items[i].getAsFile();
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const obj = { img, x: 100, y: 100, width: img.width/2, height: img.height/2, rotation: 0 };
      images.push(obj);
      redraw();
      URL.revokeObjectURL(url);
    };
    img.src = url;
    currentImage = images[images.length]; 
  }
});

// -------------------- Save do PDF --------------------
saveBtn.onclick = () => {
  const dataURL = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;  
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [canvas.width, canvas.height]
  });

  pdf.addImage(dataURL, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save("Misiowa_Tablica.pdf");
};
