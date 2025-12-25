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
let penColor = "#000000";
let drawing = false;
let lastX = 0, lastY = 0;
let pages = [];
let currentPage = 0;

let currentImage = null;
let dragging = false, resizing = false, rotating = false;
let offsetX = 0, offsetY = 0;

// ================= UNDO / REDO =================
let history = [];
let historyIndex = -1;

function saveHistory() {
  // kopia głęboka strony
  const snapshot = JSON.parse(JSON.stringify(pages[currentPage]));
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);
  historyIndex++;
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  pages[currentPage] = JSON.parse(JSON.stringify(history[historyIndex]));
  save();
  redraw();
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  pages[currentPage] = JSON.parse(JSON.stringify(history[historyIndex]));
  save();
  redraw();
}

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
    ctx.save();
    ctx.translate(img.x + img.w/2, img.y + img.h/2);
    ctx.rotate(img.r);
    const i = new Image();
    i.src = img.src;
    ctx.drawImage(i, -img.w/2, -img.h/2, img.w, img.h);
    ctx.restore();
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
      currentImage = null;
      redraw();
    };

    if (pages.length > 1) {
      const x = document.createElement("div");
      x.className = "close";
      x.textContent = "✕";
      x.onclick = e => {
        e.stopPropagation();
        pages.splice(i,1);
        if(currentPage >= pages.length) currentPage--;
        save();
        redraw();
      };
      d.appendChild(x);
    }

    p.appendChild(d);
  });
}

// ================= MOUSE =================
canvas.onmousedown = e => {
  const mx = e.clientX, my = e.clientY;

  currentImage = null;
  resizing = rotating = false;

  // wybór obrazu od góry
  for (let img of [...pages[currentPage].images].reverse()) {
    // przelicz współrzędne dla rotacji
    const cx = img.x + img.w/2;
    const cy = img.y + img.h/2;
    const dx = mx - cx;
    const dy = my - cy;
    const angle = -img.r;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

    if (rx > -img.w/2 && rx < img.w/2 && ry > -img.h/2 && ry < img.h/2) {
      currentImage = img;
      offsetX = dx;
      offsetY = dy;

      // check róg skalowania
      if(rx > img.w/2 - 20 && ry > img.h/2 - 20) resizing = true;
      else if(e.shiftKey) rotating = true;
      else dragging = true;

      redraw();
      return;
    }
  }

  // jeśli nie obraz → rysowanie
  drawing = true;
  lastX = mx; lastY = my;
};

canvas.onmousemove = e => {
  const mx = e.clientX, my = e.clientY;
  if(dragging && currentImage){
    currentImage.x = mx - offsetX - currentImage.w/2;
    currentImage.y = my - offsetY - currentImage.h/2;
    save();
    redraw();
    return;
  }
  if(resizing && currentImage){
    currentImage.w = Math.max(20, mx - currentImage.x);
    currentImage.h = Math.max(20, my - currentImage.y);
    save();
    redraw();
    return;
  }
  if(rotating && currentImage){
    const cx = currentImage.x + currentImage.w/2;
    const cy = currentImage.y + currentImage.h/2;
    currentImage.r = Math.atan2(my-cy, mx-cx);
    save();
    redraw();
    return;
  }

  if(!drawing) return;
  const stroke = {
    x1:lastX, y1:lastY, x2:mx, y2:my,
    color: tool==="eraser"?"#ffffff":penColor,
    size: tool==="eraser"?20:3
  };
  pages[currentPage].strokes.push(stroke);
  saveHistory();
  save();
  drawStroke(stroke);
  lastX = mx; lastY = my;
};

window.onmouseup = () => { drawing=false; dragging=false; resizing=false; rotating=false; };

// ================= PASTE IMAGE =================
window.addEventListener("paste", e=>{
  [...e.clipboardData.items].forEach(item=>{
    if(item.type.startsWith("image")){
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = () => {
        pages[currentPage].images.push({src: reader.result,x:100,y:100,w:200,h:150,r:0});
        saveHistory(); save(); redraw();
      };
      reader.readAsDataURL(file);
    }
  });
});

// ================= BUTTONS =================
pen.onclick = () => tool="pen";
eraser.onclick = () => tool="eraser";
clear.onclick = ()=>{pages[currentPage]={strokes:[],images:[]}; saveHistory(); save(); redraw();};
addPage.onclick = ()=>{pages.push({strokes:[],images:[]}); currentPage=pages.length-1; saveHistory(); save(); redraw();};

// ================= COLORS =================
document.querySelectorAll("#colors span").forEach(c=>{
  c.onclick=()=>{
    penColor=c.dataset.color; tool="pen";
  }
});

// ================= PDF =================
save.onclick=()=>{
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
function save(){ pagesRef.set(pages); }

pagesRef.on("value", snap=>{
  if(snap.exists()){ pages=snap.val(); if(!pages[currentPage])currentPage=0; redraw(); }
  else { pages=[{strokes:[],images:[]}]; save(); }
});

// ================= UNDO/REDO =================
window.addEventListener("keydown", e=>{
  if(e.ctrlKey && e.key==="z"){ undo(); }
  if(e.ctrlKey && e.key==="y"){ redo(); }
});
