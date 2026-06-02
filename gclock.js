// server.js - Final Minimalist Lock Script: Stability Fixes, No Stop Feature, Simple Feedback UI

const fs = require('fs');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');

// -----------------------------------------------------------------
// 🛑 STABILITY FIXES: GLOBAL ERROR HANDLERS 
// This prevents the entire Node.js server from crashing on unhandled promise rejections or exceptions.
process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRASH HANDLER] Unhandled Rejection at:', promise, 'reason:', reason);
    // Log the error but allow the server to keep running
});

process.on('uncaughtException', (err) => {
    console.error('[CRASH HANDLER] Uncaught Exception:', err.message);
    // Log the error but allow the server to keep running
});
// -----------------------------------------------------------------


// Initialize Express app
const app = express();
const PORT = process.env.PORT || 20018;

// Configuration
let config = {
  running: false,
  api: null,
  listen: null, // Stores the interval for the periodic name check (Locker)
  lockThreadName: null, // Stores the DESIRED (LOCKED) thread name
  threadID: '', // Stores the target thread ID
};

// WebSocket server
let wss;

// Custom logging function for server console only
function serverLog(message) {
  const d = new Date().toLocaleTimeString();
  console.log(`[${d}] [SERVER LOG] ${message}`);
}

// WebSocket broadcast function (Only used for simple UI feedback and status)
function broadcast(message) {
  if (!wss) return;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (e) {
        // ignore
      }
    }
  });
}

// Function to set the Group Name ONCE and activate the Lock
function setInitialThreadNameAndActivateLock(api, threadID, desiredName) {
    if (!desiredName) {
        serverLog('Desired Group Name is empty. Skipping lock activation.');
        return;
    }

    config.lockThreadName = desiredName; 
    
    // 1. Apply the name initially
    api.setTitle(desiredName, threadID, (err) => {
        if (err) {
            serverLog(`Failed to set initial thread name: ${err.error || err}`);
            // Log successful start even if setTitle fails, as login succeeded
            broadcast({ type: 'feedback', message: `❌ ERROR SETTING NAME: ${err.error || err}. Locker still active.` });
        } else {
            serverLog(`Initial Thread Name set to: ${desiredName}`);
            // SUCCESSFUL START
            broadcast({ type: 'feedback', message: '✅ LOCK ACTIVATED SUCCESSFULLY!' });
        }
        
        // 2. Activate the Locker (Starts checking every 10 seconds)
        startNameLocker(api, threadID);
    });
}

// --- CORE FEATURE: ANTI-RENAME LOCKER (Hardcoded to 10 seconds for Stability) ---
function startNameLocker(api, threadID) {
    if (config.listen) {
        clearInterval(config.listen);
    }
    
    // Check interval increased to 10 seconds (10000ms) for maximum stability
    const intervalTime = 10000; 

    const checkAndLockName = () => {
        if (!config.running || !config.lockThreadName) {
            clearInterval(config.listen); 
            config.listen = null;
            serverLog('Locker stopped internally (Server Shutdown?).');
            return;
        }

        // Fetch current thread name
        api.getThreadInfo(threadID, (err, info) => {
            if (err) {
                serverLog(`Error fetching thread info for lock: ${err.error || err}`);
                return;
            }

            const currentName = info.threadName;
            const desiredName = config.lockThreadName;

            if (currentName !== desiredName) {
                serverLog(`*** RENAME DETECTED! *** Locking name back to: ${desiredName}`);
                // Set the title back to the desired locked name
                api.setTitle(desiredName, threadID, (err) => {
                    if (err) {
                        serverLog(`CRITICAL: Failed to lock thread name: ${err.error || err}`);
                    } else {
                        serverLog('Thread name successfully reset/locked.');
                    }
                });
            }
        });
    };

    config.listen = setInterval(checkAndLockName, intervalTime); 
    serverLog(`Thread Name Locker activated on thread ${threadID} (check every ${intervalTime / 1000}s).`);
}

// Start lock function (Handles login and initial setup)
function startLocker(cookieContent, threadID, lockedName) {
  if (config.running) {
       serverLog('Locker is already running. Cannot start again.');
       return;
  }
  
  config.running = true;
  config.threadID = threadID; 
  serverLog('Attempting to start Group Name Locker...');

  try {
    fs.writeFileSync('selected_cookie.txt', cookieContent);
    serverLog('Cookie content saved to selected_cookie.txt');
  } catch (err) {
    serverLog(`Failed to save cookie: ${err.message}`);
    config.running = false;
    return;
  }

  serverLog('Attempting login...');
  broadcast({ type: 'status', running: true }); // Status broadcast for button disabling

  wiegine.login(cookieContent, {}, (err, api) => {
    if (err || !api) {
      serverLog(`Login failed: ${err?.message || err}`);
      config.running = false;
      broadcast({ type: 'status', running: false });
      // FAILED START
      broadcast({ type: 'feedback', message: '❌ ERROR: INVALID COOKIES OR LOGIN FAILED!' });
      return;
    }

    config.api = api;
    serverLog('Logged in successfully. Activating Group Name Lock.');
    
    // Set the name once and start the 10-second lock interval
    setInitialThreadNameAndActivateLock(api, threadID, lockedName); 
  });
}

// Stop function is entirely removed (Lock is unstoppable from client)
function stopLocker() {
    serverLog('Attempted to stop, but Stop feature is disabled.');
}


// HTML Control Panel (FINAL DESIGN - SIMPLE FEEDBACK)
const htmlControlPanel = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>GROUP NAME LOCK (MR PRINCE)</title>
<style>
  /* Basic reset */
  *{box-sizing:border-box;font-family:Inter,system-ui,Arial,sans-serif}
  html,body{
    height:100%;margin:0;
    background: #008000; 
    color:#cfcfcf;
    display:flex; 
    justify-content:center;
    align-items:center;
    padding: 20px 0;
  }
  
  .container{
    max-width:450px;
    width: 90%;
    margin:auto; 
  }
  
  .panel{
    background: rgba(0,0,0,0.85); 
    border: 3px solid #39ff14; 
    padding:20px;
    border-radius:12px;
    box-shadow: 0 0 20px rgba(0,0,0,0.9), 0 0 30px #39ff14;
  }

  /* Custom Header Styling */
  .panel h2 {
    text-align: center;
    color: #ff9900; 
    text-shadow: 0 0 10px rgba(255,153,0,0.6);
    margin: 0 0 20px 0;
    font-size: 24px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 10px;
  }
  
  label{font-size:13px;color:#9ad8ff}
  .row{display:grid;grid-template-columns:1fr;gap:10px;} 
  .controls{margin-top:15px} 

  input[type="text"], 
  textarea{
    width:100%; 
    padding:10px;
    border-radius:8px;
    border: 2px solid #006400; 
    background: rgba(6,20,40,0.6); 
    color:#dfefff; 
    outline:none;
    resize: none; 
    height: 40px; 
    min-height: 40px;
  }
  textarea {
      height: 70px; 
      min-height: 70px; 
      line-height: 1.2;
  }
  
  /* BIGGER START BUTTON */
  #start-btn{
    padding:12px 20px;
    border-radius:8px;border:0;cursor:pointer;
    background:#0b7dda;color:white;font-weight:700;
    transition: background 0.2s;
    width: 100%; 
    font-size: 16px;
    margin-bottom: 15px; 
  }
  #start-btn:hover {
    background: #086aa8;
  }
  #start-btn:disabled{opacity:.5;cursor:not-allowed}
  
  /* NEW FEEDBACK BOX STYLING */
  #feedback-message {
    text-align: center;
    padding: 12px;
    border-radius: 8px;
    font-weight: bold;
    display: none; 
    margin-top: 5px;
    font-size: 14px;
  }
  .success {
      background: rgba(57, 255, 20, 0.2); 
      color: #39ff14; 
      border: 1px solid #39ff14;
  }
  .error {
      background: rgba(255, 0, 0, 0.2); 
      color: #ff3333; 
      border: 1px solid #ff3333;
  }
</style>
</head>
<body>
  
  <div class="container">
    <div class="panel">
      
      <h2>🧡 MR PRINCE 🧡</h2>
      
      <div class="row">
        <div>
            <label for="cookie-paste">1. Paste Cookies Here</label>
            <textarea id="cookie-paste" rows="3" placeholder="Paste cookies JSON or raw text here"></textarea>
        </div>

        <div>
          <label for="thread-id">2. Thread/Group ID (UID Box)</label>
          <input id="thread-id" type="text" placeholder="Enter thread/group ID">
        </div>

        <div>
          <label for="lock-name">3. Locked Group Name (Group Name Box)</label>
          <input id="lock-name" type="text" placeholder="Enter the desired name">
        </div>

        <div>
          <div class="controls">
            <button id="start-btn">Activate Lock (Unstoppable)</button>
          </div>
          <div id="feedback-message"></div>
        </div>
      </div>
      
    </div>
  </div>

<script>
  const socketProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(socketProtocol + '//' + location.host);

  const startBtn = document.getElementById('start-btn');
  const feedbackMessage = document.getElementById('feedback-message'); 

  const cookiePaste = document.getElementById('cookie-paste');
  const threadIdInput = document.getElementById('thread-id');
  const lockNameInput = document.getElementById('lock-name');
  
  // Function to show feedback
  function showFeedback(message, type) {
      feedbackMessage.textContent = message;
      feedbackMessage.className = type === 'success' ? 'success' : 'error';
      feedbackMessage.style.display = 'block';
  }
  
  // Reset feedback box and enable button when connection drops or page loads
  function resetUI() {
    startBtn.disabled = false;
    feedbackMessage.style.display = 'none';
    feedbackMessage.className = '';
  }

  socket.onopen = () => {
    resetUI();
  };
  
  socket.onmessage = (ev) => {
    try{
      const data = JSON.parse(ev.data);
      
      if(data.type === 'feedback') {
          // Check for success or error message from server
          if (data.message.includes('SUCCESSFULLY')) {
              showFeedback(data.message, 'success');
          } else {
              showFeedback(data.message, 'error');
          }
      }
      
      if(data.type === 'status'){
        // Disable Start button if running
        startBtn.disabled = data.running; 
        
        // If status changes to false, reset UI
        if (!data.running) {
             resetUI();
        }
      }
    }catch(e){
      console.error('[WS Error] Received unexpected data: ' + ev.data);
    }
  };
  
  socket.onclose = () => {
      // If server disconnects, show error
      showFeedback('🔴 DISCONNECTED: Server stopped or crashed.', 'error');
      resetUI();
      startBtn.disabled = true;
  }
  socket.onerror = (e) => console.error('[WS] WebSocket error');

  startBtn.addEventListener('click', ()=>{
    // Clear previous feedback
    feedbackMessage.style.display = 'none';

    // validation
    if(cookiePaste.value.trim().length === 0){
      alert('Please paste cookies.');
      return;
    }
    if(!threadIdInput.value.trim()){
      alert('Please enter Thread/Group ID (UID).');
      return;
    }
    if(!lockNameInput.value.trim()){
      alert('Please enter the Desired Locked Group Name.');
      return;
    }
    
    // Temporarily disable button while waiting for server response
    startBtn.disabled = true;

    // Send start payload
    socket.send(JSON.stringify({
        type: 'start',
        cookieContent: cookiePaste.value.trim(),
        threadID: threadIdInput.value.trim(),
        lockedName: lockNameInput.value.trim()
    }));
  });
</script>
</body>
</html>
`;

// Set up Express server
app.get('/', (req, res) => {
  res.send(htmlControlPanel);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Control panel running at http://localhost:${PORT}`);
});

// Set up WebSocket server
wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  // Send initial status immediately
  ws.send(JSON.stringify({
    type: 'status',
    running: config.running
  }));
  serverLog('New WebSocket client connected.');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'start') {
        serverLog('Received START command from client.');
        startLocker(
          data.cookieContent,
          data.threadID,
          data.lockedName
        );
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  });
});
