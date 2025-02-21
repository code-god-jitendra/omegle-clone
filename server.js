const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from "public"
app.use(express.static('public'));

// Two waiting queues: one for video and one for text
let waitingVideo = [];
let waitingText = [];
let pairedUsers = {}; // mapping: socket.id => partnerSocketId
let onlineCount = 0;

io.on('connection', (socket) => {
  onlineCount++;
  io.emit('updateOnlineCount', onlineCount);
  console.log(`User connected: ${socket.id} (Online: ${onlineCount})`);

  // "findStranger" event carries a mode ("video" or "text")
  socket.on('findStranger', (data) => {
    const mode = data.mode;
    if (mode === 'video') {
      if (waitingVideo.length > 0) {
        const partner = waitingVideo.shift();
        if (partner.id === socket.id) {
          waitingVideo.push(socket);
          return;
        }
        pairedUsers[socket.id] = partner.id;
        pairedUsers[partner.id] = socket.id;
        // Designate the waiting partner as initiator.
        partner.emit('paired', { partner: socket.id, initiator: true });
        socket.emit('paired', { partner: partner.id, initiator: false });
        console.log(`(Video) Paired ${socket.id} with ${partner.id}`);
      } else {
        waitingVideo.push(socket);
        socket.emit('waiting', { message: 'Waiting for a stranger in video mode...' });
        console.log(`${socket.id} is waiting in video mode`);
      }
    } else if (mode === 'text') {
      if (waitingText.length > 0) {
        const partner = waitingText.shift();
        if (partner.id === socket.id) {
          waitingText.push(socket);
          return;
        }
        pairedUsers[socket.id] = partner.id;
        pairedUsers[partner.id] = socket.id;
        partner.emit('paired', { partner: socket.id, initiator: true });
        socket.emit('paired', { partner: partner.id, initiator: false });
        console.log(`(Text) Paired ${socket.id} with ${partner.id}`);
      } else {
        waitingText.push(socket);
        socket.emit('waiting', { message: 'Waiting for a stranger in text mode...' });
        console.log(`${socket.id} is waiting in text mode`);
      }
    }
  });

  // Relay WebRTC signaling messages.
  socket.on('signal', (data) => {
    console.log(`Relaying signal from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('signal', { from: socket.id, signalData: data.signalData });
  });

  // Relay text chat messages.
  socket.on('chatMessage', (data) => {
    const partnerId = pairedUsers[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('chatMessage', { from: socket.id, message: data.message });
      console.log(`Relayed chat message from ${socket.id} to ${partnerId}`);
    }
  });

  // End conversation event.
  socket.on('endConversation', () => {
    const partnerId = pairedUsers[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('conversationEnded', { message: 'The other user ended the conversation.' });
      delete pairedUsers[socket.id];
      delete pairedUsers[partnerId];
      console.log(`Conversation between ${socket.id} and ${partnerId} ended.`);
    }
  });

  socket.on('disconnect', () => {
    onlineCount--;
    io.emit('updateOnlineCount', onlineCount);
    console.log(`User disconnected: ${socket.id} (Online: ${onlineCount})`);

    // Remove from waiting queues.
    waitingVideo = waitingVideo.filter(s => s.id !== socket.id);
    waitingText = waitingText.filter(s => s.id !== socket.id);

    const partnerId = pairedUsers[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('conversationEnded', { message: 'The other user disconnected.' });
      delete pairedUsers[partnerId];
      delete pairedUsers[socket.id];
      console.log(`Conversation ended due to disconnect: ${socket.id} and ${partnerId}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
