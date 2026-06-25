const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const BROADCASTER_PASSWORD = "supersecret"; // change this to your own password
let broadcasterId = null;

io.on('connection', (socket) => {
    console.log('New client:', socket.id);

    // Broadcaster tries to join
    socket.on('broadcaster-join', (password) => {
        if (password !== BROADCASTER_PASSWORD) {
            socket.emit('auth-failed', 'Wrong password');
            return;
        }
        if (broadcasterId !== null) {
            socket.emit('auth-failed', 'Another broadcaster is already active');
            return;
        }
        broadcasterId = socket.id;
        socket.emit('broadcaster-accepted'); // tell the client it's good
        socket.broadcast.emit('broadcaster-ready'); // tell listeners a stream is available
        console.log('Broadcaster connected:', socket.id);
    });

    // Listener wants to join
    socket.on('listener-join', () => {
        if (broadcasterId === null) {
            socket.emit('no-broadcaster');
            return;
        }
        // Tell broadcaster that a new listener is here
        io.to(broadcasterId).emit('new-listener', socket.id);
    });

    // Relay WebRTC signals
    socket.on('signal', ({ target, signal }) => {
        if (target === 'broadcaster' && broadcasterId) {
            io.to(broadcasterId).emit('signal', { from: socket.id, signal });
        } else {
            io.to(target).emit('signal', { from: socket.id, signal });
        }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
        if (socket.id === broadcasterId) {
            broadcasterId = null;
            io.emit('broadcaster-left');
            console.log('Broadcaster disconnected');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
