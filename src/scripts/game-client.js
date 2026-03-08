/**
 * game-client.js
 * Main client-side game logic.
 * Handles Socket.IO communication, UI updates, dice rolling, and game flow.
 */
import { io } from 'socket.io-client';
import { drawBoard, renderTokens, PLAYER_COLORS } from './board-renderer.js';

// ─── State ──────────────────────────────────────────────────
let socket = null;
let playerName = '';
let roomId = '';
let gameState = null;
let myPlayerId = '';
let validMoves = [];
let isMyTurn = false;

// ─── DOM Elements ───────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Sound Effects ──────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch(type) {
      case 'dice':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        break;
      case 'move':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        break;
      case 'capture':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        break;
      case 'win':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.15);
        osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.3);
        osc.frequency.setValueAtTime(1047, audioCtx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start(); osc.stop(audioCtx.currentTime + 0.6);
        break;
    }
  } catch(e) {
    // Audio not available, silently ignore
  }
}

// ─── Server URL Configuration ───────────────────────────────
// When deployed, set VITE_SERVER_URL to the Render server URL.
// Locally, it defaults to localhost:3000.
const SERVER_URL = import.meta.env?.VITE_SERVER_URL
  || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : '');

// ─── Initialize ─────────────────────────────────────────────
export function initGame() {
  // Connect to the multiplayer server
  const serverUrl = SERVER_URL || window.location.origin;
  socket = io(serverUrl, {
    transports: ['websocket', 'polling']
  });
  myPlayerId = socket.id;

  socket.on('connect', () => {
    myPlayerId = socket.id;
    console.log('Connected:', myPlayerId);
  });

  setupLandingPage();
  setupLobbyPage();
  setupGamePage();
  setupSocketListeners();
}

// ─── Page Navigation ────────────────────────────────────────
function showPage(pageId) {
  $$('.page').forEach(p => p.classList.remove('active'));
  const page = $(`#${pageId}`);
  if (page) {
    page.classList.add('active');
    page.style.animation = 'fadeIn 0.4s ease';
  }
}

// ─── Landing Page Logic ─────────────────────────────────────
function setupLandingPage() {
  const nameInput = $('#player-name');
  const actionButtons = $('#action-buttons');
  const joinSection = $('#join-section');
  const errorMsg = $('#error-message');

  // Show buttons when name is entered
  nameInput.addEventListener('input', () => {
    const name = nameInput.value.trim();
    if (name.length >= 1) {
      actionButtons.classList.remove('hidden');
    } else {
      actionButtons.classList.add('hidden');
      joinSection.classList.add('hidden');
    }
    errorMsg.classList.add('hidden');
  });

  // Create Room
  $('#btn-create-room').addEventListener('click', () => {
    playerName = nameInput.value.trim();
    if (!playerName) return;

    socket.emit('create-room', playerName, (response) => {
      if (response.success) {
        roomId = response.roomId;
        updateLobby(response.players);
        showPage('lobby-page');
      } else {
        showError(response.error);
      }
    });
  });

  // Show Join input
  $('#btn-join-room').addEventListener('click', () => {
    actionButtons.classList.add('hidden');
    joinSection.classList.remove('hidden');
    $('#room-code').focus();
  });

  // Back from join
  $('#btn-join-back').addEventListener('click', () => {
    joinSection.classList.add('hidden');
    actionButtons.classList.remove('hidden');
  });

  // Confirm Join
  $('#btn-join-confirm').addEventListener('click', () => joinRoom());
  $('#room-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
  });
}

function joinRoom() {
  playerName = $('#player-name').value.trim();
  const code = $('#room-code').value.trim().toUpperCase();

  if (!playerName || !code) return;

  socket.emit('join-room', { roomId: code, playerName }, (response) => {
    if (response.success) {
      roomId = response.roomId;
      updateLobby(response.players);
      showPage('lobby-page');
    } else {
      showError(response.error);
    }
  });
}

function showError(msg) {
  const errorEl = $('#error-message');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

// ─── Lobby Page Logic ───────────────────────────────────────
function setupLobbyPage() {
  // Copy room code
  $('#btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => {
      const btn = $('#btn-copy-code');
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = '📋'; }, 1500);
    });
  });

  // Lobby chat
  $('#lobby-chat-send').addEventListener('click', sendLobbyChat);
  $('#lobby-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendLobbyChat();
  });
}

function sendLobbyChat() {
  const input = $('#lobby-chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('chat-message', msg);
  input.value = '';
}

function updateLobby(players) {
  $('#display-room-code').textContent = roomId;
  $('#player-count').textContent = `(${players.length}/4)`;

  const list = $('#player-list');
  list.innerHTML = '';

  const colors = ['red', 'blue', 'green', 'yellow'];
  players.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="player-color-dot" style="background: ${PLAYER_COLORS[colors[i]]?.fill || '#888'}"></span>
      <span class="player-name-text">${escapeHtml(p.name)}</span>
      ${p.id === myPlayerId ? '<span class="you-badge">VOUS</span>' : ''}
    `;
    list.appendChild(li);
  });

  // Update status
  const status = $('#lobby-status');
  const countdown = $('#countdown-display');

  if (players.length >= 2) {
    status.classList.add('hidden');
    countdown.classList.remove('hidden');
    startCountdown();
  } else {
    status.classList.remove('hidden');
    countdown.classList.add('hidden');
  }
}

function startCountdown() {
  let count = 3;
  const el = $('#countdown-number');
  el.textContent = count;

  const interval = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(interval);
      el.textContent = '🎮';
    } else {
      el.textContent = count;
    }
  }, 1000);
}

// ─── Game Page Logic ────────────────────────────────────────
function setupGamePage() {
  // Roll dice button
  $('#btn-roll-dice').addEventListener('click', rollDice);

  // Game chat toggle
  $('#btn-toggle-chat').addEventListener('click', () => {
    $('#game-chat').classList.toggle('hidden');
  });

  $('#btn-close-chat').addEventListener('click', () => {
    $('#game-chat').classList.add('hidden');
  });

  // Game chat send
  $('#game-chat-send').addEventListener('click', sendGameChat);
  $('#game-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendGameChat();
  });

  // Victory buttons
  $('#btn-restart').addEventListener('click', () => {
    socket.emit('restart-game');
    $('#victory-overlay').classList.add('hidden');
  });

  $('#btn-back-lobby').addEventListener('click', () => {
    location.reload();
  });
}

function sendGameChat() {
  const input = $('#game-chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('chat-message', msg);
  input.value = '';
}

function rollDice() {
  if (!isMyTurn) return;

  const btn = $('#btn-roll-dice');
  btn.disabled = true;
  btn.classList.add('rolling');

  // Visual dice roll animation
  const dice = $('#dice');
  const diceFace = $('#dice-face');
  dice.classList.add('show', 'rolling');

  // Animate random numbers
  let rollCount = 0;
  const rollInterval = setInterval(() => {
    diceFace.textContent = Math.floor(Math.random() * 6) + 1;
    rollCount++;
    if (rollCount > 8) clearInterval(rollInterval);
  }, 80);

  playSound('dice');

  socket.emit('roll-dice', (response) => {
    btn.classList.remove('rolling');

    setTimeout(() => {
      clearInterval(rollInterval);
      dice.classList.remove('rolling');

      if (response.success) {
        diceFace.textContent = response.diceValue;
        // Keep dice visible for a moment
        setTimeout(() => {
          dice.classList.remove('show');
        }, 2000);
      }
    }, 600);
  });
}

// ─── Socket Event Listeners ────────────────────────────────
function setupSocketListeners() {
  // Player joined the room
  socket.on('player-joined', (data) => {
    updateLobby(data.players);
  });

  // Player left
  socket.on('player-left', (data) => {
    updateLobby(data.players);
  });

  // Game starts
  socket.on('game-start', (data) => {
    gameState = data.gameState;
    showPage('game-page');
    initGameBoard();
  });

  // Dice rolled (by any player)
  socket.on('dice-rolled', (data) => {
    gameState = data.gameState;

    // Show dice result
    const dice = $('#dice');
    const diceFace = $('#dice-face');
    diceFace.textContent = data.diceValue;
    dice.classList.add('show');
    dice.classList.remove('rolling');

    setTimeout(() => {
      dice.classList.remove('show');
    }, 2000);

    if (data.autoSkip) {
      // No valid moves, turn auto-skipped
      validMoves = [];
      updateGameUI();
      return;
    }

    // If it's my dice roll, show valid moves
    if (data.playerId === myPlayerId) {
      validMoves = data.validMoves;
    } else {
      validMoves = [];
    }

    updateGameUI();
  });

  // Token moved
  socket.on('token-moved', (data) => {
    gameState = data.gameState;
    validMoves = [];

    if (data.moveResult.captured) {
      playSound('capture');
    } else {
      playSound('move');
    }

    updateGameUI();
  });

  // Game over
  socket.on('game-over', (data) => {
    gameState = data.gameState;
    validMoves = [];
    updateGameUI();

    playSound('win');

    const overlay = $('#victory-overlay');
    $('#winner-name').textContent = data.winner.name;
    overlay.classList.remove('hidden');
  });

  // Game restart
  socket.on('game-restart', (data) => {
    gameState = data.gameState;
    validMoves = [];
    $('#victory-overlay').classList.add('hidden');
    updateGameUI();
  });

  // Game paused (not enough players)
  socket.on('game-paused', () => {
    showPage('lobby-page');
  });

  // Chat messages
  socket.on('chat-message', (data) => {
    appendChatMessage(data);
  });
}

// ─── Board Initialization ──────────────────────────────────
function initGameBoard() {
  const svg = $('#ludo-board');
  drawBoard(svg);
  updateGameUI();
}

// ─── UI Update ─────────────────────────────────────────────
function updateGameUI() {
  if (!gameState) return;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  isMyTurn = currentPlayer.id === myPlayerId;

  // Update turn indicator
  const turnDot = $('#turn-dot');
  const turnText = $('#turn-text');
  turnDot.style.background = PLAYER_COLORS[currentPlayer.color]?.fill || '#888';
  turnText.textContent = isMyTurn ? 'Votre tour !' : `Tour de ${currentPlayer.name}`;

  // Update roll button
  const rollBtn = $('#btn-roll-dice');
  rollBtn.disabled = !(isMyTurn && gameState.turnPhase === 'roll');

  // Render tokens
  const svg = $('#ludo-board');

  // Only pass valid moves if it's my turn and phase is 'move'
  const movesToShow = (isMyTurn && gameState.turnPhase === 'move') ? validMoves : [];

  renderTokens(svg, gameState, movesToShow, (tokenIndex) => {
    if (!isMyTurn || gameState.turnPhase !== 'move') return;

    socket.emit('move-token', { tokenIndex }, (response) => {
      if (!response.success) {
        console.warn('Invalid move:', response.error);
      }
    });
  });

  // Update player panel
  updatePlayerPanel();
}

function updatePlayerPanel() {
  const panel = $('#player-panel');
  panel.innerHTML = '';

  gameState.players.forEach((player, idx) => {
    const isActive = idx === gameState.currentPlayerIndex;
    const finishedCount = player.tokens.filter(t => t.finished).length;
    const cols = PLAYER_COLORS[player.color];

    const card = document.createElement('div');
    card.className = `player-card ${isActive ? 'active' : ''}`;
    card.innerHTML = `
      <span class="p-color" style="background: ${cols?.fill || '#888'}"></span>
      <span class="p-name">${escapeHtml(player.name)}${player.id === myPlayerId ? ' (vous)' : ''}</span>
      <span class="p-tokens">${finishedCount}/4</span>
    `;
    panel.appendChild(card);
  });
}

// ─── Chat ───────────────────────────────────────────────────
function appendChatMessage(data) {
  const containers = ['#lobby-chat-messages', '#game-chat-messages'];
  containers.forEach(sel => {
    const container = $(sel);
    if (!container) return;

    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `
      <span class="chat-name">${escapeHtml(data.playerName)}:</span>
      <span class="chat-text">${escapeHtml(data.message)}</span>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  });
}

// ─── Utilities ──────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
