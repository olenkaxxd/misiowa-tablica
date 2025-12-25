// ==================== FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyAU-m6n4AURX1VQL6BvKQKmA03WISQctgo",
  authDomain: "tablica-web.firebaseapp.com",
  databaseURL: "https://tablica-web-default-rtdb.firebaseio.com",
  projectId: "tablica-web"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const pagesRef = db.ref("pages");

// ==================== CANVAS ====================
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ==================== TOOLS ====================
let drawing = false;
let tool = "pen";
let penColor = "#000000";
let lastX = 0;
let lastY = 0;

// ==================== STRONY ====================
let pages = [{
  strokes: [],
  images: []
}];
let currentPage = 0;

// ==================== OBRAZY ====================
let currentImage = null;
let dragging = false;
let offsetX = 0;
let offsetY = 0;
let handleSize = 10;

// ==================== RYSOWANIE ====================
function drawLine(x1, y1, x2, y2, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  pages[currentPage].strokes.forEach(s =>
    drawLine(s.x1, s.y1, s.x2, s.y2, s.color, s.size)
  );

  pages[currentPage].images.forEach(img => {
    ctx.save();
    ctx.translate(img.x + img.width / 2, img.y + img.height / 2);
    ctx.rotate(img.rotation * Math.PI / 180);
    ctx.drawImage(
      img.img,
      -img.width / 2,
      -img.height / 2,
      img.width,
      img.height
    );

    if (img === currentImage) {
      ctx.strokeStyle = "red";
      ctx.strokeRect(
        -img.width / 2,
        -img.height / 2,
        img.width,
        img.height
      );
    }
    ctx.restore();
  });

  renderPages();
}

// ==================== MINIATURY ====================
function renderPages() {
  const container = document.getElementById("pages");
  container.innerHTML = "";

  pages.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "page-thumb" + (i === currentPage ? " active" : "");
    d.textContent = i + 1;
    d.onclick = () => {
      currentPage = i;
      currentImage = null;
      redraw();
    };
    container.appendChild(d);
  });
}

// ==================== MYSZ ====================
canvas.addEventListener("mousedown", e => {
  const mx = e.clientX;
  const my = e.clientY;

  currentImage = null;

  for (let img of [...pages[currentPage].images].reverse()) {
    if (
      mx > img.x &&
      mx < img.x + img.width &&
      my > img.y &&
      my < img.y + img.height
    ) {
      currentImage = img;
      dragging = true;
      offsetX = mx - img.x;
      offsetY = my - img.y;
      redraw();
      return;
    }
  }

  drawing = true;
  lastX = mx;
  lastY = my;
});

canvas.addEventListener("mousemove", e => {
  const mx = e.clientX;
  const my = e.clientY;

  if (dragging && currentImage) {
    if (e.shiftKey) {
      const cx = currentImage.x + currentImage.width / 2;
      const cy = currentImage.y + currentImage.height / 2;
      currentImage.rotation =
        Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
    } else {
      currentImage.x = mx - offsetX;
      currentImage.y = my - offsetY;
    }
    saveToFirebase();
    redraw();
    return;
  }

  if (!drawing) return;

  const stroke = {
    x1: lastX,
    y1: lastY,
    x2: mx,
    y2: my,
    color: tool === "eraser" ? "#ffffff" : penColor,
    size: tool === "eraser" ? 20 : 3
  };

  pages[currentPage].strokes.push(stroke);
  saveToFirebase();
  drawLine(...Object.values(stroke));

  lastX = mx;
  lastY = my;
});

window.addEventListener("mouseup", () => {
  drawing = false;
  dragging = false;
});

// ==================== DELETE ====================
window.addEventListener("keydown", e => {
  if (e.key === "Delete" && currentImage) {
    pages[currentPage].images =
      pages[currentPage].images.filter(i => i !== currentImage);
    currentImage = null;
    saveToFirebase();
    redraw();
  }
});

// ==================== PASTE IMAGE ====================
window.addEventListener("paste", e => {
  for (let item of e.clipboardData.items) {
    if (item.type.includes("image")) {
      const img = new Image();
      img.src = URL.createObjectURL(item.getAsFile());
      img.onload = () => {
        pages[currentPage].images.push({
          img,
          x: 100,
          y: 100,
          width: img.width / 2,
          height: img.height / 2,
          rotation: 0
        });
        saveToFirebase();
        redraw();
      };
    }
  }
});

// ==================== PRZYCISKI ====================
document.getElementById("clear").onclick = () => {
  pages[currentPage] = { strokes: [], images: [] };
  saveToFirebase();
  redraw();
};

document.getElementById("addPage").onclick = () => {
  pages.push({ strokes: [], images: [] });
  currentPage = pages.length - 1;
  saveToFirebase();
  redraw();
};

// ==================== PDF ====================
document.getElementById("save").onclick = () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape", "px", [
    canvas.width,
    canvas.height
  ]);

  pages.forEach((p, i) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    p.strokes.forEach(s =>
      drawLine(s.x1, s.y1, s.x2, s.y2, s.color, s.size)
    );
    p.images.forEach(img =>
      ctx.drawImage(img.img, img.x, img.y, img.width, img.height)
    );
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL(), "PNG", 0, 0);
  });

  pdf.save("Misiowa_Tablica.pdf");
};

// ==================== FIREBASE SYNC ====================
function saveToFirebase() {
  pagesRef.set(pages);
}

pagesRef.on("value", snap => {
  if (snap.exists()) {
    pages = snap.val();
    redraw();
  }
});

// ==================== INIT ====================
renderPages();
