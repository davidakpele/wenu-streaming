// StreamSphere Application
const API_URL = 'https://wemu.onrender.com';
const LOGIN_ENDPOINT = '/api/Auth/login';
const REGISTER_ENDPOINT = '/api/Auth/register';
const STREAMS_LIST_ENDPOINT = '/api/Streams/active';

// Application State
let currentUser = null;
let accessToken = null;
let client = null;
let currentRoomId = null;
let isHost = false;
let streamStartTime = null;
let durationInterval = null;
let audioProducerId = null;
let videoProducerId = null;
let audioEnabled = true;
let videoEnabled = true;
let streamsListInterval = null;
let currentStreamType = 'audio';

// DOM Elements
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const authSubtitle = document.getElementById('authSubtitle');

// Main App Elements
const streamsListSection = document.getElementById('streamsListSection');
const streamViewSection = document.getElementById('streamViewSection');
const activeStreamsList = document.getElementById('activeStreamsList');
const startOwnStreamBtn = document.getElementById('startOwnStreamBtn');
const backBtn = document.getElementById('backBtn');
const menuBtn = document.getElementById('menuBtn');

// Menu Modal
const menuModal = document.getElementById('menuModal');
const closeMenuModal = document.getElementById('closeMenuModal');
const logoutBtn = document.getElementById('logoutBtn');

// Start Stream Modal
const startStreamModal = document.getElementById('startStreamModal');
const closeStartStreamModal = document.getElementById('closeStartStreamModal');
const startStreamForm = document.getElementById('startStreamForm');

// Stream Elements
const localVideo = document.getElementById('localVideo');
const remoteVideosContainer = document.getElementById('remoteVideosContainer');
const streamTitle = document.getElementById('streamTitle');
const streamerAvatar = document.getElementById('streamerAvatar');
const shareBtn = document.getElementById('shareBtn');

// Control Buttons
const toggleAudioBtn = document.getElementById('toggleAudioBtn');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const startMediaBtn = document.getElementById('startMediaBtn');
const leaveStreamBtn = document.getElementById('leaveStreamBtn');
const endStreamBtn = document.getElementById('endStreamBtn');

// Chat Elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');

// Stats
const viewerCount = document.getElementById('viewerCount');
const viewerCountBadge = document.getElementById('viewerCountBadge');
const streamDuration = document.getElementById('streamDuration');

// Viewers
const viewersList = document.getElementById('viewersList');
const viewersModal = document.getElementById('viewersModal');
const closeViewersModal = document.getElementById('closeViewersModal');
const viewersModalList = document.getElementById('viewersModalList');
const viewerCountModal = document.getElementById('viewerCountModal');

// Confirmation Modal
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
const closeConfirmModal = document.getElementById('closeConfirmModal');
let confirmResolve = null;

// ===== CONFIRMATION MODAL =====
function showConfirm(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmModal.style.display = 'flex';
        confirmResolve = resolve;
    });
}

confirmOk.addEventListener('click', () => {
    if (confirmResolve) {
        confirmResolve(true);
        confirmResolve = null;
    }
    confirmModal.style.display = 'none';
});

confirmCancel.addEventListener('click', () => {
    if (confirmResolve) {
        confirmResolve(false);
        confirmResolve = null;
    }
    confirmModal.style.display = 'none';
});

closeConfirmModal.addEventListener('click', () => {
    if (confirmResolve) {
        confirmResolve(false);
        confirmResolve = null;
    }
    confirmModal.style.display = 'none';
});

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info', title = '') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        warning: '⚠'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== AUTHENTICATION =====
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    authSubtitle.textContent = 'Create an account to get started';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    authSubtitle.textContent = 'Sign in to start or join a stream';
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showToast('Please enter both username and password', 'error');
        return;
    }
    
    await login(username, password);
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    if (!email || !username || !firstName || !lastName || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    await register(email, username, firstName, lastName, password);
});

async function register(email, username, firstName, lastName, password) {
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-loading');
        submitBtn.textContent = 'Creating account...';
        
        const response = await fetch(`${API_URL}${REGISTER_ENDPOINT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, firstName, lastName, password })
        });
        
        const result = await response.json();

        if (!response.ok || !result?.id) {
            throw new Error('Registration failed');
        }

        showToast('Account created successfully! Please sign in.', 'success');
        
        registerForm.reset();
        setTimeout(() => {
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            authSubtitle.textContent = 'Sign in to start or join a stream';
        }, 1500);
        
    } catch (error) {
        console.error('Registration error:', error);
        showToast(error.message || 'Failed to create account', 'error');
    } finally {
        // Remove loading state
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.textContent = originalText;
    }
}

async function login(username, password) {
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    try {
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-loading');
        submitBtn.textContent = 'Signing in...';
        
        const response = await fetch(`${API_URL}${LOGIN_ENDPOINT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName: username, password })
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Login failed');
        }
        
        currentUser = {
            id: result.data.id,
            username: result.data.userName,
            firstName: result.data.firstName,
            lastName: result.data.lastName
        };
        accessToken = result.data.token;
        
        localStorage.setItem('user', JSON.stringify(currentUser));
        localStorage.setItem('token', accessToken);
        
        await initializeApp();
        
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message || 'Failed to login', 'error');
    } finally {
        // Remove loading state
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.textContent = originalText;
    }
}

async function initializeApp() {
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    
    const initials = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();
    streamerAvatar.textContent = initials;
    
    await initStreamingClient();
    showStreamsList();
    startStreamsListPolling();
}

// ===== STREAMING CLIENT =====
async function initStreamingClient() {
    client = new StreamingClient(API_URL, accessToken);
    
    client.onStreamStarted = handleStreamStarted;
    client.onJoinedStream = handleJoinedStream;
    client.onUserJoined = handleUserJoined;
    client.onUserLeft = handleUserLeft;
    client.onMessageReceived = handleMessageReceived;
    client.onStreamEnded = handleStreamEnded;
    client.onRemoteStream = handleRemoteStream;
    client.onProducerPaused = handleProducerPaused;
    client.onProducerResumed = handleProducerResumed;
    client.onProducerClosed = handleProducerClosed;
    client.onNewProducer = handleNewProducer;

    try {
        await client.connect();
        console.log('Connected to streaming hub');
        showToast('Connected to streaming service', 'success');
    } catch (error) {
        console.error('Failed to connect:', error);
        showToast('Failed to connect to streaming service', 'error');
    }
}

// ===== STREAMS LIST =====
async function fetchActiveStreams() {
    try {
        const response = await fetch(`${API_URL}${STREAMS_LIST_ENDPOINT}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error fetching streams:', error);
    }
    return [];
}

async function displayStreamsList() {
    const streams = await fetchActiveStreams();
    
    if (streams.length === 0) {
        activeStreamsList.innerHTML = '<div class="no-streams">No active streams available</div>';
        return;
    }
    
    activeStreamsList.innerHTML = '';
    
    streams.forEach(stream => {
        const streamCard = document.createElement('div');
        streamCard.className = 'stream-card';
        
        const duration = calculateDuration(stream.startTime);
        const icon = stream.type === 'video' ? '📹' : '🎙️';
        
        streamCard.innerHTML = `
            <div class="stream-card-thumbnail">
                <span class="stream-card-live">LIVE</span>
                <span class="stream-card-viewers">👁 ${stream.currentViewers}</span>
                <span class="stream-card-icon">${icon}</span>
            </div>
            <div class="stream-card-content">
                <h4 class="stream-card-title">${escapeHtml(stream.title)}</h4>
                <p class="stream-card-description">${escapeHtml(stream.description)}</p>
                <div class="stream-card-meta">
                    <span>🎙️ ${escapeHtml(stream.host.username)}</span>
                    <span>⏱️ ${duration}</span>
                    <span>📁 ${escapeHtml(stream.category)}</span>
                </div>
                <button class="stream-card-join">Join Stream</button>
            </div>
        `;
        
        const joinBtn = streamCard.querySelector('.stream-card-join');
        joinBtn.addEventListener('click', () => joinStreamById(stream.roomId));
        
        activeStreamsList.appendChild(streamCard);
    });
}

function calculateDuration(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showStreamsList() {
    streamsListSection.style.display = 'block';
    streamViewSection.style.display = 'none';
    backBtn.style.visibility = 'hidden';
    displayStreamsList();
}

function hideStreamsList() {
    streamsListSection.style.display = 'none';
    streamViewSection.style.display = 'flex';
    backBtn.style.visibility = 'visible';
}

function startStreamsListPolling() {
    if (streamsListInterval) clearInterval(streamsListInterval);
    streamsListInterval = setInterval(() => {
        if (!currentRoomId && streamsListSection.style.display !== 'none') {
            displayStreamsList();
        }
    }, 5000);
}

function stopStreamsListPolling() {
    if (streamsListInterval) {
        clearInterval(streamsListInterval);
        streamsListInterval = null;
    }
}

// ===== START STREAM =====
startOwnStreamBtn.addEventListener('click', () => {
    startStreamModal.style.display = 'flex';
});

closeStartStreamModal.addEventListener('click', () => {
    startStreamModal.style.display = 'none';
});

startStreamForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('streamTitleInput').value.trim();
    const description = document.getElementById('streamDescription').value.trim();
    const category = document.getElementById('streamCategory').value;
    const type = document.querySelector('input[name="streamType"]:checked').value;
    
    currentStreamType = type;
    startStreamModal.style.display = 'none';
    
    try {
        await client.startStream(
            currentUser.username,
            currentUser.id,
            title,
            description,
            category,
            'public',
            type
        );
    } catch (error) {
        showToast('Failed to start stream', 'error');
    }
});

async function joinStreamById(roomId) {
    try {
        await client.joinStream(roomId, currentUser.id, currentUser.username);
    } catch (error) {
        showToast('Failed to join stream', 'error');
    }
}

// ===== STREAM EVENT HANDLERS =====
function handleStreamStarted(data) {
    currentRoomId = data.data.stream.roomid;
    isHost = true;
    streamStartTime = new Date(data.data.status.start_time);
    
    hideStreamsList();
    updateUI();
    startDurationTimer();
    
    streamTitle.textContent = data.data.stream.title;
    
    showToast('Stream started successfully!', 'success', 'Live');
    addSystemMessage(`Stream started: ${data.data.stream.title}`);
}

function handleJoinedStream(data) {
    currentRoomId = data.data.stream.roomid;
    client.currentRoomId = currentRoomId;
    streamStartTime = new Date(data.data.status.start_time);
    
    hideStreamsList();
    updateUI();
    startDurationTimer();
    
    streamTitle.textContent = data.data.stream.title;
    viewerCount.textContent = data.data.status.current_viewers;
    if (viewerCountBadge) viewerCountBadge.textContent = data.data.status.current_viewers;
    
    updateViewersList(data.data.participants.users_list);
    
    showToast('Joined stream successfully!', 'success');
    addSystemMessage('Welcome to the stream!');
}

function handleUserJoined(data) {
    viewerCount.textContent = data.current_viewers;
    if (viewerCountBadge) viewerCountBadge.textContent = data.current_viewers;
    if (viewerCountModal) viewerCountModal.textContent = data.current_viewers;
    
    updateViewersList(data.participants);
    showToast(`${data.message}`, 'info');
}

function handleUserLeft(data) {
    viewerCount.textContent = data.current_viewers;
    if (viewerCountBadge) viewerCountBadge.textContent = data.current_viewers;
    if (viewerCountModal) viewerCountModal.textContent = data.current_viewers;
    
    updateViewersList(data.participants);
    showToast(`${data.message}`, 'info');
}

function handleMessageReceived(data) {
    if (data.type === 'system') {
        addSystemMessage(data.content);
    } else {
        addMessage(data.sender.username, data.content, data.timestamp);
    }
}

function handleStreamEnded(data) {
    showToast(data.message, 'warning', 'Stream Ended');
    cleanup();
}

function handleRemoteStream(stream, producerUserId, kind) {
    console.log('handleRemoteStream called:', { producerUserId, kind, stream });
    
    let videoElement = document.getElementById(`remote-${producerUserId}`);
    
    if (!videoElement) {
        const wrapper = document.createElement('div');
        wrapper.className = 'remote-video-wrapper';
        wrapper.id = `wrapper-${producerUserId}`;
        
        videoElement = document.createElement('video');
        videoElement.id = `remote-${producerUserId}`;
        videoElement.autoplay = true;
        videoElement.playsinline = true;
        videoElement.setAttribute('playsinline', '');
        
        const label = document.createElement('div');
        label.className = 'remote-video-label';
        label.textContent = 'Remote';
        
        wrapper.appendChild(videoElement);
        wrapper.appendChild(label);
        remoteVideosContainer.appendChild(wrapper);
    }
    
    if (!videoElement.srcObject) {
        videoElement.srcObject = stream;
        videoElement.play().catch(err => console.error('Error playing video:', err));
    }
}

function handleProducerPaused(data) {
    addSystemMessage(`${data.kind} paused`);
}

function handleProducerResumed(data) {
    addSystemMessage(`${data.kind} resumed`);
}

function handleProducerClosed(data) {
    const wrapper = document.getElementById(`wrapper-${data.producerId}`);
    if (wrapper) wrapper.remove();
}

function handleNewProducer(data) {
    console.log('New producer detected:', data);
    if (client && client.currentRoomId) {
        client.consumeMedia(client.currentRoomId, data.producerId);
    }
}

// ===== MEDIA CONTROLS =====
startMediaBtn.addEventListener('click', async () => {
    try {
        const constraints = {
            audio: true,
            video: currentStreamType === 'video'
        };
        
        const localStream = await client.startProducing(currentRoomId, constraints);
        localVideo.srcObject = localStream;
        
        const producers = Array.from(client.producers.entries());
        audioProducerId = producers.find(([id, kind]) => kind === 'audio')?.[0];
        videoProducerId = producers.find(([id, kind]) => kind === 'video')?.[0];
        
        updateUI();
        showToast('Broadcasting started!', 'success');
    } catch (err) {
        console.error('Failed to start media:', err);
        showToast('Failed to start camera/microphone', 'error');
    }
});

toggleAudioBtn.addEventListener('click', async () => {
    if (audioProducerId) {
        if (audioEnabled) {
            await client.pauseProducer(currentRoomId, audioProducerId);
            toggleAudioBtn.querySelector('span').textContent = 'UNMUTE';
            showToast('Audio muted', 'info');
        } else {
            await client.resumeProducer(currentRoomId, audioProducerId);
            toggleAudioBtn.querySelector('span').textContent = 'MUTE';
            showToast('Audio unmuted', 'info');
        }
        audioEnabled = !audioEnabled;
    }
});

toggleVideoBtn.addEventListener('click', async () => {
    if (videoProducerId) {
        if (videoEnabled) {
            await client.pauseProducer(currentRoomId, videoProducerId);
            toggleVideoBtn.querySelector('span').textContent = 'START VIDEO';
            showToast('Video stopped', 'info');
        } else {
            await client.resumeProducer(currentRoomId, videoProducerId);
            toggleVideoBtn.querySelector('span').textContent = 'STOP VIDEO';
            showToast('Video started', 'info');
        }
        videoEnabled = !videoEnabled;
    }
});

leaveStreamBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('Are you sure you want to leave the stream?', 'Leave Stream');
    if (confirmed) {
        await client.leaveStream(currentRoomId);
        cleanup();
        showToast('Left stream', 'info');
    }
});

endStreamBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('Are you sure you want to end the stream? This will disconnect all viewers.', 'End Stream');
    if (confirmed) {
        await client.endStream(currentRoomId);
        cleanup();
        showToast('Stream ended', 'success');
    }
});

shareBtn.addEventListener('click', async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'StreamSphere Live Stream',
                text: `Watch this live stream on StreamSphere!`,
                url: window.location.href
            });
            showToast('Shared successfully!', 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                copyToClipboard(window.location.href);
                showToast('Link copied to clipboard!', 'success');
            }
        }
    } else {
        copyToClipboard(window.location.href);
        showToast('Link copied to clipboard!', 'success');
    }
});

// ===== CHAT =====
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        sendMessage();
    }
});

sendMessageBtn.addEventListener('click', () => {
    if (chatInput.value.trim()) {
        sendMessage();
    }
});

async function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
        try {
            await client.sendMessage(currentRoomId, message);
            chatInput.value = '';
        } catch (error) {
            showToast('Failed to send message', 'error');
        }
    }
}

function addMessage(sender, content, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    const time = new Date(timestamp).toLocaleTimeString();
    const initials = sender.substring(0, 2).toUpperCase();
    
    messageDiv.innerHTML = `
        <div class="chat-avatar">${initials}</div>
        <div class="chat-content">
            <span class="chat-username">${escapeHtml(sender)}</span>
            <p class="chat-text">${escapeHtml(content)}</p>
            <span class="chat-time">${time}</span>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== VIEWERS =====
function updateViewersList(participants) {
    if (!participants || participants.length === 0) {
        if (viewersList) viewersList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No viewers yet</p>';
        if (viewersModalList) viewersModalList.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No viewers yet</p>';
        return;
    }
    
    const viewersHTML = participants.map(p => {
        const initials = p.username.substring(0, 2).toUpperCase();
        return `
            <div class="viewer-item">
                <div class="viewer-avatar">${initials}</div>
                <div class="viewer-info">
                    <div class="viewer-name">${escapeHtml(p.username)}</div>
                    <div class="viewer-role">${p.role}</div>
                </div>
            </div>
        `;
    }).join('');
    
    if (viewersList) viewersList.innerHTML = viewersHTML;
    if (viewersModalList) viewersModalList.innerHTML = viewersHTML;
}

// ===== MENU =====
menuBtn.addEventListener('click', () => {
    menuModal.style.display = 'flex';
});

closeMenuModal.addEventListener('click', () => {
    menuModal.style.display = 'none';
});

logoutBtn.addEventListener('click', async () => {
    if (currentRoomId) {
        const confirmed = await showConfirm('You are currently in a stream. Are you sure you want to logout?', 'Logout');
        if (!confirmed) return;
    }
    logout();
});

function logout() {
    if (currentRoomId && client) {
        client.leaveStream(currentRoomId).catch(console.error);
    }
    
    if (client) client.disconnect();
    
    stopStreamsListPolling();
    
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    currentUser = null;
    accessToken = null;
    
    cleanup();
    appContainer.style.display = 'none';
    authContainer.style.display = 'flex';
    loginForm.reset();
    registerForm.reset();
    menuModal.style.display = 'none';
    
    showToast('Logged out successfully', 'info');
}

// ===== BACK BUTTON =====
backBtn.addEventListener('click', async () => {
    if (currentRoomId) {
        const confirmed = await showConfirm('Are you sure you want to leave the stream?', 'Leave Stream');
        if (confirmed) {
            if (isHost) {
                await client.endStream(currentRoomId);
            } else {
                await client.leaveStream(currentRoomId);
            }
            cleanup();
        }
    } else {
        showStreamsList();
    }
});

// ===== UI UPDATES =====
function updateUI() {
    const inStream = currentRoomId !== null;
    const hasMedia = client && client.producers.size > 0;
    
    if (startMediaBtn) startMediaBtn.style.display = (inStream && !hasMedia && isHost) ? 'flex' : 'none';
    if (toggleAudioBtn) toggleAudioBtn.style.display = hasMedia ? 'flex' : 'none';
    if (toggleVideoBtn) toggleVideoBtn.style.display = (hasMedia && currentStreamType === 'video') ? 'flex' : 'none';
    if (endStreamBtn) endStreamBtn.style.display = (inStream && isHost) ? 'flex' : 'none';
    
    chatInput.disabled = !inStream;
    sendMessageBtn.disabled = !inStream;
}

function startDurationTimer() {
    if (durationInterval) clearInterval(durationInterval);
    
    durationInterval = setInterval(() => {
        if (streamStartTime) {
            const elapsed = Math.floor((Date.now() - streamStartTime.getTime()) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            streamDuration.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function cleanup() {
    // Stop all media tracks (camera and microphone)
    if (client && client.localStream) {
        client.localStream.getTracks().forEach(track => {
            track.stop();
            console.log(`Stopped ${track.kind} track`);
        });
    }
    
    currentRoomId = null;
    isHost = false;
    streamStartTime = null;
    audioProducerId = null;
    videoProducerId = null;
    audioEnabled = true;
    videoEnabled = true;
    
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
    
    localVideo.srcObject = null;
    remoteVideosContainer.innerHTML = '';
    chatMessages.innerHTML = '<div class="chat-welcome"><p>Welcome to the chat! Be respectful and enjoy the stream.</p></div>';
    if (viewersList) viewersList.innerHTML = '';
    viewerCount.textContent = '0';
    if (viewerCountBadge) viewerCountBadge.textContent = '0';
    streamDuration.textContent = '00:00';
    
    updateUI();
    showStreamsList();
}

// ===== UTILITIES =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

// ===== MODAL CLOSE ON OUTSIDE CLICK =====
window.addEventListener('click', (e) => {
    if (e.target === menuModal) menuModal.style.display = 'none';
    if (e.target === startStreamModal) startStreamModal.style.display = 'none';
    if (e.target === viewersModal) viewersModal.style.display = 'none';
    if (e.target === confirmModal) {
        if (confirmResolve) {
            confirmResolve(false);
            confirmResolve = null;
        }
        confirmModal.style.display = 'none';
    }
});

// ===== RESTORE SESSION =====
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
        try {
            currentUser = JSON.parse(savedUser);
            accessToken = savedToken;
            initializeApp();
        } catch (error) {
            console.error('Failed to restore session:', error);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        }
    }
});

// ===== MOBILE VIEWERS BUTTON =====
if (viewerCountBadge) {
    viewerCountBadge.style.cursor = 'pointer';
    viewerCountBadge.addEventListener('click', () => {
        if (window.innerWidth < 1200) {
            viewersModal.style.display = 'flex';
        }
    });
}

if (closeViewersModal) {
    closeViewersModal.addEventListener('click', () => {
        viewersModal.style.display = 'none';
    });
}

console.log('StreamSphere initialized');