const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const db = require("./db");
const cors = require("cors");

const { json } = require("stream/consumers");
// const TelegramBot = require("node-telegram-bot-api");

// const token = "7967803106:AAEZV06ZdA693dV3SCOD9Y-Ch3LTrGpp02Y"; // demo only
// const bot = new TelegramBot(token, { polling: true });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(cors());

let users = [];

let gameState = false;
const userToNumber = new Map();
let timer;
let timeLeft = 60;
let numbers = [];
let drawnNumbers = [];
let count = 0;
let callInterval;
let lineMakingArray = [];
let winner = null;
let players = 0;
let someoneBingo = false;
let current = 0;
let usersFromDB = [];

// db.all(`SELECT * FROM users`, [], (err, rows) => {
//   if (err) {
//     console.error("❌ Select error:", err.message);
//   } else {
//     console.log("\n📦 Fetched Data:");
//     usersFromDB = rows;
//     console.log(usersFromDB);
//   }

// });

app.get("/getuserdetails", (req, res) => {
  const { userID } = req.query;

  console.log("USer ID:", userID);
  db.all(
    `SELECT * FROM users WHERE telegram_id = ${userID}`,
    [],
    (err, rows) => {
      if (err) {
        console.error("❌ Select error:", err.message);
      } else {
        console.log("\n📦 Fetched Data:");
        usersFromDB = rows;
        console.log(usersFromDB);

        const userData = {
          id: 123,
          name: "John Doe",
          email: "john@example.com",
        };
        res.json(usersFromDB);
      }
    }
  );
});

app.get("/getWinneerDetails", (req, res) => {
  const { userID, balance } = req.query;

  console.log("USer ID:", userID);

  db.run(
    `UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
    [balance, userID],
    function (err) {
      if (err) {
        return console.error("Error updating score:", err.message);
      }
      console.log(`Rows updated: ${this.changes}`);
      db.all(
        `SELECT * FROM users WHERE telegram_id = ${userID}`,
        [],
        (err, rows) => {
          if (err) {
            console.error("❌ Select error:", err.message);
          } else {
            console.log("\n📦 Fetched Data:");

            const userData = rows;
            res.json(userData);
          }
        }
      );
    }
  );
});

function startTimer() {
  clearInterval(timer); // clear existing timer if any
  // console.log(timer);
  timeLeft = 15;

  timer = setInterval(() => {
    timeLeft--;
    console.log(timeLeft);
    broadcast({
      type: "timerBroadcast",
      timeLeft,
    });
    if (timeLeft <= 0) {
      if (userToNumber.size >= 1) {
        numbers = getShuffledBingoNumbers();
        gameState = true;
        callInterval = setInterval(broadcastShuffledNumbers, 3000);
        players = userToNumber.size;
        broadcast({
          type: "gameStarted",
          message: "Game has started!",
          users: Object.fromEntries(userToNumber),
          players: userToNumber.size,
        });
        clearInterval(timer);
      } else {
        startTimer();
      }
    }
  }, 1000);
}

function getShuffledBingoNumbers() {
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);

  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  return numbers;
}

function broadcastShuffledNumbers() {
  // console.log("Numbers:", numbers);
  if (count < numbers.length) {
    current = numbers[count];
    count++;
    // console.log("Current: ", current);
    // console.log("Index: ", count);
    drawnNumbers.push(current);
    broadcast({
      type: "numbersCalling",
      current,
      count,
    });
  } else {
    clearInterval(callInterval);
    console.log("All 75 numbers have been called!");
  }
}

function allNumbersThatMakeLine(card, d, u) {
  if (!someoneBingo) {
    let line1 = [card.b1, card.b2, card.b3, card.b4, card.b5];
    let line2 = [card.i1, card.i2, card.i3, card.i4, card.i5];
    let line3 = [card.n1, card.n2, card.n4, card.n5];
    let line4 = [card.g1, card.g2, card.g3, card.g4, card.g5];
    let line5 = [card.o1, card.o2, card.o3, card.o4, card.o5];
    let line6 = [card.b1, card.i1, card.n1, card.g1, card.o1];
    let line7 = [card.b2, card.i2, card.n2, card.g2, card.o2];
    let line8 = [card.b3, card.i3, card.g3, card.o3];
    let line9 = [card.b4, card.i4, card.n4, card.g4, card.o4];
    let line10 = [card.b5, card.i5, card.n5, card.g5, card.o5];
    let line11 = [card.b1, card.i2, card.g4, card.o5];
    let line12 = [card.b5, card.i4, card.g2, card.o1];
    let line13 = [card.b1, card.b5, card.o1, card.o5];

    const allLines = [
      line1,
      line2,
      line3,
      line4,
      line5,
      line6,
      line7,
      line8,
      line9,
      line10,
      line11,
      line12,
      line13,
    ];

    allLines.forEach((l) => {
      if (l.every((element) => d.includes(element))) {
        // lineMakingArray.push([...l]);
        for (let i = 0; i < l.length; i++) {
          lineMakingArray.push(l[i]);
        }
      }
    });

    if (lineMakingArray.length > 0 && lineMakingArray.includes(current)) {
      someoneBingo = true;
      console.log("Line making numbers: ", lineMakingArray);
      let html = "";
      html += `<!-- BINGO Header -->
<div class="bg-yellow-300 fw-bold">B</div>
<div class="bg-yellow-300 fw-bold">I</div>
<div class="bg-yellow-300 fw-bold">N</div>
<div class="bg-yellow-300 fw-bold">G</div>
<div class="bg-yellow-300 fw-bold">O</div>
`;

      const getClass = (value) => {
        if (value == current)
          return "bg-green-900 text-black flex justify-center text-white";
        if (lineMakingArray.includes(value))
          return "bg-green-300 text-black flex justify-center";

        if (d.includes(value))
          return "bg-red-300 text-white flex justify-center";
        return "bg-gray-200 text-black flex justify-center";
      };

      html += `
<div class="${getClass(card.b1)}" id="b1">${card.b1}</div>
<div class="${getClass(card.i1)}" id="i1">${card.i1}</div>
<div class="${getClass(card.n1)}" id="n1">${card.n1}</div>
<div class="${getClass(card.g1)}" id="g1">${card.g1}</div>
<div class="${getClass(card.o1)}" id="o1">${card.o1}</div>

<div class="${getClass(card.b2)}" id="b2">${card.b2}</div>
<div class="${getClass(card.i2)}" id="i2">${card.i2}</div>
<div class="${getClass(card.n2)}" id="n2">${card.n2}</div>
<div class="${getClass(card.g2)}" id="g2">${card.g2}</div>
<div class="${getClass(card.o2)}" id="o2">${card.o2}</div>

<div class="${getClass(card.b3)}" id="b3">${card.b3}</div>
<div class="${getClass(card.i3)}" id="i3">${card.i3}</div>
<div class="free-space bg-green-300 flex justify-center" id="free">⭐</div>
<div class="${getClass(card.g3)}" id="g3">${card.g3}</div>
<div class="${getClass(card.o3)}" id="o3">${card.o3}</div>

<div class="${getClass(card.b4)}" id="b4">${card.b4}</div>
<div class="${getClass(card.i4)}" id="i4">${card.i4}</div>
<div class="${getClass(card.n4)}" id="n3">${card.n4}</div>
<div class="${getClass(card.g4)}" id="g4">${card.g4}</div>
<div class="${getClass(card.o4)}" id="o4">${card.o4}</div>

<div class="${getClass(card.b5)}" id="b5">${card.b5}</div>
<div class="${getClass(card.i5)}" id="i5">${card.i5}</div>
<div class="${getClass(card.n5)}" id="n4">${card.n5}</div>
<div class="${getClass(card.g5)}" id="g5">${card.g5}</div>
<div class="${getClass(card.o5)}" id="o5">${card.o5}</div>
`;

      broadcast({
        type: "bingo",
        html,
        u,
      });

      clearInterval(callInterval);

      setTimeout(() => {
        broadcast({
          type: "gameFinished",
        });

        broadcast({
          type: "removeGameStartedModal",
          players,
          u,
        });

        drawnNumbers = [];
        numbers = [];

        startTimer();
        players = 0;
        // timer = 10;
        count = 0;
        lineMakingArray = [];
        someoneBingo = false;
        gameState = false;
      }, 2500);
    } else {
      broadcast({
        type: "blockUser",
        u,
      });
    }
  }
}

startTimer();
wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === "userJoined") {
      ws.username = data.username;
      users.push(data.username);
      if (gameState) {
        ws.send(
          JSON.stringify({
            type: "activeGame",
            message: "Game in progress. Please wait until it ends.",
          })
        );
      } else {
        ws.send(
          JSON.stringify({
            type: "status",
            message: "No active game. You can join a new game.",
            cards: Array.from(userToNumber.values()),
          })
        );
      }

      console.log(`User joined: ${data.username}`);
      console.log("Current users:", users);
    } else if (data.type === "cardSelected") {
      console.log(data.number, "||", data.username);
      const { username, number } = data;

      const currentNumber = userToNumber.get(username);

      // Case 1: Toggle off if user re-selects their own number
      if (currentNumber === number) {
        userToNumber.delete(username);
        console.log(userToNumber);
        broadcast({
          type: "selectionCleared",
          username,
          number,
        });
        return;
      }

      // Case 2: Check if number is already taken by someone else
      let taken = false;
      for (const [otherUser, otherNumber] of userToNumber.entries()) {
        if (otherNumber === number && otherUser !== username) {
          taken = true;
          break;
        }
      }

      if (taken) {
        console.log(userToNumber);

        return;
      }

      // Case 3: Assign new number
      userToNumber.set(username, number);
      broadcast({
        type: "numberSelected",
        username,
        number,
        currentNumber,
      });
      console.log(userToNumber);
    } else if (data.type === "bingo") {
      console.log(data.c);
      console.log("Drawn numbers: ", drawnNumbers);
      allNumbersThatMakeLine(data.c, drawnNumbers, data.username);
    }
  });

  ws.on("close", () => {
    if (ws.username) {
      users = users.filter((u) => u !== ws.username);
      let n = userToNumber.get(ws.username);
      // console.log("Number:", n);
      broadcast({
        type: "removeCardsOnLeave",
        n,
      });
      userToNumber.delete(ws.username);
      console.log(userToNumber);
      console.log("Left Users:", users);
    }
  });
});

function broadcast(message) {
  const json = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}
// Serve static files from public folder
app.use(express.static("public"));

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

// Replace this with your actual ngrok URL (no trailing space!)
// const WEB_APP_URL = "https://71c5-196-190-144-134.ngrok-free.app";

// bot.onText(/\/start/, (msg) => {
//   const chatId = msg.chat.id;

//   bot.sendMessage(chatId, "Please share your phone number to continue:", {
//     reply_markup: {
//       keyboard: [
//         [
//           {
//             text: "📱 Share Phone Number",
//             request_contact: true,
//           },
//         ],
//       ],
//       resize_keyboard: true,
//       one_time_keyboard: true,
//     },
//   });
// });

// bot.on("contact", (msg) => {
//   const phoneNumber = msg.contact.phone_number;
//   const firstName = msg.contact.first_name;

//   bot.sendMessage(
//     msg.chat.id,
//     `Thanks, ${firstName}! Your phone: ${phoneNumber}`
//   );

//   // Now send the Web App button
//   bot.sendMessage(msg.chat.id, "Open the mini app:", {
//     reply_markup: {
//       inline_keyboard: [
//         [
//           {
//             text: "🚀 Launch App",
//             web_app: { url: WEB_APP_URL },
//           },
//         ],
//       ],
//     },
//   });
// });
