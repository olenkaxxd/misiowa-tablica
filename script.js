// ---------------- Firebase ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAU-m6n4AURX1VQL6BvKQKmA03WISQctgo",
  authDomain: "tablica-web.firebaseapp.com",
  databaseURL: "https://tablica-web-default-rtdb.firebaseio.com",
  projectId: "tablica-web"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const board = document.getElementById("board");
const ref = db.ref("tablica/content");

// zapis
board.addEventListener("input", () => {
  ref.set(board.value);
});

// realtime odczyt
ref.on("value", snapshot => {
  const val = snapshot.val();
  if (val !== null && board.value !== val) {
    board.value = val;
  }
});
