const socket = io();

let localStream;
let peerConnection;
let remoteSocketId = null;
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

function getActiveConversationToggle() {
  return document.getElementById('videoConversationToggle');
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

// Start Video Chat
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

function createPeerConnection() {
  if (peerConnection) return;
  peerConnection = new RTCPeerConnection(configuration);
  
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
  
  peerConnection.ontrack = (event) => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
    document.getElementById('buffering').style.display = 'none';
  };
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && remoteSocketId) {
      socket.emit('signal', {
        to: remoteSocketId,
        signalData: { candidate: event.candidate }
      });
    }
  };
}

function initiateCall() {
  createPeerConnection();
  peerConnection.createOffer().then(offer => {
    peerConnection.setLocalDescription(offer);
    socket.emit('signal', {
      to: remoteSocketId,
      signalData: { offer: offer }
    });
  }).catch(error => {
    console.error('Error creating offer:', error);
  });
}

// Socket event handlers
socket.on('waiting', (data) => {
  clearChatMessages('videoChatMessages');
  appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
  document.getElementById('videoChatSend').disabled = true;
  setToggleButton("find");
});

socket.on('paired', (data) => {
  remoteSocketId = data.partner;
  clearChatMessages('videoChatMessages');
  appendChatMessage('videoChatMessages', "System: Connected to a stranger.", "system");
  document.getElementById('videoChatSend').disabled = false;
  setToggleButton("end");
  if (data.initiator) {
    initiateCall();
  }
});

socket.on('signal', async (data) => {
  if (!remoteSocketId) remoteSocketId = data.from;
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
    } catch (err) {
      console.error('Error processing offer:', err);
    }
  } else if (data.signalData.answer) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signalData.answer));
    } catch (err) {
      console.error('Error processing answer:', err);
    }
  } else if (data.signalData.candidate) {
    try {
      await peerConnection.addIceCandidate(data.signalData.candidate);
    } catch (e) {
      console.error('Error adding ICE candidate:', e);
    }
  }
});

socket.on('chatMessage', (data) => {
  appendChatMessage('videoChatMessages', 'Stranger: ' + data.message, 'stranger');
});

socket.on('conversationEnded', (data) => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  clearChatMessages('videoChatMessages');
  appendChatMessage('videoChatMessages', "System: Stranger has disconnected.", "system");
  document.getElementById('videoChatSend').disabled = true;
  remoteSocketId = null;
  setToggleButton("find");
});

socket.on('updateOnlineCount', (count) => {
  document.getElementById('onlineCount').textContent = "Online Users: " + count;
});

// Event Listeners
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

document.getElementById('videoConversationToggle').addEventListener('click', conversationToggleHandler);

document.getElementById('muteBtn').addEventListener('click', () => {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
  document.getElementById('muteBtn').textContent = isMuted ? 'Unmute' : 'Mute';
});

document.getElementById('hideVideoBtn').addEventListener('click', () => {
  if (!localStream) return;
  isVideoHidden = !isVideoHidden;
  localStream.getVideoTracks().forEach(track => track.enabled = !isVideoHidden);
  document.getElementById('hideVideoBtn').textContent = isVideoHidden ? 'Show Video' : 'Hide Video';
});

function conversationToggleHandler() {
  if (remoteSocketId) {
    socket.emit('endConversation');
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    remoteSocketId = null;
    clearChatMessages('videoChatMessages');
    appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
    document.getElementById('videoChatSend').disabled = true;
    setToggleButton("find");
  } else {
    document.getElementById('buffering').style.display = 'block';
    clearChatMessages('videoChatMessages');
    appendChatMessage('videoChatMessages', "System: Waiting for a stranger...", "system");
    document.getElementById('videoChatSend').disabled = true;
    setToggleButton("find");
    socket.emit('findStranger', { mode: 'video' });
  }
}

// Start the video chat when page loads
window.onload = startVideoChat;
