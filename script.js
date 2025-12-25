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
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ================= STATE =================
let tool = "pen";
let penColor = "#000000";
let drawing = false;
let lastX = 0, lastY = 0;
let pages = [];
let currentPage = 0;

// ================= IMAGE STATE =================
let currentImage = null;
let dragging = false, resizing = false, rotating = false;
let offsetX = 0, offsetY = 0;

// ================= UNDO / REDO =================
let history = [];
let historyIndex = -1;

function saveHistory() {
  const snapshot = JSON.parse(JSON.stringify(pages[currentPage]));
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);
  historyIndex++;
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  pages[currentPage] = JSON.parse(JSON.stringify(history[historyIndex]));
  redraw();
  saveToFirebase();
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  pages[currentPage] = JSON.parse(JSON.stringify(history[historyIndex]));
  redraw();
  saveToFirebase();
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // rysowanie linii
  page.strokes.forEach(drawStroke);

  // rysowanie obrazów
  page.images.forEach(img => {
    ctx.save();
    ctx.translate(img.x + img.w/2, img.y + img.h/2);
    ctx.rotate(img.r);
    const i = new Image();
    i.src = img.src;
    ctx.drawImage(i, -img.w/2, -img.h/2, img.w, img.h);

    // zaznaczenie aktualnego obrazu
    if (img === currentImage) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(-img.w/2, -img.h/2, img.w, img.h);
      ctx.fillStyle = "blue";
      ctx.fillRect(img.w/2-10, img.h/2-10, 10, 10);
    }
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
  const container = document.getElementById("pages");
  container.innerHTML = "";

  pages.forEach((_, i) => {
    const thumb = document.createElement("div");
    thumb.className = "page-thumb" + (i === currentPage ? " active" : "");
    thumb.textContent = i + 1;

    thumb.onclick = () => {
      currentPage = i;
      currentImage = null;
      redraw();
    };

    if (pages.length > 1) {
      const close = document.createElement("div");
      close.className = "close";
      close.textContent = "✕";
      close.onclick = e => {
        e.stopPropagation();
        pages.splice(i,1);
        if(currentPage >= pages.length) currentPage--;
        redraw();
        saveToFirebase();
      };
      thumb.appendChild(close);
    }

    container.appendChild(thumb);
  });
}

// ================= MOUSE =================
canvas.onmousedown = e => {
  const mx = e.clientX, my = e.clientY;
  currentImage = null;
  dragging = resizing = rotating = false;

  // wybór obrazu
  for (let img of [...pages[currentPage].images].reverse()) {
    const cx = img.x + img.w/2;
    const cy = img.y + img.h/2;
    const dx = mx - cx;
    const dy = my - cy;
    const angle = -img.r;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

    if(rx > -img.w/2 && rx < img.w/2 && ry > -img.h/2 && ry < img.h/2){
      currentImage = img;
      offsetX = dx;
      offsetY = dy;

      if(rx > img.w/2 - 20 && ry > img.h/2 - 20) resizing = true;
      else if(e.shiftKey) rotating = true;
      else dragging = true;

      redraw();
      return;
    }
  }

  // rysowanie
  drawing = true;
  lastX = mx; lastY = my;
};

canvas.onmousemove = e => {
  const mx = e.clientX, my = e.clientY;

  if(dragging && currentImage){
    currentImage.x = mx - offsetX - currentImage.w/2;
    currentImage.y = my - offsetY - currentImage.h/2;
    redraw();
    saveToFirebase();
    return;
  }
  if(resizing && currentImage){
    currentImage.w = Math.max(20, mx - currentImage.x);
    currentImage.h = Math.max(20, my - currentImage.y);
    redraw();
    saveToFirebase();
    return;
  }
  if(rotating && currentImage){
    const cx = currentImage.x + currentImage.w/2;
    const cy = currentImage.y + currentImage.h/2;
    currentImage.r = Math.atan2(my-cy, mx-cx);
    redraw();
    saveToFirebase();
    return;
  }

  if(!drawing) return;
  const stroke = {
    x1: lastX, y1: lastY, x2: mx, y2: my,
    color: tool==="eraser"?"#ffffff":penColor,
    size: tool==="eraser"?20:3
  };
  pages[currentPage].strokes.push(stroke);
  drawStroke(stroke);
  lastX = mx; lastY = my;
};

window.onmouseup = () => { drawing=false; dragging=false; resizing=false; rotating=false; saveHistory(); saveToFirebase(); };

// ================= PASTE IMAGE =================
window.addEventListener("paste", e => {
  [...e.clipboardData.items].forEach(item => {
    if(item.type.startsWith("image")){
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = () => {
        pages[currentPage].images.push({src: reader.result,x:100,y:100,w:200,h:150,r:0});
        redraw();
        saveHistory(); saveToFirebase();
      };
      reader.readAsDataURL(file);
    }
  });
});

// ================= BUTTONS =================
pen.onclick = () => { tool="pen"; document.getElementById("colors").classList.toggle("active"); };
eraser.onclick = () => { tool="eraser"; document.getElementById("colors").classList.remove("active"); };
clear.onclick = ()=>{ pages[currentPage]={strokes:[],images:[]}; redraw(); saveHistory(); saveToFirebase(); };
addPage.onclick = ()=>{ pages.push({strokes:[],images:[]}); currentPage=pages.length-1; redraw(); saveHistory(); saveToFirebase(); };
save.onclick = savePDF;
document.querySelectorAll("#colors span").forEach(c=>{ c.onclick=()=>{ penColor=c.dataset.color; tool="pen"; document.getElementById("colors").classList.remove("active"); }; });

// ================= PDF =================
function savePDF(){
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("landscape","px",[canvas.width,canvas.height]);
  pages.forEach((p,i)=>{
    drawPage(p);
    if(i>0) pdf.addPage();
    pdf.addImage(canvas.toDataURL(),"PNG",0,0);
  });
  redraw();
  pdf.save("Misiowa_Tablica.pdf");
}

// ================= FIREBASE =================
function saveToFirebase(){ pagesRef.set(pages); }
pagesRef.on("value", snap => {
  if(snap.exists()){
    pages = snap.val();
    if(!pages[currentPage]) currentPage=0;
    redraw();
  } else {
    pages = [{strokes:[],images:[]}];
    saveToFirebase();
  }
});

// ================= UNDO/REDO =================
window.addEventListener("keydown", e => {
  if(e.ctrlKey && e.key==="z"){ undo(); }
  if(e.ctrlKey && e.key==="y"){ redo(); }
});
