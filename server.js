const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Хранилище курсоров активных игроков: { socketId: { x, y, color } }
const players = {};

// Генерируем случайный цвет для курсора нового игрока
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Встроенный HTML+JS клиент
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multiplayer Cursors</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #1a1a1a;
      font-family: sans-serif;
      user-select: none;
    }
    #info {
      position: absolute;
      top: 10px;
      left: 10px;
      color: #ffffff;
      font-size: 14px;
      pointer-events: none;
      z-index: 1000;
      background: rgba(0, 0, 0, 0.5);
      padding: 8px 12px;
      border-radius: 6px;
    }
    .cursor {
      position: absolute;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      pointer-events: none;
      transform: translate(-50%, -50%);
      transition: left 0.05s linear, top 0.05s linear;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
    }
  </style>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <div id="info">Водите мышкой по экрану. Игроков онлайн: <span id="count">1</span></div>

  <script>
    const socket = io();
    const cursorElements = {};
    const countEl = document.getElementById('count');

    // Отправляем свои координаты мыши (в процентах от размера экрана для адаптивности)
    window.addEventListener('mousemove', (e) => {
      const xPercent = e.clientX / window.innerWidth;
      const yPercent = e.clientY / window.innerHeight;
      socket.emit('move', { x: xPercent, y: yPercent });
    });

    // Обновляем позицию всех курсоров от сервера
    socket.on('updateState', (players) => {
      countEl.textContent = Object.keys(players).length;

      // Обновляем или создаем курсоры других игроков
      for (const id in players) {
        if (id === socket.id) continue; // Наш курсор показывает сам браузер

        const data = players[id];
        let el = cursorElements[id];

        if (!el) {
          el = document.createElement('div');
          el.className = 'cursor';
          el.style.backgroundColor = data.color;
          document.body.appendChild(el);
          cursorElements[id] = el;
        }

        // Переводим проценты обратно в пиксели текущего экрана
        el.style.left = (data.x * window.innerWidth) + 'px';
        el.style.top = (data.y * window.innerHeight) + 'px';
      }

      // Удаляем курсоры отключившихся игроков
      for (const id in cursorElements) {
        if (!players[id]) {
          cursorElements[id].remove();
          delete cursorElements[id];
        }
      }
    });
  </script>
</body>
</html>
  `);
});

// Обработка подключений Socket.IO
io.on('connection', (socket) => {
  players[socket.id] = {
    x: 0.5,
    y: 0.5,
    color: getRandomColor()
  };

  io.emit('updateState', players);

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      io.emit('updateState', players);
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('updateState', players);
  });
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});