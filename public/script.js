const socket = io();

let localStream;
let peerConnection;
let remoteSocketId = null;
let chatMode = null; // 'video' or 'text'
let isMuted = false;
let isVideoHidden = false;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Utility functions
function clearChatMessages(containerId) {
  document.getElementById(containerId).innerHTML = "";
}

function appendChatMessage(containerId, message, type = 'system') {
  const container = document.getElementById(containerId);
  const msgDiv = document.createElement('div');
  msgDiv.textContent = message;
  if (type === 'you') {
    msgDiv.classList.add('message-you');
  } else if (type === 'stranger') {
    msgDiv.classList.add('message-stranger');
  } else {
    msgDiv.classList.add('message-system');
  }
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// Helper to get the active conversation toggle button
function getActiveConversationToggle() {
  if (chatMode === 'video') {
    return document.getElementById('videoConversationToggle');
  } else if (chatMode === 'text') {
    return document.getElementById('textConversationToggle');
  }
  return null;
}

function setToggleButton(state) {
  // state: "find" or "end"
  const toggleButton = getActiveConversationToggle();
  if (!toggleButton) return;
  if (state === "find") {
    toggleButton.textContent = "Find Stranger";
    toggleButton.classList.remove("btn-end");
    toggleButton.classList.add("btn-find");
  } else if (state === "end") {
    toggleButton.textContent = "End Conversation";
    toggleButton.classList.remove("btn-find");
    toggleButton.classList.add("btn-end");
  }
}

// --- Mode Selection ---
document.getElementById('videoModeBtn').addEventListener('click', () => {
  chatMode = 'video';
  document.getElementById('chooseMode').style.display = 'none';
  document.getElementById('video-chat').style.display = 'block';
  document.getElementById('text-chat').style.display = 'none';
  setToggleButton("find");
  clearChatMessages('videoChatMessages');
  appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
  startVideoChat();
});

document.getElementById('textModeBtn').addEventListener('click', () => {
  chatMode = 'text';
  document.getElementById('chooseMode').style.display = 'none';
  document.getElementById('text-chat').style.display = 'block';
  document.getElementById('video-chat').style.display = 'none';
  setToggleButton("find");
  clearChatMessages('textChatMessages');
  appendChatMessage('textChatMessages', "System: Waiting for a stranger...", "system");
  startTextChat();
});

// --- Start Chat Functions ---
async function startVideoChat() {
  document.getElementById('buffering').style.display = 'block';
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    socket.emit('findStranger', { mode: 'video' });
  } catch (err) {
    console.error('Error accessing media devices.', err);
  }
}

function startTextChat() {
  socket.emit('findStranger', { mode: 'text' });
}

// --- RTCPeerConnection Setup (Video Mode Only) ---
function createPeerConnection() {
  if (peerConnection) return;
  peerConnection = new RTCPeerConnection(configuration);
  console.log('Created new RTCPeerConnection');
  
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
  
  peerConnection.ontrack = (event) => {
    console.log('Remote track received');
    document.getElementById('remoteVideo').srcObject = event.streams[0];
    document.getElementById('buffering').style.display = 'none';
  };
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && remoteSocketId) {
      console.log('Sending ICE candidate:', event.candidate);
      socket.emit('signal', {
        to: remoteSocketId,
        signalData: { candidate: event.candidate }
      });
    }
  };
  
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
  };
}

// --- Socket Event Handlers ---
socket.on('waiting', (data) => {
  console.log('Waiting:', data);
  if (chatMode === 'video') {
    clearChatMessages('videoChatMessages');
    appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
    document.getElementById('videoChatSend').disabled = true;
    setToggleButton("find");
  } else if (chatMode === 'text') {
    clearChatMessages('textChatMessages');
    appendChatMessage('textChatMessages', "System: Waiting for a stranger...", "system");
    document.getElementById('textChatSend').disabled = true;
    setToggleButton("find");
  }
});

socket.on('paired', (data) => {
  console.log('Paired:', data);
  remoteSocketId = data.partner;
  if (chatMode === 'video') {
    clearChatMessages('videoChatMessages');
    appendChatMessage('videoChatMessages', "System: Connected to a stranger.", "system");
    document.getElementById('videoChatSend').disabled = false;
    setToggleButton("end");
    if (data.initiator) {
      console.log('I am the initiator, creating offer...');
      initiateCall();
    }
  } else if (chatMode === 'text') {
    clearChatMessages('textChatMessages');
    appendChatMessage('textChatMessages', "System: Connected to a stranger.", "system");
    document.getElementById('textChatSend').disabled = false;
    setToggleButton("end");
    console.log('Text chat partner found:', data.partner);
  }
});

socket.on('signal', async (data) => {
  console.log('Received signal:', data);
  if (!remoteSocketId) remoteSocketId = data.from;
  if (chatMode === 'video') {
    if (data.signalData.offer) {
      createPeerConnection();
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signalData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', {
          to: remoteSocketId,
          signalData: { answer: answer }
        });
        console.log('Answer sent');
      } catch (err) {
        console.error('Error processing offer:', err);
      }
    } else if (data.signalData.answer) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signalData.answer));
        console.log('Remote description set with answer');
      } catch (err) {
        console.error('Error processing answer:', err);
      }
    } else if (data.signalData.candidate) {
      try {
        await peerConnection.addIceCandidate(data.signalData.candidate);
        console.log('Added ICE candidate');
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    }
  }
});

socket.on('chatMessage', (data) => {
  console.log('Chat message:', data);
  if (chatMode === 'video') {
    appendChatMessage('videoChatMessages', 'Stranger: ' + data.message, 'stranger');
  } else if (chatMode === 'text') {
    appendChatMessage('textChatMessages', 'Stranger: ' + data.message, 'stranger');
  }
});

socket.on('conversationEnded', (data) => {
  console.log('Conversation ended:', data);
  if (chatMode === 'video') {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    clearChatMessages('videoChatMessages');
    appendChatMessage('videoChatMessages', "System: Stranger has disconnected.", "system");
    document.getElementById('videoChatSend').disabled = true;
  } else if (chatMode === 'text') {
    clearChatMessages('textChatMessages');
    appendChatMessage('textChatMessages', "System: Stranger has disconnected.", "system");
    document.getElementById('textChatSend').disabled = true;
  }
  remoteSocketId = null;
  setToggleButton("find");
});

socket.on('updateOnlineCount', (count) => {
  document.getElementById('onlineCount').textContent = "Online Users: " + count;
});

// --- Video Mode: Initiate Call ---
function initiateCall() {
  createPeerConnection();
  peerConnection.createOffer().then(offer => {
    peerConnection.setLocalDescription(offer);
    socket.emit('signal', {
      to: remoteSocketId,
      signalData: { offer: offer }
    });
    console.log('Offer sent');
  }).catch(error => {
    console.error('Error creating offer:', error);
  });
}

// --- Sending Chat Messages ---
// Video Chat Mode
document.getElementById('videoChatSend').addEventListener('click', () => {
  const input = document.getElementById('videoChatInput');
  const message = input.value.trim();
  if (!remoteSocketId) {
    clearChatMessages('videoChatMessages');
    appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
    return;
  }
  if (message) {
    appendChatMessage('videoChatMessages', 'You: ' + message, 'you');
    socket.emit('chatMessage', { message: message });
    input.value = '';
  }
});

// Video Chat Mode – also send on Enter key press.
document.getElementById('videoChatSend').addEventListener('click', () => {
  const input = document.getElementById('videoChatInput');
  const message = input.value.trim();
  if (!remoteSocketId) {
    clearChatMessages('videoChatMessages');
    appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
    return;
  }
  if (message) {
    appendChatMessage('videoChatMessages', 'You: ' + message, 'you');
    socket.emit('chatMessage', { message: message });
    input.value = '';
  }
});

document.getElementById('videoChatInput').addEventListener('keydown', (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById('videoChatSend').click();
  }
});

// Text Chat Mode – also send on Enter key press.
document.getElementById('textChatSend').addEventListener('click', () => {
  const input = document.getElementById('textChatInput');
  const message = input.value.trim();
  if (!remoteSocketId) {
    clearChatMessages('textChatMessages');
    appendChatMessage('textChatMessages', "System: Waiting for a stranger...", "system");
    return;
  }
  if (message) {
    appendChatMessage('textChatMessages', 'You: ' + message, 'you');
    socket.emit('chatMessage', { message: message });
    input.value = '';
  }
});

document.getElementById('textChatInput').addEventListener('keydown', (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById('textChatSend').click();
  }
});

// --- Conversation Toggle Handler ---
function conversationToggleHandler() {
  if (remoteSocketId) {
    // End active conversation.
    socket.emit('endConversation');
    if (chatMode === 'video' && peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    remoteSocketId = null;
    if (chatMode === 'video') {
      clearChatMessages('videoChatMessages');
      appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
      document.getElementById('videoChatSend').disabled = true;
    } else {
      clearChatMessages('textChatMessages');
      appendChatMessage('textChatMessages', "System: Waiting for a stranger...", "system");
      document.getElementById('textChatSend').disabled = true;
    }
    setToggleButton("find");
  } else {
    // No active conversation: start a new search.
    if (chatMode === 'video') {
      document.getElementById('buffering').style.display = 'block';
      clearChatMessages('videoChatMessages');
      appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
      document.getElementById('videoChatSend').disabled = true;
    } else {
      clearChatMessages('textChatMessages');
      appendChatMessage('textChatMessages', "System: Waiting for a stranger...", "system");
      document.getElementById('textChatSend').disabled = true;
    }
    setToggleButton("find");
    socket.emit('findStranger', { mode: chatMode });
  }
}

// Attach toggle event handlers to both buttons.
document.getElementById('videoConversationToggle')?.addEventListener('click', conversationToggleHandler);
document.getElementById('textConversationToggle')?.addEventListener('click', conversationToggleHandler);

// --- Video Chat Controls ---
document.getElementById('muteBtn')?.addEventListener('click', () => {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
  document.getElementById('muteBtn').textContent = isMuted ? 'Unmute' : 'Mute';
});

document.getElementById('hideVideoBtn')?.addEventListener('click', () => {
  if (!localStream) return;
  isVideoHidden = !isVideoHidden;
  localStream.getVideoTracks().forEach(track => track.enabled = !isVideoHidden);
  document.getElementById('hideVideoBtn').textContent = isVideoHidden ? 'Show Video' : 'Hide Video';
});
