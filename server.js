const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const db = require("./db");
const cors = require("cors");
const Table = require("cli-table3");
const { v4: uuidv4 } = require("uuid");
const TelegramBot = require("node-telegram-bot-api");
const path = require("path"); // Replace with your bot token
const token = "7783379214:AAGI85k-k53pc58hmn8cahLjz2TcKLCBCCc";

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

let telegramId;

const { json } = require("stream/consumers");
const { type } = require("os");
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
let gameNumber = null;

// db.all(`SELECT * FROM users`, [], (err, rows) => {
//   if (err) {
//     console.error("❌ Select error:", err.message);
//   } else {
//     console.log("\n📦 Fetched Data:");
//     usersFromDB = rows;
//     console.log(usersFromDB);
//   }

// });

// app.get("/service-worker.js", (req, res) => {
//   res.sendFile(path.join(__dirname, "service-worker.js"));
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

app.get("/decreasePlayerBalance", (req, res) => {
  const { userID } = req.query;

  console.log("USer ID:", userID);
  db.all(
    `UPDATE users SET balance = balance - ?, played_games = played_games + ? WHERE telegram_id = ${userID}`,
    [10, 1],
    (err, rows) => {
      if (err) {
        console.error("❌ Select error:", err.message);
      } else {
        // console.log("\n📦 Fetched Data:");
        // usersFromDB = rows;
        // console.log(usersFromDB);
        // const userData = {
        //   id: 123,
        //   name: "John Doe",
        //   email: "john@example.com",
        // };
        // res.json(usersFromDB);
        const userData = {
          proceed: true,
        };
        res.json(userData);
        console.log("USer decreased");
      }
    }
  );
});

app.get("/getWinneerDetails", (req, res) => {
  const { userID, balance, isThisWinner } = req.query;

  console.log("USer ID:", userID);
  console.log("is theis winner", isThisWinner);
  if (isThisWinner === "true") {
    console.log("This winners page");
    db.run(
      `UPDATE users SET balance = balance + ?, won_games = won_games + ? WHERE telegram_id = ?`,
      [balance, 1, userID],
      function (err) {
        if (err) {
          return console.error("Error updating score:", err.message);
        }
        console.log(`Rows updated: ${this.changes}`);
      }
    );
  }
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
        players = userToNumber.size;
        let winning = parseInt(players * 0.8 * 10);
        let profit = parseInt(players * 0.2 * 10);
        const sql = `
            INSERT INTO games (players,winning, profit, winner_cartela,winner)
            VALUES (?,?,?,?,?)
          `;
        console.log(
          "To save successfully Games data",
          players,
          winning,
          profit
        );
        db.run(sql, [players, winning, profit, 0, ""], async function (err) {
          if (err) return console.error(err);
          console.log(
            "Saved successfully Games data",
            players,
            winning,
            profit
          );
          gameNumber = this.lastID;
          console.log(this.lastID, "this.lastID");
        });

        broadcast({
          type: "gameStarted",
          message: "Game has started!",
          users: Object.fromEntries(userToNumber),
          players: userToNumber.size,
        });
        setTimeout(() => {
          callInterval = setInterval(broadcastShuffledNumbers, 3000);
        }, 1000);
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
    drawnNumbers = [];
    numbers = [];

    startTimer();
    players = 0;
    // timer = 10;
    count = 0;
    lineMakingArray = [];
    someoneBingo = false;
    gameState = false;
    console.log("All 75 numbers have been called!");
  }
}

function allNumbersThatMakeLine(card, d, u, nn) {
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
<div class="text-black font-bold  w-100 flex justify-center items-center text-xl">${nn}</div>
      <div class="grid grid-cols-5 gap-1 bg-gray-300 p-2 opacity-90 flex justify-center flex-col items-center rounded" style="width:100%">
<div class="text-xl font-bold bg-gradient-to-br from-teal-400 via-teal-600 to-gray-600 opacity-100 text-white h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded  rounded">B</div>
<div class="text-xl font-bold bg-gradient-to-br from-teal-400 via-teal-600 to-gray-600 opacity-100 text-white h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded  rounded">I</div>
<div class="text-xl font-bold bg-gradient-to-br from-teal-400 via-teal-600 to-gray-600 opacity-100 text-white h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded  rounded">N</div>
<div class="text-xl font-bold bg-gradient-to-br from-teal-400 via-teal-600 to-gray-600 opacity-100 text-white h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded  rounded">G</div>
<div class="text-xl font-bold bg-gradient-to-br from-teal-400 via-teal-600 to-gray-600 opacity-100 text-white h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded  rounded">O</div>
`;

      const getClass = (value) => {
        if (value == current)
          return "bg-gradient-to-br from-teal-800 via-teal-900 to-gray-700 opacity-100 text-white h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded card-numbers";
        if (lineMakingArray.includes(value))
          return "bg-gradient-to-br from-teal-400 via-teal-600 to-gray-600 opacity-100 text-white h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded card-numbers";

        if (d.includes(value))
          return "bg-gradient-to-br from-slate-100 via-gray-50 to-pink-100 opacity-100 text-black h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded card-numbers";
        return "bg-gradient-to-br from-slate-100 via-gray-50 to-pink-100 opacity-100 text-black h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded card-numbers";
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
<div class="free-space bg-gradient-to-br from-teal-400 via-teal-600 to-gray-600 opacity-100 text-white h-6 shadow-[0_1px_2px_white] flex justify-center items-center  rounded card-numbers" id="free">⭐</div>
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
</div>
`;

      broadcast({
        type: "bingo",
        html,
        u,
      });

      console.log("winner to be updated");
      console.log(gameNumber, ":Game number");
      db.run(
        `UPDATE games SET winner_cartela = ?, winner =  ? WHERE id = ?`,
        [nn, u, gameNumber],
        function (err) {
          if (err) {
            return console.error("Error updating score:", err.message);
          }

          console.log("winner updated");
        }
      );

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
      }, 4000);
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
      console.log("USer balance: ", data.balance);
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
      console.log(data.number, "||", data.username, "|| ", data.balance);
      if (parseInt(data.balance) < 10) {
        console.log("Low balacne");
        broadcast({
          type: "lowBalance",
          u: data.username,
        });
      }
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
      if (data.balance > 10) {
        // Case 3: Assign new number
        userToNumber.set(username, number);
        broadcast({
          type: "numberSelected",
          username,
          number,
          currentNumber,
        });
      }
      console.log(userToNumber);
    } else if (data.type === "bingo") {
      console.log(data.c);
      console.log("Drawn numbers: ", drawnNumbers);
      allNumbersThatMakeLine(data.c, drawnNumbers, data.username, data.n);
    } else if (data.type == "refreshGameState") {
      ws.send(
        JSON.stringify({
          type: "gettingDrawnNumbers",
          drawnNumbers,
        })
      );
      // console.log(drawnNumbers);
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

const adminUser = "353008986";
const awaitingUserIdInput = {};
const awaitingUserDepositAmountTelebirr = {};
const awaitingUserDepositAmountCbe = {};

// /start command
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  telegramId = msg.from.id.toString();

  if (telegramId == adminUser) {
    // bot
    //   .sendMessage(msg.chat.id, `\`\`\`👮‍♂️ Admin \`\`\``, {
    //     parse_mode: "Markdown",
    //   })
    //   .then(() => {
    bot.sendMessage(msg.chat.id, `\`\`\`👮‍♂️ Admin \`\`\``, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Get balance",
              callback_data: "get_balance",
            },
            { text: "  Games ", callback_data: "get_games" },
          ],
          [{ text: "🤽🏻‍♂️ Users", callback_data: "get_users" }],
        ],
        keyboard: [["📊 Get Balance", "🎮 Games"], ["👥 Users"]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    });
    // });
  } else {
    const referrerId = match[1];

    console.log(referrerId);
    console.log("Telegram ID: ", telegramId);
    db.get(
      "SELECT * FROM users WHERE telegram_id = ?",
      [telegramId],
      (err, row) => {
        if (err) return console.error(err);

        if (row) {
          bot.sendMessage(msg.chat.id, "👋 Welcome back!").then(() => {
            bot.sendMessage(msg.chat.id, "🤖 What do you want to do?", {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🎮 Join Game",
                      web_app: {
                        url: `https://santimbingo.duckdns.org`,
                      },
                    },
                    { text: "💰  Balance", callback_data: "view_balance" },
                  ],
                  [
                    { text: "📜 Game Rules", callback_data: "game_rules" },
                    {
                      text: "👥 Invite Friends",
                      callback_data: "invite_friends",
                    },
                  ],
                  [
                    {
                      text: "💳 Deposit",
                      callback_data: "chapa_pay",
                      // web_app: {
                      //   url: "https://checkout.chapa.co/checkout/payment/vsm0pB26dZh5Blb9AFl6lkQkMSByl2QDvy1VAbxE9FdLM",
                      // },
                    },
                  ],
                ],
              },
            });
          });
        } else {
          if (referrerId && referrerId != telegramId.toString()) {
            console.log(
              `Inside not found ::: User ${telegramId} was referred by ${referrerId}`
            );

            const sql = `
    INSERT OR IGNORE INTO referrals (user_id, referrer_id)
    VALUES (?, ?)
  `;

            db.run(sql, [telegramId, referrerId], (err) => {
              if (err) return console.error(err);
            });

            // bot.sendMessage(
            //   referrerId,
            //   `🎉 Your friend ${msg.from.first_name} joined using your link!`
            // );
          }
          console.log("Not found");
          bot.sendMessage(
            msg.chat.id,
            "To start the app, 📱 Please share your phone number first: ",
            {
              reply_markup: {
                keyboard: [
                  [{ text: "Send Phone Number", request_contact: true }],
                ],
                one_time_keyboard: true,
                resize_keyboard: true,
              },
            }
          );
        }
      }
    );
  }
});

async function getBalanceByDate(targetDate) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT SUM(profit) as total FROM games WHERE DATE(date) = DATE(?)",
      [targetDate],
      (err, row) => {
        if (err) return reject(err);
        return resolve(row.total || 0); // if no rows matched, return 0
      }
    );
  });
}

async function getBalanceAlltime() {
  return new Promise((resolve, reject) => {
    db.get("SELECT SUM(profit) as total from games", [], (err, row) => {
      if (err) return reject(err);
      return resolve(row.total || 0); // if no rows matched, return 0
    });
  });
}

function getProfitGroupedByDateGeneral() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT DATE(date) as day, SUM(profit) as total_profit
       FROM games
       GROUP BY day
       ORDER BY day`,
      [],
      (err, rows) => {
        if (err) return reject(err);

        // Convert rows to an object like { "2025-05-24": 200, "2025-05-25": 150 }
        const result = {};
        rows.forEach(({ day, total_profit }) => {
          result[day] = total_profit;
        });
        resolve(result);
      }
    );
  });
}

function getProfitGroupedByDate(startDate, endDate) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT DATE(date) as day, SUM(profit) as total_profit
       FROM games
       WHERE DATE(date) BETWEEN DATE(?) AND DATE(?)
       GROUP BY day
       ORDER BY day`,
      [startDate, endDate],
      (err, rows) => {
        if (err) return reject(err);

        // Map the rows into a dictionary for quick access
        const profitsMap = {};
        rows.forEach(({ day, total_profit }) => {
          profitsMap[day] = total_profit;
        });

        // Helper to generate all dates between startDate and endDate inclusive
        function getDateRange(start, end) {
          const dateArray = [];
          let currentDate = new Date(start);
          const endDateObj = new Date(end);

          while (currentDate <= endDateObj) {
            // Format YYYY-MM-DD
            const formatted = currentDate.toISOString().slice(0, 10);
            dateArray.push(formatted);
            currentDate.setDate(currentDate.getDate() + 1);
          }
          return dateArray;
        }

        // Generate full date range
        const allDates = getDateRange(startDate, endDate);

        // Fill missing dates with zero profit
        const result = {};
        allDates.forEach((date) => {
          result[date] = profitsMap[date] || 0;
        });

        resolve(result);
      }
    );
  });
}

function getDayName(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short" }); // e.g., Mon, Tue
}

function formatProfitTable(profitsByDate) {
  const header = "Date       | Day       | Profit";
  const separator = "----------------------------------------";

  // Helper to get weekday name from date string
  function getDayName(dateStr) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const date = new Date(dateStr);
    return days[date.getDay()];
  }

  const rows = Object.entries(profitsByDate).map(([date, profit]) => {
    const dayName = getDayName(date);
    return `${date} | ${dayName.padEnd(9)}       | Br. ${profit}`;
  });

  // Calculate total profit sum
  const totalProfit = Object.values(profitsByDate).reduce(
    (sum, val) => sum + val,
    0
  );

  // Add total row at the bottom
  rows.push(separator);
  rows.push(`Total      |   Br. ${totalProfit}`);

  return [header, separator, ...rows].join("\n");
}

function formatProfitTableWithDaysCli(profitsByDate) {
  // Create a new table with column headers
  const table = new Table({
    head: ["Date", "Day", "Profit"],
    colWidths: [12, 6, 10],
    style: { head: ["cyan"] },
  });

  let totalProfit = 0;

  // Add each row to the table
  Object.entries(profitsByDate).forEach(([date, profit]) => {
    const dayName = new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
    });
    totalProfit += profit;
    table.push([date, dayName, `Br. ${profit}`]);
  });

  // Add a separator row and then the total row
  table.push([], ["Total", "", `Br. ${totalProfit}`]);

  // Return the table string wrapped in triple backticks for Telegram Markdown formatting
  return "```\n" + table.toString() + "\n```";
}

function generateBoxTable(data) {
  const headers = ["Date", "Day", "Profit"];
  const rows = Object.entries(data).map(([date, profit]) => [
    date,
    getDayName(date),
    `Br. ${profit}`,
  ]);

  const columnWidths = headers.map((_, colIndex) =>
    Math.max(
      headers[colIndex].length,
      ...rows.map((row) => row[colIndex].length)
    )
  );

  const drawLine = (left, middle, right) =>
    left + columnWidths.map((w) => "─".repeat(w + 2)).join(middle) + right;

  const drawRow = (cells) =>
    "│" +
    cells
      .map((cell, i) => ` ${cell.toString().padEnd(columnWidths[i])} `)
      .join("│") +
    "│";

  const top = drawLine("┌", "┬", "┐");
  const sep = drawLine("├", "┼", "┤");
  const bottom = drawLine("└", "┴", "┘");

  const body = rows.map(drawRow).join("\n");
  const total = Object.values(data).reduce((a, b) => a + b, 0);

  const table =
    top +
    "\n" +
    drawRow(headers) +
    "\n" +
    sep +
    "\n" +
    body +
    "\n" +
    sep +
    "\n" +
    drawRow(["Total", "", `Br. ${total}`]) +
    "\n" +
    bottom;

  return "```\n" + table + "\n```"; // Telegram code block
}

function getMondayToToday() {
  const today = new Date();

  // getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayOfWeek = today.getDay();

  // Calculate how many days to subtract to get Monday
  // If today is Sunday (0), treat as 7 for week calculations
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Get Monday's date
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);

  // Return as formatted strings YYYY-MM-DD or as Date objects
  function formatDate(date) {
    return date.toISOString().slice(0, 10);
  }

  return {
    monday: formatDate(monday),
    today: formatDate(today),
  };
}

function getMonthStartToToday() {
  const today = new Date();

  // First day of the month
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  // Format helper
  function formatDate(date) {
    return date.toISOString().slice(0, 10);
  }

  return {
    monthStart: formatDate(firstDay),
    today: formatDate(today),
  };
}

async function getGameNumberCounts() {
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      let todayCount = 0;
      let totalCount = 0;

      // Count rows for today
      db.get(
        `SELECT COUNT(*) AS count FROM games WHERE DATE(date) = DATE(?)`,
        [todayStr],
        (err, row) => {
          if (err) return reject(err);
          todayCount = row.count;

          // Count all rows total
          db.get(`SELECT COUNT(*) AS count FROM games`, (err2, row2) => {
            if (err2) return reject(err2);
            totalCount = row2.count;

            resolve({ todayCount, totalCount });
          });
        }
      );
    });
  });
}

bot.on("contact", (msg) => {
  const telegramId = msg.from.id.toString();
  const username = msg.from.first_name || "no_username";
  const phoneNumber = msg.contact.phone_number;

  const sql = `
    INSERT OR IGNORE INTO users (telegram_id, username, phone_number, balance, played_games,won_games)
    VALUES (?, ?, ?, 50,0,0)
  `;

  db.run(sql, [telegramId, username, phoneNumber], (err) => {
    if (err) return console.error(err);
    bot
      .sendMessage(msg.chat.id, "✅ Successfully registered. Thank you!", {
        reply_markup: {
          remove_keyboard: true,
        },
      })
      .then(() => {
        db.get(
          "SELECT * FROM referrals WHERE user_id = ?",
          [telegramId],
          (err, row) => {
            if (err) return console.error(err);

            if (row) {
              console.log("Referrer and referred", row);
              db.run(
                `UPDATE users SET balance = balance + ? WHERE telegram_id = ?`,
                [10, row.referrer_id],
                function (err) {
                  if (err) {
                    return console.error("Error updating score:", err.message);
                  }
                  // console.log(`Rows updated: ${this.changes}`);
                  bot.sendMessage(
                    row.referrer_id,
                    `${username} joined via your invite link. You have received Br. 10.`,
                    {
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: "🎮 Play",
                              web_app: {
                                url: `https://santimbingo.duckdns.org`,
                              },
                            },
                            {
                              text: "💰 Balance",
                              callback_data: "view_balance",
                            },
                          ],
                          [
                            {
                              text: "📜 Game Rules",
                              callback_data: "game_rules",
                            },
                            {
                              text: "👥 Invite Friends",
                              callback_data: "invite_friends",
                            },
                          ],
                          [{ text: "💳 Deposit", callback_data: "chapa_pay" }],
                        ],
                      },
                    }
                  );
                }
              );
            }
          }
        );

        bot.sendPhoto(
          msg.chat.id,
          "https://santimbingo.duckdns.org/assets/bot_logo_1.webp",
          {
            caption: "You have received Br. 50 as bonus from us. Enjoy!",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🎮 Play",
                    web_app: {
                      url: `https://santimbingo.duckdns.org`,
                    },
                  },
                  { text: "💰 Balance", callback_data: "view_balance" },
                ],
                [
                  { text: "📜 Game Rules", callback_data: "game_rules" },
                  {
                    text: "👥 Invite Friends",
                    callback_data: "invite_friends",
                  },
                ],
                [{ text: "💳 Deposit", callback_data: "chapa_pay" }],
              ],
            },
          }
        );
      });
  });
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const messageId = query.message.message_id;
  telegramId = query.from.id.toString();
  let responseText = "";
  switch (true) {
    case data === "view_balance":
      console.log("Telegram id: ", telegramId);

      db.get(
        "SELECT balance FROM users WHERE telegram_id = ?",
        [telegramId],
        async (err, row) => {
          if (err || !row) {
            console.error("DB error:", err);
            bot.sendMessage(
              chatId,
              "❌ Could not fetch balance. Please try again."
            );
          }
          bot.sendMessage(chatId, "Balance: Br. " + row.balance);
          // console.log(row);
          return;
        }
      );
      responseText = "💰 Your current balance is 50 coins.";
      break;
    case data === "join_game":
      responseText = "🎮 You've joined the game!";
      break;
    case data === "game_rules":
      // - 🟧 *Two Lines*
      // - 🟥 *Full House* (all numbers)
      bot.sendMessage(
        chatId,
        `🎉 Welcome to Santi Bingo! 🎉

📋 *Game Rules:*

1️⃣ You can select any cards that are available (not taken by other players) until the game starts.

2️⃣ Numbers will be called one by one 4 seconds apart. Stay alert!

3️⃣ Mark the numbers on your ticket as they are called.

4️⃣ Prizes are awarded for:

     🟩 *One Line* (any row)

5️⃣ Only a player who pressed the bingo button first is awarded with the winning amount. So be quick when bingo.

🏆 First to complete each wins the prize!

🚫 No cheating — the game automatically checks winners.

🤖 Good luck and have fun playing with friends!`,
        { parse_mode: "Markdown" }
      );

      break;
    case data === "invite_friends":
      bot.sendMessage(
        chatId,
        `
        🎉 Invite & Earn with Santim Bingo!

Share the fun and earn Br.10 for every friend who starts the bot using your link!

Your personal invite link:
https://t.me/santim_bingo_bot?start=${telegramId}

Bring your family and friends to play, win, and enjoy Bingo together! 
        `
      );
      break;
    case data === "chapa_pay":
      // 🔍 Fetch user from DB

      // db.get(
      //   "SELECT * FROM users WHERE telegram_id = ?",
      //   [telegramId],
      //   async (err, row) => {
      //     if (err || !row) {
      //       console.error("DB error:", err);
      //       bot.sendMessage(
      //         chatId,
      //         "❌ Could not retrieve your info. Try /start again."
      //       );
      //       return;
      //     }

      //     const tx_ref = "tx-" + Date.now();
      //     const sql = `
      //       INSERT INTO transactions (tx_ref,userID, amount, status)
      //       VALUES (?,?, ?, ?)
      //     `;

      //     db.run(sql, [tx_ref, row.telegram_id, 50, "pending"], async (err) => {
      //       if (err) return console.error(err);

      //       // console.log("TElegram ifd", );
      //       let id = row.telegram_id;
      //       const payload = {
      //         amount: "100",
      //         currency: "ETB",
      //         email: row.phone_number + "aben@gmail.com", // You can use a better format
      //         first_name: row.username || "TelegramUser",
      //         last_name: "User",
      //         phone_number: "0900123456",
      //         tx_ref,
      //         callback_url: `http://192.168.1.10:3000/callback?tx_ref=${tx_ref}&asd=asd&mnn=asdsd`,
      //         return_url: "http://192.168.1.10:3000/return.html",
      //         customization: {
      //           title: "Bot",
      //           description: "Payment",
      //         },
      //       };

      //       console.log(payload);
      //       try {
      //         const response = await fetch(
      //           "https://api.chapa.co/v1/transaction/initialize",
      //           {
      //             method: "POST",
      //             headers: {
      //               "Content-Type": "application/json",
      //               Authorization:
      //                 "Bearer CHASECK_TEST-HHFEZC6dt1ieICA8AAg5PZyMHWbVNxZ9",
      //             },
      //             body: JSON.stringify(payload),
      //           }
      //         );

      //         const data = await response.json();

      //         if (data.status === "success") {
      //           bot.sendMessage(
      //             chatId,
      //             `✅ Click below to complete your payment:`,
      //             {
      //               reply_markup: {
      //                 inline_keyboard: [
      //                   [
      //                     {
      //                       text: "💳 Pay Now",
      //                       web_app: { url: data.data.checkout_url },
      //                     },
      //                   ],
      //                 ],
      //               },
      //             }
      //           );
      //         } else {
      //           bot.sendMessage(chatId, "❌ Payment failed to initialize.");
      //           console.error(data);
      //         }
      //       } catch (error) {
      //         console.error("Chapa error:", error);
      //         bot.sendMessage(
      //           chatId,
      //           "⚠️ An error occurred while contacting Chapa."
      //         );
      //       }
      //     });
      //   }
      // );

      bot.sendMessage(chatId, "Choose method: ", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Manual",
                callback_data: "manual_method",
              },
              {
                text: "Chapa pay",
                callback_data: "chapa",
              },
            ],
          ],
        },
      });

      responseText = "Payment ongoing";
      break;

    case data === "get_balance":
      bot.sendMessage(chatId, `\`\`\`📅 Select date margin\`\`\``, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Today",
                callback_data: "get_balance_today",
              },
              { text: "  This week ", callback_data: "get_balance_week" },
            ],
            [
              { text: "This Month", callback_data: "get_balance_month" },
              { text: "Total", callback_data: "get_balance_all" },
            ],
          ],
        },
      });
      break;
    case data === "get_games":
      (async () => {
        try {
          const counts = await getGameNumberCounts();
          // console.log("Rows today:", counts.todayCount);
          // console.log("Total rows:", counts.totalCount);
          bot.sendMessage(
            chatId,
            `\`\`\`
Number of games Today: ${counts.todayCount} \nNumber of games alltime: ${counts.totalCount}\`\`\``,
            { parse_mode: "Markdown" }
          );
        } catch (err) {
          console.error("Error fetching counts:", err);
        }
      })();
      break;
    case data === "get_users":
      bot.sendMessage(chatId, `_Users_`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Search user by id",
                callback_data: "search_id",
              },
              { text: "Search user by name", callback_data: "search_name" },
            ],
            [
              { text: "All users", callback_data: "search_all" },
              { text: "Last winner", callback_data: "search_last_winner" },
            ],
            [{ text: "Leaderboard", callback_data: "search_leaderboard" }],
          ],
        },
      });
      break;
    case data === "get_balance_today":
      // bot.sendMessage(chatId, "Today balacne");
      (async () => {
        const balance = await getBalanceByDate(
          `${new Date().getFullYear()}-${(new Date().getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${new Date()
            .getDate()
            .toString()
            .padStart(2, "0")}`
        );
        // console.log("Balance:", balance);
        bot.sendMessage(
          chatId,
          `\`\`\`\n
Balance for today ${new Date().getFullYear()}-${(new Date().getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${new Date()
            .getDate()
            .toString()
            .padStart(2, "0")} : Br. ${balance}  \n  \`\`\``,
          { parse_mode: "Markdown" }
        );
      })();
      break;
    case data === "get_balance_week":
      // bot.sendMessage(chatId, "Week balacne");
      (async () => {
        const { monday, today } = getMondayToToday();
        const start = "2025-05-20";
        const end = "2025-05-25";

        const profits = await getProfitGroupedByDate(monday, today);
        console.log(profits);
        // Example output:
        // {
        //   '2025-05-24': 200,
        //   '2025-05-25': 150,
        //   ...
        // }
        // const message = formatProfitTableWithDaysCli(profits);
        const message = generateBoxTable(profits);
        bot.sendMessage(chatId, "Weekly Profit Summary:\n" + message, {
          parse_mode: "Markdown",
        });
      })();

      break;
    case data === "get_balance_month":
      (async () => {
        const { monthStart, today } = getMonthStartToToday();
        const start = "2025-05-20";
        const end = "2025-05-25";

        const profits = await getProfitGroupedByDate(monthStart, today);
        console.log(profits);
        // Example output:
        // {
        //   '2025-05-24': 200,
        //   '2025-05-25': 150,
        //   ...
        // }
        const message = generateBoxTable(profits);
        bot.sendMessage(chatId, "Monthly Profit Summary:\n" + message, {
          parse_mode: "Markdown",
        });
      })();
      break;
    case data === "get_balance_all":
      // bot.sendMessage(chatId, "Today balacne");
      (async () => {
        const balance = await getBalanceAlltime();
        // console.log("Balance:", balance);
        bot.sendMessage(
          chatId,
          `\`\`\`\n
Alltime balance :  Br. ${balance}  \n  \`\`\``,
          { parse_mode: "Markdown" }
        );
      })();
      break;
    case data === "search_id":
      awaitingUserIdInput[chatId] = true;

      bot.sendMessage(chatId, "Please send the user ID:");
      bot.answerCallbackQuery(query.id);
      break;
    case data === "manual_method":
      bot.sendMessage(chatId, "Choose bank:", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "CBE",
                callback_data: "cbe",
              },
              {
                text: "Telebirr",
                callback_data: "telebirr",
              },
            ],
          ],
        },
      });
      break;
    case data === "cbe":
      awaitingUserDepositAmountTelebirr[chatId] = false;
      awaitingUserDepositAmountCbe[chatId] = true;
      bot.sendMessage(chatId, "How much?");
      break;
    case data === "telebirr":
      awaitingUserDepositAmountCbe[chatId] = false;
      awaitingUserDepositAmountTelebirr[chatId] = true;
      bot.sendMessage(chatId, "How much?");

      break;
    case data.startsWith("deposit_user_"):
      // Handle user viewing
      console.log("Dposite user 1382", data);

      const depositeData = data.replace("deposit_user_", "");
      const [userId, amount] = depositeData.split("_");
      console.log("User ID:", userId);
      console.log("amount:", amount);
      updateUserBalanceByAdmin(userId, parseInt(amount), (err, result) => {
        if (err) {
          console.error("Error updating balance:", err.message);
          bot.sendMessage(adminUser, "Error updating balance!").then(() => {
            bot.sendMessage(
              userId,
              "Error processing transaction. Please contact admin."
            );
            bot.deleteMessage(adminUser, messageId);
          });
        } else {
          console.log(`Balance updated:`, result);
          bot.sendMessage(adminUser, "Success!").then(() => {
            bot.sendMessage(
              userId,
              "Balance deposited successfully. Check your balance."
            );
            bot.deleteMessage(adminUser, messageId);
          });
        }
      });

      // Query DB or perform action with userId
      break;
    default:
      responseText = "❓ Unknown action.";
  }

  // bot.sendMessage(chatId, responseText);
});

bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;
  const telegramIdd = msg.from.id.toString();
  db.get(
    "SELECT balance FROM users WHERE telegram_id = ?",
    [telegramIdd],
    async (err, row) => {
      if (err || !row) {
        console.error("DB error:", err);
        bot.sendMessage(
          chatId,
          "❌ Could not fetch balance. Please try again."
        );
      }
      bot.sendMessage(chatId, "Balance: Br. " + row.balance);
      // console.log(row);
      return;
    }
  );
});

bot.onText(/\/invite/, (msg) => {
  const chatId = msg.chat.id;
  const telegramIdd = msg.from.id;
  bot.sendMessage(
    chatId,
    `
        🎉 Invite & Earn with Santim Bingo!

Share the fun and earn Br.10 for every friend who starts the bot using your link!

Your personal invite link:
https://t.me/santim_bingo_bot?start=${telegramIdd}

Bring your family and friends to play, win, and enjoy Bingo together! 
        `
  );
});

bot.onText(/\/rules/, (msg) => {
  const chatId = msg.chat.id;
  const telegramIdd = msg.from.id;
  bot.sendMessage(
    chatId,
    `🎉 Welcome to Santim Bingo! 🎉

📋 *Game Rules:*

1️⃣ You can select any cards that are available (not taken by other players) until the game starts.

2️⃣ Numbers will be called one by one 4 seconds apart. Stay alert!

3️⃣ Mark the numbers on your ticket as they are called.

4️⃣ Prizes are awarded for:

     🟩 *One Line* (any row)

5️⃣ Only a player who pressed the bingo button first is awarded with the winning amount. So be quick when bingo.

🏆 First to complete each wins the prize!

🚫 No cheating — the game automatically checks winners.

🤖 Good luck and have fun playing with friends!`,
    { parse_mode: "Markdown" }
  );
});

bot.on("message", async (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;

  if (text === "📊 Get Balance") {
    bot.sendMessage(chatId, `\`\`\`📅 Select date margin\`\`\``, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Today",
              callback_data: "get_balance_today",
            },
            { text: "  This week ", callback_data: "get_balance_week" },
          ],
          [
            { text: "This Month", callback_data: "get_balance_month" },
            { text: "Total", callback_data: "get_balance_all" },
          ],
        ],
      },
    });
  } else if (text === "🎮 Games") {
    (async () => {
      try {
        const counts = await getGameNumberCounts();
        // console.log("Rows today:", counts.todayCount);
        // console.log("Total rows:", counts.totalCount);
        bot.sendMessage(
          chatId,
          `\`\`\`
Number of games Today: ${counts.todayCount} \nNumber of games alltime: ${counts.totalCount}\`\`\``,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        console.error("Error fetching counts:", err);
      }
    })();
  } else if (text === "👥 Users") {
    bot.sendMessage(chatId, `_Users_`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Search user by id",
              callback_data: "search_id",
            },
            { text: "Search user by name", callback_data: "search_name" },
          ],
          [
            { text: "All users", callback_data: "search_all" },
            { text: "Last winner", callback_data: "search_last_winner" },
          ],
          [{ text: "Leaderboard", callback_data: "search_leaderboard" }],
        ],
      },
    });
  }
  if (awaitingUserIdInput[chatId] && /^\d+$/.test(msg.text.trim())) {
    const userId = msg.text;

    // Reset the state
    delete awaitingUserIdInput[chatId];

    // Query the DB and return result
    try {
      const user = await getUserByTelegramId(userId); // <- your DB function

      if (user) {
        bot.sendMessage(chatId, generateUserBoxTable(user), {
          parse_mode: "Markdown",
        });
      } else {
        bot.sendMessage(chatId, `❌ No user found with ID: ${userId}`);
      }
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, `⚠️ Error querying the database.`);
    }
  }
  if (
    awaitingUserDepositAmountTelebirr[chatId] &&
    /^\d+$/.test(msg.text.trim())
  ) {
    const query = `
        INSERT INTO transactions (tx_ref, userID, amount, status, method)
        VALUES (?, ?, ?, ?, ?)
      `;
    let tx_ref = uuidv4();
    db.run(
      query,
      [tx_ref, telegramId, parseInt(text), "pending", "telebirr"],
      function (err) {
        if (err) {
          return console.error("Error inserting transaction:", err.message);
        }
        console.log(`Transaction inserted with ID ${this.lastID}`);
        bot
          .sendMessage(
            chatId,
            "🏦 Deposit Instructions 🏦 \n 🔹 Bank Name: TELEBIRR \n 🔢 Phone Number: +251934596919\n 🔢  Name: ABENZER GASHAW MEKONNEN \n\n ** Please only use the number you registered with. If use another number enter below. \n\n After payment click the button below and provide your payment reference, or text message from 127.",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Send message from 127",
                      callback_data: "verify_telebirr",
                    },
                  ],
                  [
                    {
                      text: "Use another number",
                      callback_data: "use_another_number",
                    },
                  ],
                ],
              },
            }
          )
          .then(() => {
            bot.sendMessage(
              adminUser,
              `New deposit order from: ${chatId} \n Amount: ${text} \n Method: Telebirr`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Approve",
                        callback_data: `deposit_user_${chatId}_${text}`,
                      },
                    ],
                  ],
                },
              }
            );
          });
      }
    );
  }

  if (awaitingUserDepositAmountCbe[chatId] && /^\d+$/.test(msg.text.trim())) {
    const query = `
        INSERT INTO transactions (tx_ref, userID, amount, status, method)
        VALUES (?, ?, ?, ?, ?)
      `;
    let tx_ref = uuidv4();
    db.run(
      query,
      [tx_ref, telegramId, parseInt(text), "pending", "cbe"],
      function (err) {
        if (err) {
          return console.error("Error inserting transaction:", err.message);
        }
        console.log(`Transaction inserted with ID ${this.lastID}`);
        bot
          .sendMessage(
            chatId,
            "🏦 Deposit Instructions 🏦 \n 🔹 Bank Name: CBE \n 🔢 Phone Number: 1000185229207\n 🔢  Name: ABENZER GASHAW MEKONNEN \n\n ** Please only use the number you registered with. If use another number enter below. \n\n After payment click the button below and provide your payment reference, or text message from CBE.",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Send message from CBE",
                      callback_data: "verify_cbe",
                    },
                  ],
                  [
                    {
                      text: "Use another account",
                      callback_data: "use_another_account",
                    },
                  ],
                ],
              },
            }
          )
          .then(() => {
            bot.sendMessage(
              adminUser,
              `New deposit order from: ${chatId} \n Amount: ${text} \n Method: CBE`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Approve",
                        callback_data: `deposit_user_${chatId}_${text}`,
                      },
                    ],
                  ],
                },
              }
            );
          });
      }
    );
  }
});

function getUserByTelegramId(id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE telegram_id = ?", [id], (err, row) => {
      if (err) return reject(err);
      console.log(row);
      resolve(row);
    });
  });
}

function generateUserBoxTable(user) {
  const entries = Object.entries(user).map(([key, value]) => [
    key,
    value.toString(),
  ]);
  const headers = ["Field", "Value"];

  const columnWidths = headers.map((_, colIndex) =>
    Math.max(...entries.map((row) => row[colIndex].length))
  );

  const drawLine = (left, middle, right) =>
    left + columnWidths.map((w) => "─".repeat(w + 2)).join(middle) + right;

  const drawRow = (cells) =>
    "│" +
    cells
      .map((cell, i) => ` ${cell.toString().padEnd(columnWidths[i])} `)
      .join("│") +
    "│";

  const top = drawLine("┌", "┬", "┐");
  const sep = drawLine("├", "┼", "┤");
  const bottom = drawLine("└", "┴", "┘");

  const body = entries.map(drawRow).join("\n");

  const table = top + "\n" + body + "\n" + bottom;

  return "```\n" + table + "\n```"; // Telegram code block
}

function updateUserBalanceByAdmin(telegramId, amountToAdd, callback) {
  // Step 1: Get current balance
  const selectQuery = `SELECT balance FROM users WHERE telegram_id = ?`;

  db.get(selectQuery, [telegramId], (err, row) => {
    if (err) {
      return callback(err);
    }

    if (!row) {
      return callback(new Error("User not found."));
    }

    const newBalance = row.balance + amountToAdd;

    // Step 2: Update balance
    const updateQuery = `UPDATE users SET balance = ? WHERE telegram_id = ?`;
    db.run(updateQuery, [newBalance, telegramId], function (updateErr) {
      if (updateErr) {
        return callback(updateErr);
      }

      callback(null, {
        telegram_id: telegramId,
        new_balance: newBalance,
        rowsAffected: this.changes,
      });
    });
  });
}
