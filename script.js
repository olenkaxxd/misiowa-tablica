// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyCAHhxEdW5LHUPrjocHQfRLJbgp5NqfPTg",
  authDomain: "misiowa-tablica.firebaseapp.com",
  databaseURL: "https://misiowa-tablica-default-rtdb.firebaseio.com",
  projectId: "misiowa-tablica",
  storageBucket: "misiowa-tablica.firebasestorage.app",
  messagingSenderId: "827288542078",
  appId: "1:827288542078:web:7ed3349add13c00713312f",
  measurementId: "G-K5JSQ1THVT"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const pagesRef = db.ref("pages");

// ================= FIREBASE =================
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const pagesRef = db.ref("pages");

// ================= SYNC CONTROL =================
let syncing = false;

// zapis do Firebase (bez pętli i lagów)
function saveToFirebase() {
  if (syncing) return;
  syncing = true;

  pagesRef
    .set(pages)
    .finally(() => {
      syncing = false;
    });
}

// ================= FIREBASE LISTENER =================
pagesRef.on("value", snap => {

  // 🔹 jeśli dane istnieją
  if (snap.exists()) {
    const data = snap.val();

    // 🔒 WALIDACJA DANYCH
    if (!Array.isArray(data) || data.length === 0) {
      pages = [{ strokes: [], images: [] }];
      currentPage = 0;
      saveToFirebase();
    } else {
      pages = data;

      // 🔒 zabezpieczenie aktualnej strony
      if (currentPage >= pages.length) {
        currentPage = 0;
      }
    }

  } 
  // 🔹 jeśli Firebase pusty (pierwsze wejście)
  else {
    pages = [{ strokes: [], images: [] }];
    currentPage = 0;
    saveToFirebase();
  }

  redraw(); // ⬅️ zawsze odśwież UI po synchronizacji
});


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
function undo() { if(historyIndex<=0) return; historyIndex--; pages[currentPage]=JSON.parse(JSON.stringify(history[historyIndex])); redraw(); saveToFirebase(); }
function redo() { if(historyIndex>=history.length-1) return; historyIndex++; pages[currentPage]=JSON.parse(JSON.stringify(history[historyIndex])); redraw(); saveToFirebase(); }

// ================= DRAW =================
function drawStroke(s){
  ctx.strokeStyle=s.color; ctx.lineWidth=s.size; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke();
}

function drawPage(page){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  page.strokes.forEach(drawStroke);
  page.images.forEach(img=>{
    ctx.save();
    ctx.translate(img.x+img.w/2,img.y+img.h/2);
    ctx.rotate(img.r);
    const i = new Image(); i.src = img.src;
    ctx.drawImage(i,-img.w/2,-img.h/2,img.w,img.h);
    if(img===currentImage){
      ctx.strokeStyle="red"; ctx.lineWidth=2; ctx.strokeRect(-img.w/2,-img.h/2,img.w,img.h);
      ctx.fillStyle="blue"; ctx.fillRect(img.w/2-10,img.h/2-10,10,10);
    }
    ctx.restore();
  });
}

function redraw(){
  if(!pages[currentPage]) return;
  drawPage(pages[currentPage]);
  renderPages();
}

// ================= MINIATURY =================
function renderPages(){
  const container = document.getElementById("pages");
  container.innerHTML = "";

  pages.forEach((page, index) => {
    const thumb = document.createElement("div");

    // numer strony ZAWSZE = index + 1
    thumb.className = "page-thumb";
    if (index === currentPage) thumb.classList.add("active");
    thumb.textContent = index + 1;

    // przełączanie strony
    thumb.onclick = () => {
      currentPage = index;
      currentImage = null;
      redraw();
    };

    // przycisk X (usuwanie)
    if (pages.length > 1) {
      const close = document.createElement("div");
      close.className = "close";
      close.textContent = "✕";

      close.onclick = (e) => {
        e.stopPropagation();

        pages.splice(index, 1);

        // korekta aktualnej strony
        if (currentPage >= pages.length) {
          currentPage = pages.length - 1;
        }
        if (currentPage < 0) currentPage = 0;

        redraw();
        saveToFirebase();
      };

      thumb.appendChild(close);
    }

    container.appendChild(thumb);
  });
}


// ================= MOUSE =================
canvas.onmousedown=e=>{
  const mx=e.clientX,my=e.clientY; currentImage=null; dragging=resizing=rotating=false;
  for(let img of [...pages[currentPage].images].reverse()){
    const cx=img.x+img.w/2,cy=img.y+img.h/2; const dx=mx-cx,dy=my-cy; const angle=-img.r;
    const rx=dx*Math.cos(angle)-dy*Math.sin(angle), ry=dx*Math.sin(angle)+dy*Math.cos(angle);
    if(rx>-img.w/2&&rx<img.w/2&&ry>-img.h/2&&ry<img.h/2){
      currentImage=img; offsetX=dx; offsetY=dy;
      if(rx>img.w/2-20 && ry>img.h/2-20) resizing=true;
      else if(e.shiftKey) rotating=true;
      else dragging=true;
      redraw(); return;
    }
  }
  drawing=true; lastX=mx; lastY=my;
};

canvas.onmousemove=e=>{
  const mx=e.clientX,my=e.clientY;
  if(dragging&&currentImage){ currentImage.x=mx-offsetX-currentImage.w/2; currentImage.y=my-offsetY-currentImage.h/2; redraw(); return; }
  if(resizing&&currentImage){ currentImage.w=Math.max(20,mx-currentImage.x); currentImage.h=Math.max(20,my-currentImage.y); redraw(); return; }
  if(rotating&&currentImage){ const cx=currentImage.x+currentImage.w/2,cy=currentImage.y+currentImage.h/2; currentImage.r=Math.atan2(my-cy,mx-cx); redraw(); return; }
  if(!drawing) return;
  const stroke={x1:lastX,y1:lastY,x2:mx,y2:my,color:tool==="eraser"?"#ffffff":penColor,size:tool==="eraser"?20:3};
  pages[currentPage].strokes.push(stroke); drawStroke(stroke); lastX=mx; lastY=my;
};

window.onmouseup=()=>{
  if(drawing || dragging || resizing || rotating){ saveHistory(); saveToFirebase(); }
  drawing=false; dragging=false; resizing=false; rotating=false;
};

// ================= PASTE IMAGE (FAST) =================
window.addEventListener("paste", e => {

  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (!item.type.startsWith("image")) continue;

    const file = item.getAsFile();
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {

      // 🔥 1. dodajemy LOKALNIE
      pages[currentPage].images.push({
        src: reader.result,
        x: 120,
        y: 120,
        w: 240,
        h: 180,
        r: 0
      });

      redraw();        // ⚡ natychmiast
      saveHistory();   // lokalne undo

      // 🔥 2. sync do Firebase z opóźnieniem
      setTimeout(saveToFirebase, 0);
    };

    reader.readAsDataURL(file);
    break; // tylko jeden obraz
  }
});

// ================= BUTTONS =================
pen.onclick=()=>{ tool="pen"; document.getElementById("colors").classList.toggle("active"); };
eraser.onclick=()=>{ tool="eraser"; document.getElementById("colors").classList.remove("active"); };
clear.onclick=()=>{ pages[currentPage]={strokes:[],images:[]}; redraw(); saveHistory(); saveToFirebase(); };
addPage.onclick = () => {
  pages.push({
    strokes: [],
    images: []
  });

  currentPage = pages.length - 1; // zawsze nowa = ostatnia
  redraw();
  saveToFirebase();
};
save.onclick=savePDF;
document.querySelectorAll("#colors span").forEach(c=>{ c.onclick=()=>{ penColor=c.dataset.color; tool="pen"; document.getElementById("colors").classList.remove("active"); }; });

// ================= PDF =================
function savePDF(){
  const { jsPDF }=window.jspdf;
  const pdf=new jsPDF("landscape","px",[canvas.width,canvas.height]);
  pages.forEach((p,i)=>{ drawPage(p); if(i>0) pdf.addPage(); pdf.addImage(canvas.toDataURL(),"PNG",0,0); });
  redraw();
  pdf.save("Misiowa_Tablica.pdf");
}





// ================= UNDO/REDO =================
window.addEventListener("keydown",e=>{ if(e.ctrlKey&&e.key==="z") undo(); if(e.ctrlKey&&e.key==="y") redo(); });
