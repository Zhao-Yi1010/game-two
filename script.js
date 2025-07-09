// ✅ 初始化 Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, remove, set, onValue, get
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB959RW8D1XI-yQDiJWgWXUvrbdHyMZZNk",
  authDomain: "game-two-c0d5b.firebaseapp.com",
  databaseURL: "https://game-two-c0d5b-default-rtdb.firebaseio.com",
  projectId: "game-two-c0d5b",
  storageBucket: "game-two-c0d5b.firebasestorage.app",
  messagingSenderId: "874203719531",
  appId: "1:874203719531:web:05bee1c0d8b9a3df904e2e"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let playerRole = "null";
let playerName = "";

async function assignPlayerRole() {
  const snapshot = await get(ref(db, "players"));
  const players = snapshot.val() || {};
  const names = Object.keys(players);
  if (!names.includes("player1")) {
    playerRole = "player1";
    await set(ref(db, "players/player1"), { online: true });
  } else if (!names.includes("player2")) {
    playerRole = "player2";
    await set(ref(db, "players/player2"), { online: true });
  } else {
    playerRole = "observer";
  }
  startHeartbeat();
}

function startHeartbeat() {
  setInterval(() => {
    if (playerRole === "player1" || playerRole === "player2") {
      set(ref(db, `players/${playerRole}/lastSeen`), Date.now());
    }
  }, 5000);
}

setInterval(async () => {
  const snapshot = await get(ref(db, "players"));
  const players = snapshot.val() || {};
  const now = Date.now();
  for (const role in players) {
    const lastSeen = players[role]?.lastSeen || 0;
    if (now - lastSeen > 15000) {
      await remove(ref(db, `players/${role}`));
      console.log(`🧹 已移除離線玩家 ${role}`);
    }
  }
}, 7000);

const taskList = [
  "一起畫兩樣水果",
  "一起畫一棵會開花的樹",
  "一起畫健康的早餐",
  "一起畫天空裡的東西",
];

const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.globalAlpha = 0.4;
ctx.globalCompositeOperation = "multiply";

const dot = document.getElementById("cursorDot");
const finishBtn = document.getElementById("finishBtn");
finishBtn.addEventListener("click", () => {
  speak("任務完成！太棒了！");
  document.getElementById("prompt").textContent = "🎉 任務完成！太棒了 🎉";
  saveSnapshot("任務完成");
});

let penSize = 5;
let playerColor = "#FF0000";
document.querySelectorAll(".colorBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    playerColor = btn.dataset.color;

    // 顏色代碼對照中文名稱
    const colorNames = {
      "#FF0000": "紅色",
      "#FF8000": "橘色",
      "#FFFF00": "黃色",
      "#00FF00": "綠色",
      "#0000FF": "藍色",
      "#8000FF": "紫色",
      "#FF99CC": "粉紅色",
      "#000000": "黑色",
      "#FFFFFF": "白色"
    };

   const name = colorNames[playerColor] || "這個顏色";
   speak(`你選擇的是 ${name}`);
  });
});
document.getElementById("clearBtn").addEventListener("click", () => {
  saveSnapshot("清除前");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  remove(ref(db, "drawings"));
  speak("畫布清乾淨了！");
});

let drawing = false, lastX = 0, lastY = 0;
const videoElement = document.getElementById("webcam");
const hands = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
hands.onResults(results => {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    dot.style.display = "none";
    drawing = false;
    return;
  }
  const indexTip = results.multiHandLandmarks[0][8];
  const indexBase = results.multiHandLandmarks[0][6];
  const isFist = indexTip.y > indexBase.y;
  const x = (1 - indexTip.x) * canvas.width;
  const y = indexTip.y * canvas.height;
  dot.style.left = `${x - 10}px`;
  dot.style.top = `${y - 10}px`;
  dot.style.display = "block";

  if (playerRole !== "player1" && playerRole !== "player2") return;

  if (isFist) {
    if (!drawing) { drawing = true; lastX = x; lastY = y; }
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y);
    ctx.strokeStyle = playerColor; ctx.lineWidth = penSize; ctx.stroke();
    push(ref(db, "drawings"), { x1: lastX, y1: lastY, x2: x, y2: y, color: playerColor, size: penSize, timestamp: Date.now() });
    lastX = x; lastY = y;
  } else {
    drawing = false;
  }
});

new Camera(videoElement, { onFrame: async () => { await hands.send({ image: videoElement }); }, width: 640, height: 480 }).start();

onChildAdded(ref(db, "drawings"), snapshot => {
  const line = snapshot.val();
  ctx.beginPath(); ctx.moveTo(line.x1, line.y1); ctx.lineTo(line.x2, line.y2);
  ctx.strokeStyle = line.color; ctx.lineWidth = line.size; ctx.stroke();
});

onValue(ref(db, "gameState"), (snapshot) => {
  const state = snapshot.val();
  const prompt = document.getElementById("prompt");
  if (!prompt || !state) return;
  prompt.textContent = `任務：${state.answer}`;
  speak(`我們的任務是：${state.answer}`);
});
let isExplaining = true; // ✅ 新增變數來避免語音辨識干擾
window.addEventListener("load", async () => {
  playerName = prompt("請輸入你的名字或暱稱：") || "未命名";
  await assignPlayerRole();
  speak(`你好 ${playerName}`);

  const modal = document.getElementById("howToPlay");
  const startBtn = document.getElementById("startBtn");

  modal.style.display = "flex";
  speak("歡迎來到合作任務畫畫遊戲，接下來請聽玩法說明。請用手對準鏡頭畫圖。畫好記得按完成喔！");

  startBtn.addEventListener("click", () => {
    modal.style.display = "none";
    isExplaining = false;
    startCountdown();
  });

  window.addEventListener("beforeunload", () => {
    if (playerRole === "player1" || playerRole === "player2") {
      remove(ref(db, `players/${playerRole}`));
    }
  });

  const playersSnapshot = await get(ref(db, "players"));
  const players = playersSnapshot.val() || {};
  const stillPlaying = Object.keys(players).filter(name => name !== playerRole);

  if (stillPlaying.length === 0) {
    await remove(ref(db, "gameState"));
    await remove(ref(db, "drawings"));
    nextRound();
  }
});

function nextRound() {
  const newAnswer = taskList[Math.floor(Math.random() * taskList.length)];
  set(ref(db, "gameState"), {
    turn: Date.now(),
    answer: newAnswer
  });
  remove(ref(db, "drawings"));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveSnapshot(reason = "snapshot") {
  const dataURL = canvas.toDataURL("image/png");
  const filename = `${playerName}_${reason}_${Date.now()}.png`;
  const link = document.createElement("a");
  link.href = dataURL; link.download = filename; link.click();
}

function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-TW";
  u.rate = 0.8;//調整語速(數字越小越慢)
  speechSynthesis.speak(u);
}
let timer;
let timeLeft = 240; // 240 秒 = 4 分鐘
const timerDisplay = document.getElementById("timer");

function startCountdown() {
  timerDisplay.style.display = "block"; 
  timerDisplay.textContent = `剩下時間：${formatTime(timeLeft)}`;
  timer = setInterval(() => {
    timeLeft--;
     if (timeLeft <= 0) {
      clearInterval(countdown);
      timerDisplay.textContent = "⏰ 時間到！";
     canDraw = false; // ⛔ 停止畫圖
      speak("時間到了！我們來看成果吧！");
     }
      finishBtn.click(); // 自動點擊完成按鈕
    }
  }, 1000);
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
