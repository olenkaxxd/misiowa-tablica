// ================= FIREBASE =================
firebase.initializeApp({
  apiKey: "AIzaSyAU-m6n4AURX1VQL6BvKQKmA03WISQctgo",
  authDomain: "tablica-web.firebaseapp.com",
  databaseURL: "https://tablica-web-default-rtdb.firebaseio.com",
  projectId: "tablica-web"
});

const db = firebase.database();
const pagesRef = db.ref("pages");

// ================= CANVAS =================
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

// ================= TOOLS =================
let tool = "pen";
let penColor = "#000000";
let drawing = false;
let lastX = 0;
let lastY = 0;

// ================= STRONY =================
let pages = [];
let currentPage = 0;

// ================= IMAGES =================
let currentImage = null;
let dragging = false;
let offsetX = 0;
let offsetY = 0;

// ================= DRAW =================
function drawLine(s) {
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  ctx.lineTo(s.x2, s.y2);
  ctx.stroke();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  pages[currentPage]?.strokes.forEach(drawLine);

  pages[currentPage]?.images.forEach(img => {
    ctx.save();
    ctx.translate(img.x + img.w / 2, img.y + img.h / 2);
    ctx.rotate(img.r);
    ctx.drawImage(img.img, -img.w / 2, -img.h / 2, img.w, img.h);
    ctx.restore();
  });

  renderPages();
}

// ================= MINIATURY =================
function renderPages() {
  const p = document.getElementById("pages");
  p.innerHTML = "";

  pages.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "page-thumb" + (i === currentPage ? " active" : "");
    d.textContent = i + 1;
    d.onclick = () => {
      currentPage = i;
      currentImage = null;
      redraw();
    };
    p.appendChild(d);
  });
}

// ================= MOUSE =================
canvas.onmousedown = e => {
  drawing = true;
  lastX = e.clientX;
  lastY = e.clientY;
};

canvas.onmousemove = e => {
  if (!drawing) return;

  if (tool === "eraser") {
    pages[currentPage].strokes = pages[currentPage].strokes.filter(s =>
      Math.hypot(s.x2 - e.clientX, s.y2 - e.clientY) > 20
    );
  } else {
    pages[currentPage].strokes.push({
      x1: lastX,
      y1: lastY,
      x2: e.clientX,
      y2: e.clientY,
      color: penColor,
      size: 3
    });
  }

  lastX = e.clientX;
  lastY = e.clientY;
  save();
  redraw();
};

window.onmouseup = () => drawing = false;

// ================= PASTE IMAGE =================
window.addEventListener("paste", e => {
  e.preventDefault();
  [...e.clipboardData.items].forEach(item => {
    if (item.type.startsWith("image")) {
      const img = new Image();
      img.src = URL.createObjectURL(item.getAsFile());
      img.onload = () => {
        pages[currentPage].images.push({
          img, x: 100, y: 100,
          w: img.width / 2,
          h: img.height / 2,
          r: 0
        });
        save();
        redraw();
      };
    }
  });
});

// ================= BUTTONS =================
pen.onclick = () => tool = "pen";
eraser.onclick = () => tool = "eraser";

clear.onclick = () => {
  pages[currentPage] = { strokes: [], images: [] };
  save();
  redraw();
};

addPage.onclick = () => {
  pages.push({ strokes: [], images: [] });
  currentPage = pages.length - 1;
  save();
  redraw();
};

// ================= COLORS =================
document.querySelectorAll("#colors span").forEach(c => {
  c.onclick = () => {
    penColor = c.dataset.color;
    tool = "pen";
  };
});

// ================= FIREBASE =================
function save() {
  pagesRef.set(pages);
}

pagesRef.on("value", snap => {
  if (snap.exists()) {
    pages = snap.val();
    if (!pages[currentPage]) currentPage = 0;
    redraw();
  } else {
    pages = [{ strokes: [], images: [] }];
    save();
  }
});
