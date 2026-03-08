/**
 * Ludo Online - Server
 * Express + Socket.IO server that serves the Astro static build
 * and handles real-time multiplayer game logic.
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Serve the Astro build output
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ─── Game Constants ─────────────────────────────────────────
const COLORS = ['red', 'blue', 'green', 'yellow'];
const BOARD_SIZE = 52; // Total cells on the main track
const HOME_STRETCH = 6; // Cells in the home column per color
const TOKENS_PER_PLAYER = 4;

// Starting positions on the main track for each color
const START_POSITIONS = { red: 0, blue: 13, green: 26, yellow: 39 };

// ─── Room & Game State Storage ─────────────────────────────
const rooms = new Map();

/**
 * Creates a fresh game state for a room.
 */
function createGameState(players) {
  const state = {
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: COLORS[i],
      tokens: Array.from({ length: TOKENS_PER_PLAYER }, () => ({
        position: -1,    // -1 = in base/yard
        homeProgress: -1, // -1 = not in home stretch, 0-5 = home stretch cell
        finished: false
      }))
    })),
    currentPlayerIndex: 0,
    diceValue: null,
    gameOver: false,
    winner: null,
    turnPhase: 'roll', // 'roll' or 'move'
    consecutiveSixes: 0
  };
  return state;
}

/**
 * Calculates valid moves for the current player after a dice roll.
 */
function getValidMoves(gameState, diceValue) {
  const player = gameState.players[gameState.currentPlayerIndex];
  const moves = [];

  player.tokens.forEach((token, tokenIndex) => {
    if (token.finished) return;

    // Token is in base - can only come out on a 6
    if (token.position === -1) {
      if (diceValue === 6) {
        const startPos = START_POSITIONS[player.color];
        // Check if start position is free of own tokens
        const blocked = player.tokens.some(
          (t, i) => i !== tokenIndex && t.position === startPos && t.homeProgress === -1
        );
        if (!blocked) {
          moves.push({ tokenIndex, type: 'enter' });
        }
      }
      return;
    }

    // Token is in home stretch
    if (token.homeProgress >= 0) {
      const newHomePos = token.homeProgress + diceValue;
      if (newHomePos === HOME_STRETCH) {
        moves.push({ tokenIndex, type: 'finish' });
      } else if (newHomePos < HOME_STRETCH) {
        // Check if another own token is at newHomePos in home stretch
        const blocked = player.tokens.some(
          (t, i) => i !== tokenIndex && t.homeProgress === newHomePos
        );
        if (!blocked) {
          moves.push({ tokenIndex, type: 'homeMove' });
        }
      }
      return;
    }

    // Token is on the main track
    const startPos = START_POSITIONS[player.color];
    const currentRel = (token.position - startPos + BOARD_SIZE) % BOARD_SIZE;
    const newRel = currentRel + diceValue;

    if (newRel === BOARD_SIZE) {
      // Enters home stretch at position 0
      moves.push({ tokenIndex, type: 'enterHome' });
    } else if (newRel > BOARD_SIZE && newRel <= BOARD_SIZE + HOME_STRETCH) {
      const homePos = newRel - BOARD_SIZE;
      if (homePos === HOME_STRETCH) {
        moves.push({ tokenIndex, type: 'finish' });
      } else {
        const blocked = player.tokens.some(
          (t, i) => i !== tokenIndex && t.homeProgress === homePos
        );
        if (!blocked) {
          moves.push({ tokenIndex, type: 'enterHome' });
        }
      }
    } else if (newRel < BOARD_SIZE) {
      const newAbsPos = (startPos + newRel) % BOARD_SIZE;
      // Check if blocked by own token
      const blockedBySelf = player.tokens.some(
        (t, i) => i !== tokenIndex && t.position === newAbsPos && t.homeProgress === -1
      );
      if (!blockedBySelf) {
        moves.push({ tokenIndex, type: 'move' });
      }
    }
  });

  return moves;
}

/**
 * Executes a move and returns information about captures.
 */
function executeMove(gameState, tokenIndex, diceValue) {
  const player = gameState.players[gameState.currentPlayerIndex];
  const token = player.tokens[tokenIndex];
  const result = { captured: false, capturedPlayer: null, capturedToken: null, finished: false };

  // Safe positions where tokens can't be captured
  const safePositions = [0, 8, 13, 21, 26, 34, 39, 47];

  if (token.position === -1 && diceValue === 6) {
    // Move token out of base to start position
    token.position = START_POSITIONS[player.color];
    token.homeProgress = -1;

    // Check for captures at start position
    const captureResult = checkCapture(gameState, player, token.position, safePositions);
    if (captureResult) {
      result.captured = true;
      result.capturedPlayer = captureResult.playerIndex;
      result.capturedToken = captureResult.tokenIndex;
    }
  } else if (token.homeProgress >= 0) {
    // Move within home stretch
    const newHomePos = token.homeProgress + diceValue;
    if (newHomePos >= HOME_STRETCH) {
      token.finished = true;
      token.homeProgress = HOME_STRETCH;
      result.finished = true;
    } else {
      token.homeProgress = newHomePos;
    }
  } else {
    // Move on main track
    const startPos = START_POSITIONS[player.color];
    const currentRel = (token.position - startPos + BOARD_SIZE) % BOARD_SIZE;
    const newRel = currentRel + diceValue;

    if (newRel >= BOARD_SIZE) {
      // Enter home stretch
      const homePos = newRel - BOARD_SIZE;
      if (homePos >= HOME_STRETCH) {
        token.finished = true;
        token.homeProgress = HOME_STRETCH;
        result.finished = true;
      } else {
        token.position = -2; // Special marker for "in home stretch"
        token.homeProgress = homePos;
      }
    } else {
      const newAbsPos = (startPos + newRel) % BOARD_SIZE;
      token.position = newAbsPos;

      // Check for captures
      const captureResult = checkCapture(gameState, player, newAbsPos, safePositions);
      if (captureResult) {
        result.captured = true;
        result.capturedPlayer = captureResult.playerIndex;
        result.capturedToken = captureResult.tokenIndex;
      }
    }
  }

  return result;
}

/**
 * Checks if any opponent token can be captured at the given position.
 */
function checkCapture(gameState, currentPlayer, position, safePositions) {
  if (safePositions.includes(position)) return null;

  for (let pi = 0; pi < gameState.players.length; pi++) {
    const otherPlayer = gameState.players[pi];
    if (otherPlayer.id === currentPlayer.id) continue;

    for (let ti = 0; ti < otherPlayer.tokens.length; ti++) {
      const otherToken = otherPlayer.tokens[ti];
      if (otherToken.position === position && otherToken.homeProgress === -1 && !otherToken.finished) {
        // Capture: send back to base
        otherToken.position = -1;
        otherToken.homeProgress = -1;
        return { playerIndex: pi, tokenIndex: ti };
      }
    }
  }
  return null;
}

/**
 * Checks if a player has won (all tokens finished).
 */
function checkWin(gameState) {
  for (const player of gameState.players) {
    if (player.tokens.every(t => t.finished)) {
      return player;
    }
  }
  return null;
}

/**
 * Advance to the next player's turn.
 */
function nextTurn(gameState, rolledSix) {
  if (rolledSix && gameState.consecutiveSixes < 2) {
    // Player gets another turn (up to 3 consecutive sixes)
    gameState.consecutiveSixes++;
    gameState.turnPhase = 'roll';
    return;
  }

  // Three consecutive sixes = lose turn
  gameState.consecutiveSixes = 0;
  gameState.currentPlayerIndex =
    (gameState.currentPlayerIndex + 1) % gameState.players.length;
  gameState.turnPhase = 'roll';
}

// ─── Socket.IO Event Handling ───────────────────────────────
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new room
  socket.on('create-room', (playerName, callback) => {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const room = {
      id: roomId,
      players: [{ id: socket.id, name: playerName }],
      gameState: null,
      started: false,
      chat: []
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.roomId = roomId;
    callback({ success: true, roomId, players: room.players });
    console.log(`Room ${roomId} created by ${playerName}`);
  });

  // Join an existing room
  socket.on('join-room', (data, callback) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId.toUpperCase());

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    if (room.started) {
      callback({ success: false, error: 'Game already started' });
      return;
    }
    if (room.players.length >= 4) {
      callback({ success: false, error: 'Room is full (max 4 players)' });
      return;
    }

    room.players.push({ id: socket.id, name: playerName });
    socket.join(roomId.toUpperCase());
    socket.roomId = roomId.toUpperCase();

    callback({ success: true, roomId: room.id, players: room.players });
    socket.to(room.id).emit('player-joined', { players: room.players });

    // Auto-start when 2+ players
    if (room.players.length >= 2 && !room.started) {
      setTimeout(() => {
        const currentRoom = rooms.get(room.id);
        if (currentRoom && !currentRoom.started && currentRoom.players.length >= 2) {
          currentRoom.started = true;
          currentRoom.gameState = createGameState(currentRoom.players);
          io.to(room.id).emit('game-start', {
            gameState: currentRoom.gameState
          });
          console.log(`Game started in room ${room.id}`);
        }
      }, 3000); // 3-second countdown
    }
  });

  // Dice roll
  socket.on('roll-dice', (callback) => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.gameState) return;

    const gs = room.gameState;
    const currentPlayer = gs.players[gs.currentPlayerIndex];

    if (currentPlayer.id !== socket.id) {
      callback({ success: false, error: 'Not your turn' });
      return;
    }
    if (gs.turnPhase !== 'roll') {
      callback({ success: false, error: 'Already rolled' });
      return;
    }

    const diceValue = Math.floor(Math.random() * 6) + 1;
    gs.diceValue = diceValue;

    const validMoves = getValidMoves(gs, diceValue);

    if (validMoves.length === 0) {
      // No valid moves, next turn
      gs.turnPhase = 'roll';
      nextTurn(gs, diceValue === 6);
      io.to(room.id).emit('dice-rolled', {
        diceValue,
        playerId: socket.id,
        validMoves: [],
        gameState: gs,
        autoSkip: true
      });
    } else {
      gs.turnPhase = 'move';
      io.to(room.id).emit('dice-rolled', {
        diceValue,
        playerId: socket.id,
        validMoves,
        gameState: gs,
        autoSkip: false
      });
    }

    callback({ success: true, diceValue });
  });

  // Move token
  socket.on('move-token', (data, callback) => {
    const room = rooms.get(socket.roomId);
    if (!room || !room.gameState) return;

    const gs = room.gameState;
    const currentPlayer = gs.players[gs.currentPlayerIndex];

    if (currentPlayer.id !== socket.id) {
      callback({ success: false, error: 'Not your turn' });
      return;
    }
    if (gs.turnPhase !== 'move') {
      callback({ success: false, error: 'Roll the dice first' });
      return;
    }

    const { tokenIndex } = data;
    const validMoves = getValidMoves(gs, gs.diceValue);

    const isValid = validMoves.some(m => m.tokenIndex === tokenIndex);
    if (!isValid) {
      callback({ success: false, error: 'Invalid move' });
      return;
    }

    const moveResult = executeMove(gs, tokenIndex, gs.diceValue);
    const rolledSix = gs.diceValue === 6;

    // Check for win
    const winner = checkWin(gs);
    if (winner) {
      gs.gameOver = true;
      gs.winner = winner;
      io.to(room.id).emit('game-over', { winner, gameState: gs });
      callback({ success: true });
      return;
    }

    // If captured, current player gets another turn
    if (moveResult.captured) {
      gs.turnPhase = 'roll';
      // Don't increment consecutiveSixes for capture bonus
    } else {
      nextTurn(gs, rolledSix);
    }

    io.to(room.id).emit('token-moved', {
      playerId: socket.id,
      tokenIndex,
      moveResult,
      gameState: gs
    });

    callback({ success: true });
  });

  // Chat message
  socket.on('chat-message', (message) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Sanitize message
    const sanitized = message.substring(0, 200).replace(/[<>]/g, '');
    const chatMsg = {
      playerName: player.name,
      message: sanitized,
      timestamp: Date.now()
    };

    room.chat.push(chatMsg);
    if (room.chat.length > 50) room.chat.shift(); // Keep last 50 messages

    io.to(room.id).emit('chat-message', chatMsg);
  });

  // Restart game
  socket.on('restart-game', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;

    room.gameState = createGameState(room.players);
    room.started = true;
    io.to(room.id).emit('game-restart', { gameState: room.gameState });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const room = rooms.get(socket.roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(socket.roomId);
      console.log(`Room ${socket.roomId} deleted (empty)`);
    } else {
      io.to(room.id).emit('player-left', {
        players: room.players,
        disconnectedId: socket.id
      });

      // If game was in progress and a player left, handle it
      if (room.gameState && !room.gameState.gameOver) {
        // Reassign game state
        room.gameState = createGameState(room.players);
        room.started = room.players.length >= 2;
        if (room.started) {
          io.to(room.id).emit('game-restart', { gameState: room.gameState });
        } else {
          room.started = false;
          io.to(room.id).emit('game-paused', { reason: 'Not enough players' });
        }
      }
    }
  });
});

// ─── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🎲 Ludo server running on http://localhost:${PORT}`);
});
