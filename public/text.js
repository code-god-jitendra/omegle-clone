const socket = io();

let remoteSocketId = null;

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
  return document.getElementById('textConversationToggle');
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

// Start Text Chat
function startTextChat() {
  socket.emit('findStranger', { mode: 'text' });
}

// Socket event handlers
socket.on('waiting', (data) => {
  clearChatMessages('textChatMessages');
  appendChatMessage('textChatMessages', "System: Waiting for a stranger...", "system");
  document.getElementById('textChatSend').disabled = true;
  setToggleButton("find");
});

socket.on('paired', (data) => {
  remoteSocketId = data.partner;
  clearChatMessages('textChatMessages');
  appendChatMessage('textChatMessages', "System: Connected to a stranger.", "system");
  document.getElementById('textChatSend').disabled = false;
  setToggleButton("end");
});

socket.on('chatMessage', (data) => {
  appendChatMessage('textChatMessages', 'Stranger: ' + data.message, 'stranger');
});

socket.on('conversationEnded', (data) => {
  clearChatMessages('textChatMessages');
  appendChatMessage('textChatMessages', "System: Stranger has disconnected.", "system");
  document.getElementById('textChatSend').disabled = true;
  remoteSocketId = null;
  setToggleButton("find");
});

socket.on('updateOnlineCount', (count) => {
  document.getElementById('onlineCount').textContent = "Online Users: " + count;
});

// Event Listeners
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

document.getElementById('textConversationToggle').addEventListener('click', conversationToggleHandler);

function conversationToggleHandler() {
  if (remoteSocketId) {
    socket.emit('endConversation');
    remoteSocketId = null;
    clearChatMessages('textChatMessages');
    appendChatMessage('textChatMessages', "System: Waiting for a stranger...", "system");
    document.getElementById('textChatSend').disabled = true;
    setToggleButton("find");
  } else {
    clearChatMessages('textChatMessages');
    appendChatMessage('textChatMessages', "System: Waiting for a stranger...", "system");
    document.getElementById('textChatSend').disabled = true;
    setToggleButton("find");
    socket.emit('findStranger', { mode: 'text' });
  }
}

function scrollToBottom() {
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addChatMessage(sender, text) {
    const chatMessages = document.querySelector('.chat-messages');
    const msgDiv = document.createElement('div');

    // Add appropriate class based on sender
    if (sender === 'you') {
        msgDiv.classList.add('message-you');
    } else if (sender === 'stranger') {
        msgDiv.classList.add('message-stranger');
    } else {
        msgDiv.classList.add('message-system');
    }

    msgDiv.innerText = text;
    chatMessages.appendChild(msgDiv);

    // Scroll to the bottom after adding the message
    scrollToBottom();
}

// Start text chat on page load
window.onload = startTextChat;
