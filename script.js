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

// ================= STATE =================
let tool = "pen";
let penColor = "#000";
let drawing = false;
let lastX = 0, lastY = 0;
let pages = [];
let currentPage = 0;

// ================= DRAW =================
function drawStroke(s) {
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  ctx.lineTo(s.x2, s.y2);
  ctx.stroke();
}

function drawPage(page) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  page.strokes.forEach(drawStroke);

  page.images.forEach(img => {
    const i = new Image();
    i.src = img.src;
    ctx.drawImage(i, img.x, img.y, img.w, img.h);
  });
}

function redraw() {
  if (!pages[currentPage]) return;
  drawPage(pages[currentPage]);
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
      redraw();
    };

    if (pages.length > 1) {
      const x = document.createElement("div");
      x.className = "close";
      x.textContent = "✕";
      x.onclick = e => {
        e.stopPropagation();
        pages.splice(i,1);
        if (currentPage >= pages.length) currentPage--;
        save();
      };
      d.appendChild(x);
    }

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
      x1: lastX, y1: lastY,
      x2: e.clientX, y2: e.clientY,
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
  [...e.clipboardData.items].forEach(item => {
    if (item.type.startsWith("image")) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = () => {
        pages[currentPage].images.push({
          src: reader.result,
          x: 100, y: 100, w: 200, h: 150
        });
        save();
      };
      reader.readAsDataURL(file);
    }
  });
});

// ================= BUTTONS =================
pen.onclick = () => tool = "pen";
eraser.onclick = () => tool = "eraser";

clear.onclick = () => {
  pages[currentPage] = { strokes: [], images: [] };
  save();
};

addPage.onclick = () => {
  pages.push({ strokes: [], images: [] });
  currentPage = pages.length - 1;
  save();
};

// ================= PDF =================
save.onclick = () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape","px",[canvas.width,canvas.height]);

  pages.forEach((p,i)=>{
    drawPage(p);
    if(i>0) pdf.addPage();
    pdf.addImage(canvas.toDataURL(),"PNG",0,0);
  });

  redraw();
  pdf.save("Misiowa_Tablica.pdf");
};

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
