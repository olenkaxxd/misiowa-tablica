// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAU-m6n4AURX1VQL6BvKQKmA03WISQctgo",
  authDomain: "tablica-web.firebaseapp.com",
  databaseURL: "https://tablica-web-default-rtdb.firebaseio.com",
  projectId: "tablica-web"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const strokesRef = db.ref("strokes");

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let tool = "pen";
let lastX = 0;
let lastY = 0;

// toolbar
pen.onclick = () => tool = "pen";
eraser.onclick = () => tool = "eraser";

clear.onclick = () => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  strokesRef.remove();
};

// draw helpers
function drawLine(x1, y1, x2, y2, color, size) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
}

// mouse events
canvas.addEventListener("mousedown", e => {
  drawing = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener("mousemove", e => {
  if (!drawing) return;

  const stroke = {
    x1: lastX,
    y1: lastY,
    x2: e.clientX,
    y2: e.clientY,
    color: tool === "eraser" ? "#ffffff" : "#000000",
    size: tool === "eraser" ? 20 : 3
  };

  drawLine(...Object.values(stroke));
  strokesRef.push(stroke);

  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener("mouseup", () => drawing = false);

// realtime listener
strokesRef.limitToLast(5000).on("child_added", snap => {
  const s = snap.val();
  drawLine(s.x1, s.y1, s.x2, s.y2, s.color, s.size);
});
