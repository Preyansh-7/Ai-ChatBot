// ============================================
// POOKIE CHATBOT - FIXED VERSION
// ============================================

const API_URL = 'https://ai-chatbot-i5zq.onrender.com/chat';
const STORAGE_KEY = 'pookie_conversations';
const CURRENT_CHAT_KEY = 'pookie_current';
const THEME_KEY = 'pookie_theme';
const SETTINGS_KEY = 'pookie_settings';
const PINNED_KEY = 'pookie_pinned';

// State (also exposed on window for auth.js access)
let state = {
    currentChatId: null,
    conversations: {},
    pinnedMessages: [],
    settings: {
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: "You are a sweet and helpful AI assistant! 🌸 You love helping people and making them smile! ✨ You use cute emojis occasionally (but not too much!) 💖 You're friendly, warm, and encouraging! You explain things clearly but in a fun, approachable way! 🎀 When you give code, you make sure it's well-formatted and easy to understand! 💝 You're like a smart, supportive friend! 🌟"
    },
    isTyping: false
};
window.state = state; // expose for auth.js

// DOM Elements
const el = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatHistory: document.getElementById('chatHistory'),
    lightTheme: document.getElementById('lightTheme'),
    darkTheme: document.getElementById('darkTheme'),
    pookieTheme: document.getElementById('pookieTheme'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    chatMessages: document.getElementById('chatMessages'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    charCount: document.getElementById('charCount'),
    modelSelect: document.getElementById('modelSelect'),
    searchBtn: document.getElementById('searchBtn'),
    pinBtn: document.getElementById('pinBtn'),
    exportBtn: document.getElementById('exportBtn'),
    clearBtn: document.getElementById('clearBtn'),
    temperatureInput: document.getElementById('temperature'),
    maxTokensInput: document.getElementById('maxTokens'),
    systemPromptInput: document.getElementById('systemPrompt')
};

// ============================================
// MARKDOWN INITIALIZATION
// ============================================
function initMarkdown() {
    if (typeof marked !== 'undefined') {
        // marked v11+ uses setOptions differently — highlight via walkTokens or extension
        // Using basic setup that works with v11
        marked.setOptions({ breaks: true, gfm: true });
    }
}

function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
        return marked.parse(text);
    }
    return escapeHtml(text);
}

function processCodeBlocks(container) {
    container.querySelectorAll('pre code').forEach((block) => {
        // Apply highlight.js if available
        if (typeof hljs !== 'undefined') {
            hljs.highlightElement(block);
        }
        const pre = block.parentElement;
        const lang = block.className.match(/language-(\w+)/)?.[1] || 'text';
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `
            <span class="code-language">${lang}</span>
            <button class="code-copy-btn" onclick="copyCode(this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
            </button>
        `;
        pre.parentElement.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// THEME MANAGEMENT
// ============================================
function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(savedTheme);
}

function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(THEME_KEY, themeName);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === themeName);
    });
}

// ============================================
// STORAGE WITH FIREBASE INTEGRATION
// ============================================
function loadFromStorage() {
    const savedConversations = localStorage.getItem(STORAGE_KEY);
    if (savedConversations) {
        try { state.conversations = JSON.parse(savedConversations); } catch (e) {}
    }
    const savedCurrent = localStorage.getItem(CURRENT_CHAT_KEY);
    if (savedCurrent) state.currentChatId = savedCurrent;

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
        try { state.settings = { ...state.settings, ...JSON.parse(savedSettings) }; } catch (e) {}
    }
    const savedPinned = localStorage.getItem(PINNED_KEY);
    if (savedPinned) {
        try { state.pinnedMessages = JSON.parse(savedPinned); } catch (e) {}
    }

    if (el.temperatureInput) {
        el.temperatureInput.value = state.settings.temperature;
        const settingValue = document.querySelector('.setting-value');
        if (settingValue) settingValue.textContent = state.settings.temperature;
    }
    if (el.maxTokensInput) el.maxTokensInput.value = state.settings.maxTokens;
    if (el.systemPromptInput) el.systemPromptInput.value = state.settings.systemPrompt;
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.conversations));
    localStorage.setItem(CURRENT_CHAT_KEY, state.currentChatId || '');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    localStorage.setItem(PINNED_KEY, JSON.stringify(state.pinnedMessages));

    if (state.currentChatId && typeof AuthModule !== 'undefined' && AuthModule.isLoggedIn()) {
        const chat = state.conversations[state.currentChatId];
        if (chat && typeof saveChatToFirestore === 'function') {
            saveChatToFirestore(state.currentChatId, chat);
        }
    }
}

// ============================================
// CHAT MANAGEMENT
// ============================================
function createNewChat() {
    const chatId = generateId();
    state.currentChatId = chatId;
    state.conversations[chatId] = {
        id: chatId,
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
    };
    saveToStorage();
    renderChatHistory();
    loadChat(chatId);
}   

async function loadChat(chatId) {
    state.currentChatId = chatId;
    saveToStorage();
    const chat = state.conversations[chatId];
    if (!chat) return;
    el.chatMessages.innerHTML = '';
    if (chat.messages.length > 0) {
        el.welcomeScreen?.classList.add('hidden');
        for (const msg of chat.messages) {
    if (msg.isImage && msg.imageStorageId) {
        const imageData = await loadImageFromFirestore(msg.imageStorageId);
        if (imageData) {
            addImageMessageToUI(msg.content.replace('🎨 ', ''), imageData, msg.id);
        } else {
            addMessageToUI(msg.role, msg.content, msg.timestamp, msg.id);
        }
    } else {
        addMessageToUI(msg.role, msg.content, msg.timestamp, msg.id);
    }
}
    } else {
        el.welcomeScreen?.classList.remove('hidden');
    }
    renderChatHistory();
    scrollToBottom();
}

async function deleteChat(chatId, event) {
    event?.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    delete state.conversations[chatId];

    if (typeof AuthModule !== 'undefined' && AuthModule.isLoggedIn() && typeof firebase !== 'undefined') {
        try {
            const user = AuthModule.getCurrentUser();
            await firebase.firestore()
                .collection('users').doc(user.uid).collection('chats').doc(chatId).delete();
        } catch (error) {
            console.error('Error deleting from Firestore:', error);
        }
    }

    if (state.currentChatId === chatId) {
        const chatIds = Object.keys(state.conversations);
        if (chatIds.length > 0) loadChat(chatIds[0]);
        else createNewChat();
    }

    saveToStorage();
    renderChatHistory();
}

function renderChatHistory() {
    el.chatHistory.innerHTML = '';
    const chats = Object.values(state.conversations).sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item' + (chat.id === state.currentChatId ? ' active' : '');
        item.innerHTML = `
            <span class="history-item-text">${escapeHtml(chat.title)}</span>
            <button class="history-item-delete" onclick="deleteChat('${chat.id}', event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        `;
        item.addEventListener('click', () => loadChat(chat.id));
        el.chatHistory.appendChild(item);
    });
}

function clearCurrentChat() {
    if (!state.currentChatId) return;
    if (!confirm('Clear this conversation?')) return;
    const chat = state.conversations[state.currentChatId];
    chat.messages = [];
    chat.title = 'New Chat';
    saveToStorage();
    loadChat(state.currentChatId);
}

// ============================================
// MESSAGES
// ============================================
function addMessageToUI(role, content, timestamp = new Date().toISOString(), id = generateId()) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.dataset.messageId = id;

    const avatar = role === 'user' ? '👤' : '🤖';
    const author = role === 'user' ? 'You' : 'AI Assistant';
    const time = formatTime(timestamp);
    const contentHtml = role === 'user' ? escapeHtml(content) : renderMarkdown(content);
    const isPinned = state.pinnedMessages.some(p => p.id === id);

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content-wrapper">
            <div class="message-header">
                <span class="message-author">${author}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${contentHtml}</div>
            ${role === 'assistant' ? `
                <div class="message-actions">
                    <button class="message-action-btn" onclick="copyMessage('${id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copy
                    </button>
                    <button class="message-action-btn" onclick="togglePin('${id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2l-5.5 9h11z"/><circle cx="12" cy="19" r="3"/>
                        </svg>
                        ${isPinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button class="message-action-btn" onclick="regenerateResponse('${id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                        Regenerate
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    el.chatMessages.appendChild(messageDiv);
    if (role === 'assistant') processCodeBlocks(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}
    function compressImage(base64Image, maxWidth = 512) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.6)); // 60% quality JPEG
        };
        img.src = base64Image;
    });
}
    async function saveImageToFirestore(base64Image, prompt) {
    if (typeof AuthModule === 'undefined' || !AuthModule.isLoggedIn()) return null;
    const user = AuthModule.getCurrentUser();
    try {
        const imagesRef = firebase.firestore()
            .collection('users').doc(user.uid).collection('images');
        const snapshot = await imagesRef.orderBy('createdAt', 'asc').get();
        if (snapshot.size >= 10) {
            await snapshot.docs[0].ref.delete();
            console.log('🗑️ Deleted oldest image');
        }
        const compressed = await compressImage(base64Image);
        const docRef = await imagesRef.add({
        image: compressed,
            prompt: prompt,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Image saved:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving image:', error);
        return null;
    }
}

async function loadImageFromFirestore(imageStorageId) {
    if (!imageStorageId || typeof AuthModule === 'undefined' || !AuthModule.isLoggedIn()) return null;
    const user = AuthModule.getCurrentUser();
    try {
        const doc = await firebase.firestore()
            .collection('users').doc(user.uid)
            .collection('images').doc(imageStorageId).get();
        return doc.exists ? doc.data().image : null;
    } catch (error) {
        console.error('Error loading image:', error);
        return null;
    }
}
    async function generateImage(prompt) {
    if (el.welcomeScreen) el.welcomeScreen.classList.add('hidden');
    if (!state.currentChatId || !state.conversations[state.currentChatId]) createNewChat();

    const userMsgId = generateId();
    addMessageToUI('user', `/image ${prompt}`, new Date().toISOString(), userMsgId);

    const chat = state.conversations[state.currentChatId];
    chat.messages.push({ id: userMsgId, role: 'user', content: `/image ${prompt}`, timestamp: new Date().toISOString() });
    if (chat.messages.length === 1) {
        chat.title = `🎨 ${prompt.substring(0, 25)}...`;
        renderChatHistory();
    }

    const loadingId = generateId();
    addImageLoadingToUI(loadingId);

    try {
        const response = await fetch('https://ai-chatbot-i5zq.onrender.com/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        const data = await response.json();
        if (!data.image) throw new Error('No image returned');
        removeLoadingFromUI(loadingId);
        const aiMsgId = generateId();
        addImageMessageToUI(prompt, data.image, aiMsgId);
        const imageStorageId = await saveImageToFirestore(data.image, prompt);
    chat.messages.push({ 
     id: aiMsgId, 
    role: 'assistant', 
    content: `🎨 ${prompt}`, 
    timestamp: new Date().toISOString(), 
    isImage: true,
    imageStorageId: imageStorageId
});
saveToStorage();
    } catch (error) {
        removeLoadingFromUI(loadingId);
        addMessageToUI('assistant', '❌ Failed to generate image. Please try again!', new Date().toISOString());
    }
}

function addImageLoadingToUI(id) {
    const div = document.createElement('div');
    div.className = 'message assistant-message';
    div.dataset.messageId = id;
    div.innerHTML = `
        <div class="message-avatar">🎨</div>
        <div class="message-content-wrapper">
            <div class="message-header"><span class="message-author">AI Artist</span></div>
            <div class="message-content image-loading">
                <div class="image-gen-loading">
                    <div class="spinner"></div>
                    <span>Generating your image... (may take 20-30 sec)</span>
                </div>
            </div>
        </div>
    `;
    el.chatMessages.appendChild(div);
    scrollToBottom();
}

function removeLoadingFromUI(id) {
    document.querySelector(`[data-message-id="${id}"]`)?.remove();
}

function addImageMessageToUI(prompt, imageData, id) {
    const div = document.createElement('div');
    div.className = 'message assistant-message';
    div.dataset.messageId = id;
    div.innerHTML = `
        <div class="message-avatar">🎨</div>
        <div class="message-content-wrapper">
            <div class="message-header">
                <span class="message-author">AI Artist</span>
                <span class="message-time">${formatTime(new Date().toISOString())}</span>
            </div>
            <div class="message-content image-message">
                <p class="image-prompt-label">🎨 ${escapeHtml(prompt)}</p>
                <img src="${imageData}" alt="${escapeHtml(prompt)}" class="generated-image" onclick="window.open('${imageData}')">
                <div class="image-actions">
                    <button class="message-action-btn" onclick="downloadImage('${id}')">⬇️ Download</button>
                </div>
            </div>
        </div>
    `;
    el.chatMessages.appendChild(div);
    scrollToBottom();
}
function downloadImage(msgId) {
    const img = document.querySelector(`[data-message-id="${msgId}"] .generated-image`);
    if (!img) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'ai-image.png';
    a.click();
}
window.downloadImage = downloadImage;
// ============================================
// API COMMUNICATION
// ============================================
async function sendMessage() {
   
        const message = el.messageInput.value.trim();
if (!message || state.isTyping) return;

// Handle /image command
if (message.toLowerCase().startsWith('/image ')) {
    const prompt = message.slice(7).trim();
    if (!prompt) {
        AuthModule.showToast('❌ Please add a prompt! e.g. /image a sunset', 'error');
        return;
    }
    el.messageInput.value = '';
    el.charCount.textContent = '0';
    el.messageInput.style.height = 'auto';
    generateImage(prompt);
    return;
}
    if (el.welcomeScreen) el.welcomeScreen.classList.add('hidden');

    if (!state.currentChatId || !state.conversations[state.currentChatId]) {
        createNewChat();
    }

    const messageId = generateId();
    addMessageToUI('user', message, new Date().toISOString(), messageId);

    const chat = state.conversations[state.currentChatId];
    if (!chat) { createNewChat(); return; }
    if (!chat.messages) chat.messages = [];

    chat.messages.push({ id: messageId, role: 'user', content: message, timestamp: new Date().toISOString() });
    await saveChatToFirestore(state.currentChatId, state.conversations[state.currentChatId]);

    if (chat.messages.length === 1) {
        chat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
        renderChatHistory();
    }

    el.messageInput.value = '';
    el.charCount.textContent = '0';
    el.messageInput.style.height = 'auto';

    state.isTyping = true;
    el.sendBtn.disabled = true;
    el.sendBtn.querySelector('.send-icon').classList.add('hidden');
    el.sendBtn.querySelector('.loading-spinner').classList.remove('hidden');

    try {
        try {
    const history = chat.messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
    }));

    // FIX: use 'llama-3.3-70b' to match server modelMap key
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            model: el.modelSelect.value,
            history,
            temperature: state.settings.temperature,
            max_tokens: state.settings.maxTokens,
            system_prompt: state.settings.systemPrompt
        })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const aiMessageId = generateId();

    addMessageToUI('assistant', data.response, new Date().toISOString(), aiMessageId);
    chat.messages.push({ id: aiMessageId, role: 'assistant', content: data.response, timestamp: new Date().toISOString() });
    await saveChatToFirestore(state.currentChatId, state.conversations[state.currentChatId]);
    saveToStorage();

} catch (error) {
    console.error('Error:', error);
    addMessageToUI('assistant', '⚠️ Sorry, something went wrong. Please try again!', new Date().toISOString());
}
    } catch (error) {
        console.error('Error:', error);
        addMessageToUI('assistant', '⚠️ Sorry, something went wrong. Please try again!', new Date().toISOString());
    } finally {
        state.isTyping = false;
        el.sendBtn.disabled = false;
        el.sendBtn.querySelector('.send-icon').classList.remove('hidden');
        el.sendBtn.querySelector('.loading-spinner').classList.add('hidden');
    }
}

// ============================================
// MESSAGE ACTIONS
// ============================================
function copyMessage(messageId) {
    const chat = state.conversations[state.currentChatId];
    const message = chat?.messages.find(m => m.id === messageId);
    if (message) {
        navigator.clipboard.writeText(message.content)
            .then(() => {
                if (typeof AuthModule !== 'undefined') AuthModule.showToast('💖 Copied to clipboard!', 'success');
            });
    }
}

function togglePin(messageId) {
    const chat = state.conversations[state.currentChatId];
    const message = chat?.messages.find(m => m.id === messageId);
    if (!message) return;
    const pinnedIndex = state.pinnedMessages.findIndex(p => p.id === messageId);
    if (pinnedIndex >= 0) {
        state.pinnedMessages.splice(pinnedIndex, 1);
    } else {
        state.pinnedMessages.push({ id: messageId, chatId: state.currentChatId, content: message.content, timestamp: message.timestamp });
    }
    saveToStorage();
    loadChat(state.currentChatId);
}

function regenerateResponse(messageId) {
    const chat = state.conversations[state.currentChatId];
    const messages = chat?.messages;
    if (!messages) return;
    const aiIndex = messages.findIndex(m => m.id === messageId);
    if (aiIndex <= 0) return;
    const userMessage = messages[aiIndex - 1];
    if (userMessage.role !== 'user') return;
    messages.splice(aiIndex, 1);
    saveToStorage();
    el.messageInput.value = userMessage.content;
    handleInputChange();
    sendMessage();
}

function copyCode(btn) {
    const code = btn.closest('.code-block-wrapper').querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
            `;
        }, 2000);
    });
}

// ============================================
// EXPORT
// ============================================
function exportChat() {
    if (!state.currentChatId) return;
    const chat = state.conversations[state.currentChatId];
    if (!chat) return;
    let text = `${chat.title}\nCreated: ${new Date(chat.createdAt).toLocaleString()}\n${'='.repeat(50)}\n\n`;
    chat.messages.forEach(msg => {
        const author = msg.role === 'user' ? 'You' : 'AI Assistant';
        text += `[${new Date(msg.timestamp).toLocaleString()}] ${author}:\n${msg.content}\n\n`;
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${chat.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// INPUT HANDLING
// ============================================
function handleInputChange() {
    const text = el.messageInput.value;
    el.charCount.textContent = text.length;
    el.messageInput.style.height = 'auto';
    el.messageInput.style.height = el.messageInput.scrollHeight + 'px';
}

// ============================================
// EVENT LISTENERS (single definition, fixed)
// ============================================
function setupEventListeners() {
    // Sidebar
    el.sidebarToggle?.addEventListener('click', () => el.sidebar.classList.toggle('open'));
    el.newChatBtn.addEventListener('click', createNewChat);

    // Themes
    el.lightTheme?.addEventListener('click', () => applyTheme('light'));
    el.darkTheme?.addEventListener('click', () => applyTheme('dark'));
    el.pookieTheme?.addEventListener('click', () => applyTheme('pookie'));

    // Settings
    el.settingsBtn.addEventListener('click', () => el.settingsModal.classList.remove('hidden'));
    el.closeSettings.addEventListener('click', () => el.settingsModal.classList.add('hidden'));
    el.settingsModal?.addEventListener('click', (e) => {
        if (e.target === el.settingsModal) el.settingsModal.classList.add('hidden');
    });
    el.temperatureInput?.addEventListener('input', (e) => {
        state.settings.temperature = parseFloat(e.target.value);
        document.querySelector('.setting-value').textContent = e.target.value;
        saveToStorage();
    });
    el.maxTokensInput?.addEventListener('input', (e) => {
        state.settings.maxTokens = parseInt(e.target.value);
        saveToStorage();
    });
    el.systemPromptInput?.addEventListener('input', (e) => {
        state.settings.systemPrompt = e.target.value;
        saveToStorage();
    });

    // Chat actions (all 4 buttons — fixed!)
    el.searchBtn.addEventListener('click', toggleSearch);
    el.pinBtn.addEventListener('click', showPinnedMessages);
    el.exportBtn.addEventListener('click', exportChat);
    el.clearBtn.addEventListener('click', clearCurrentChat);

    // Input
    el.messageInput.addEventListener('input', handleInputChange);
    el.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    el.sendBtn.addEventListener('click', sendMessage);

    // Suggestion chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            el.messageInput.value = chip.getAttribute('data-prompt');
            handleInputChange();
            sendMessage();
        });
    });

    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            el.sidebar.classList.contains('open') &&
            !el.sidebar.contains(e.target) &&
            !el.sidebarToggle.contains(e.target)) {
            el.sidebar.classList.remove('open');
        }
    });

    // Auth form listeners
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) { alert('Please fill in all fields'); return; }
        const result = await AuthModule.signIn(email, password);
        if (!result.success) alert('Login failed: ' + result.error);
    });

    document.getElementById('signupBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        if (!name || !email || !password) { alert('Please fill in all fields'); return; }
        if (password.length < 6) { alert('Password must be at least 6 characters'); return; }
        const result = await AuthModule.signUp(email, password, name);
        if (!result.success) alert('Sign up failed: ' + result.error);
    });

    document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
        const result = await AuthModule.signInWithGoogle();
        if (!result.success) alert('Google sign-in failed: ' + result.error);
    });

    document.getElementById('forgotPasswordBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        if (!email) { alert('Please enter your email first'); return; }
        const result = await AuthModule.resetPassword(email);
        if (result.success) alert('Password reset email sent! Check your inbox.');
        else alert('Error: ' + result.error);
    });

    // Auth tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            document.getElementById('loginForm').classList.toggle('hidden', tabName !== 'login');
            document.getElementById('signupForm').classList.toggle('hidden', tabName !== 'signup');
        });
    });
}

// ============================================
// GLOBAL FUNCTIONS (for inline onclick handlers)
// ============================================
window.deleteChat = deleteChat;
window.copyMessage = copyMessage;
window.togglePin = togglePin;
window.regenerateResponse = regenerateResponse;
window.copyCode = copyCode;

// ============================================
// FIREBASE INTEGRATION
// ============================================
async function saveChatToFirestore(chatId, chatData) {
    if (typeof AuthModule === 'undefined' || typeof firebase === 'undefined') return;
    const user = AuthModule.getCurrentUser();
    if (!user) return;
    try {
        await firebase.firestore()
            .collection('users').doc(user.uid).collection('chats').doc(chatId)
            .set({ ...chatData, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error('Error saving to Firestore:', error);
    }
}

async function loadUserChats(userId) {
    try {
        let snapshot;
        try {
            snapshot = await firebase.firestore()
                .collection('users').doc(userId).collection('chats')
                .orderBy('updatedAt', 'desc').get();
        } catch {
            snapshot = await firebase.firestore()
                .collection('users').doc(userId).collection('chats').get();
        }

        const conversations = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            conversations[doc.id] = {
                id: doc.id,
                title: data.title || 'Untitled Chat',
                messages: data.messages || [],
                createdAt: data.createdAt || new Date().toISOString(),
                ...data
            };
        });

        state.conversations = conversations;
        renderChatHistory();

        const chatIds = Object.keys(conversations);
        if (chatIds.length > 0) loadChat(chatIds[0]);
        else createNewChat();
    } catch (error) {
        console.error('Error loading chats:', error);
        createNewChat();
    }
}

window.loadUserChats = loadUserChats;

// ============================================
// SEARCH FUNCTIONALITY
// ============================================
let searchState = { isSearching: false, query: '', matches: [], currentIndex: 0 };

function toggleSearch() {
    const existing = document.getElementById('searchBar');
    if (!existing) { createSearchBar(); return; }
    searchState.isSearching = !searchState.isSearching;
    existing.classList.toggle('hidden', !searchState.isSearching);
    if (searchState.isSearching) document.getElementById('searchInput').focus();
    else clearSearch();
}

function createSearchBar() {
    const header = document.querySelector('.chat-header');
    const div = document.createElement('div');
    div.className = 'search-bar';
    div.id = 'searchBar';
    div.innerHTML = `
        <input type="text" id="searchInput" placeholder="Search in chat..." />
        <button class="search-nav-btn" id="searchPrev" disabled>↑</button>
        <button class="search-nav-btn" id="searchNext" disabled>↓</button>
        <span class="search-count" id="searchCount">0/0</span>
        <button class="search-close" onclick="toggleSearch()">✕</button>
    `;
    header.insertAdjacentElement('afterend', div);
    document.getElementById('searchInput').addEventListener('input', performSearch);
    document.getElementById('searchPrev').addEventListener('click', () => navigateSearch(-1));
    document.getElementById('searchNext').addEventListener('click', () => navigateSearch(1));
    searchState.isSearching = true;
    document.getElementById('searchInput').focus();
}

function performSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    searchState.query = query;
    searchState.matches = [];
    searchState.currentIndex = 0;
    document.querySelectorAll('.search-highlight').forEach(el => { el.outerHTML = el.textContent; });
    if (!query) { updateSearchUI(); return; }
    document.querySelectorAll('.message-content').forEach(msg => {
        if (msg.textContent.toLowerCase().includes(query)) {
            searchState.matches.push(msg);
            highlightText(msg, query);
        }
    });
    updateSearchUI();
    if (searchState.matches.length > 0) scrollToMatch(0);
}

function highlightText(element, query) {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    element.innerHTML = element.innerHTML.replace(regex, '<span class="search-highlight">$1</span>');
}

function navigateSearch(direction) {
    if (searchState.matches.length === 0) return;
    searchState.currentIndex = (searchState.currentIndex + direction + searchState.matches.length) % searchState.matches.length;
    scrollToMatch(searchState.currentIndex);
    updateSearchUI();
}

function scrollToMatch(index) {
    const match = searchState.matches[index];
    if (match) {
        match.scrollIntoView({ behavior: 'smooth', block: 'center' });
        match.classList.add('search-active');
        setTimeout(() => match.classList.remove('search-active'), 2000);
    }
}

function updateSearchUI() {
    const count = document.getElementById('searchCount');
    const prev = document.getElementById('searchPrev');
    const next = document.getElementById('searchNext');
    if (!count) return;
    const hasMatches = searchState.matches.length > 0;
    count.textContent = hasMatches ? `${searchState.currentIndex + 1}/${searchState.matches.length}` : '0/0';
    if (prev) prev.disabled = !hasMatches;
    if (next) next.disabled = !hasMatches;
}

function clearSearch() {
    document.querySelectorAll('.search-highlight').forEach(el => { el.outerHTML = el.textContent; });
    searchState = { isSearching: false, query: '', matches: [], currentIndex: 0 };
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
}

// ============================================
// PINNED MESSAGES
// ============================================
function showPinnedMessages() {
    if (!state.pinnedMessages || state.pinnedMessages.length === 0) {
        if (typeof AuthModule !== 'undefined') AuthModule.showToast('💖 No pinned messages yet!', 'info');
        else alert('💖 No pinned messages yet!');
        return;
    }
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'pinnedModal';
    const pinnedHTML = state.pinnedMessages.map(pin => `
        <div class="pinned-item" data-id="${pin.id}">
            <div class="pinned-content">${escapeHtml(pin.content.substring(0, 150))}${pin.content.length > 150 ? '...' : ''}</div>
            <div class="pinned-actions">
                <button onclick="jumpToPinnedMessage('${pin.id}')">Jump to message</button>
                <button onclick="unpinMessage('${pin.id}')">Unpin</button>
            </div>
        </div>
    `).join('');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>📌 Pinned Messages (${state.pinnedMessages.length})</h2>
                <button class="modal-close" onclick="closePinnedModal()">✕</button>
            </div>
            <div class="modal-body pinned-list">${pinnedHTML}</div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closePinnedModal(); });
}

function jumpToPinnedMessage(messageId) {
    closePinnedModal();
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageEl.classList.add('message-highlight');
        setTimeout(() => messageEl.classList.remove('message-highlight'), 2000);
    }
}

function unpinMessage(messageId) {
    state.pinnedMessages = state.pinnedMessages.filter(p => p.id !== messageId);
    saveToStorage();
    closePinnedModal();
    showPinnedMessages();
}

function closePinnedModal() {
    document.getElementById('pinnedModal')?.remove();
}

// expose for inline onclick
window.jumpToPinnedMessage = jumpToPinnedMessage;
window.unpinMessage = unpinMessage;
window.closePinnedModal = closePinnedModal;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Step 1: Firebase
    if (typeof initFirebase === 'function') {
        try {
            const ok = initFirebase();
            if (ok && typeof AuthModule !== 'undefined') AuthModule.init();
        } catch (e) {
            console.error('Firebase init error:', e);
        }
    }

// Step 2: Core features
initMarkdown();
initTheme();
loadFromStorage();
setupEventListeners();
ProfileModule.init();
renderChatHistory();

    // Step 3: Load or create chat (only if not logged in — Firebase will handle logged-in case)
    if (typeof AuthModule === 'undefined' || !AuthModule.isLoggedIn()) {
        if (state.currentChatId && state.conversations[state.currentChatId]) {
            loadChat(state.currentChatId);
        } else if (Object.keys(state.conversations).length > 0) {
            loadChat(Object.keys(state.conversations)[0]);
        } else {
            createNewChat();
        }
    }

    console.log('🌸💖 Pookie Chat Bot initialized! 💖🌸');
});