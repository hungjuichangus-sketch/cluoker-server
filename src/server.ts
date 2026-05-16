import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { Card } from './types';
import type { Room } from './types';
import { buildPlayerView, processMakeGuess, processPlayClue } from './gameLogic';
import { buildLobbyView, createRoom, getRoom, joinRoom, leaveRoom, restartRoom, startRoom } from './rooms';

const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

function broadcastGame(room: Room): void {
  room.players.forEach((player) => {
    io.to(player.socketId).emit('game_updated', buildPlayerView(room, player.socketId));
  });
}

io.on('connection', (socket) => {
  console.log(`+ ${socket.id}`);

  socket.on('create_room', ({ playerName }: { playerName: string }) => {
    const { room } = createRoom(socket.id, playerName);
    socket.join(room.code);
    socket.emit('room_created', { roomCode: room.code, playerId: socket.id });
    io.to(room.code).emit('room_updated', buildLobbyView(room));
  });

  socket.on('join_room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const result = joinRoom(socket.id, roomCode, playerName);
    if ('error' in result) { socket.emit('room_error', { message: result.error }); return; }
    socket.join(result.room.code);
    socket.emit('room_joined', { roomCode: result.room.code, playerId: socket.id });
    io.to(result.room.code).emit('room_updated', buildLobbyView(result.room));
  });

  socket.on('start_game', ({ roomCode }: { roomCode: string }) => {
    const result = startRoom(socket.id, roomCode);
    if ('error' in result) { socket.emit('game_error', { message: result.error }); return; }
    broadcastGame(result.room);
  });

  socket.on('play_clue', ({ roomCode, cardIndex }: { roomCode: string; cardIndex: number }) => {
    const room = getRoom(roomCode);
    if (!room) { socket.emit('game_error', { message: 'Room not found.' }); return; }
    const result = processPlayClue(room, socket.id, cardIndex);
    if ('error' in result) { socket.emit('game_error', { message: result.error }); return; }
    broadcastGame(room);
  });

  socket.on('make_guess', ({ roomCode, card }: { roomCode: string; card: Card }) => {
    const room = getRoom(roomCode);
    if (!room) { socket.emit('game_error', { message: 'Room not found.' }); return; }
    const result = processMakeGuess(room, socket.id, card);
    if ('error' in result) { socket.emit('game_error', { message: result.error }); return; }
    broadcastGame(room);
  });

  socket.on('restart_game', ({ roomCode }: { roomCode: string }) => {
    const result = restartRoom(socket.id, roomCode);
    if ('error' in result) { socket.emit('game_error', { message: result.error }); return; }
    io.to(result.room.code).emit('room_updated', buildLobbyView(result.room));
  });

  socket.on('disconnect', () => {
    console.log(`- ${socket.id}`);
    const room = leaveRoom(socket.id);
    if (room) io.to(room.code).emit('room_updated', buildLobbyView(room));
  });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => console.log(`Cluoker server on :${PORT}`));
