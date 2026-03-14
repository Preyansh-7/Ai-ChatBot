// ============================================
// AUTHENTICATION MODULE
// Handles all user authentication logic
// ============================================

const AuthModule = {
    currentUser: null,

    // Initialize auth state listener
    init() {
        if (typeof firebase === 'undefined') {
            console.error('Firebase not loaded!');
            return;
        }

        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.onLoginSuccess(user);
            } else {
                this.currentUser = null;
                this.onLogout();
            }
        });
    },

    // Sign up with email/password
    async signUp(email, password, displayName) {
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName });
            await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
                email,
                displayName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                photoURL: userCredential.user.photoURL || null
            });
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Sign in with email/password
    async signIn(email, password) {
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Sign in with Google
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const userCredential = await firebase.auth().signInWithPopup(provider);
            const userRef = firebase.firestore().collection('users').doc(userCredential.user.uid);
            const doc = await userRef.get();
            if (!doc.exists) {
                await userRef.set({
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    photoURL: userCredential.user.photoURL,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Sign out
    async signOut() {
        try {
            await firebase.auth().signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Send password reset email
    async resetPassword(email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getCurrentUser() { return this.currentUser; },
    isLoggedIn() { return this.currentUser !== null; },

    // Called when user logs in
    onLoginSuccess(user) {
        console.log('👤 User logged in:', user.email);
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.add('hidden');
        this.showWelcomeAnimation(user);
        this.displayUserProfile(user);
        this.migrateLocalChats();
        if (window.loadUserChats) window.loadUserChats(user.uid);
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: user }));
    },

    // Called when user logs out
    onLogout() {
        console.log('👋 User logged out');
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('hidden');
        const userProfile = document.getElementById('userProfile');
        if (userProfile) userProfile.classList.add('hidden');
        if (window.state) {
            window.state.conversations = {};
            window.state.currentChatId = null;
        }
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) chatMessages.innerHTML = '';
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        window.dispatchEvent(new Event('userLoggedOut'));
    },

    // Display user profile in sidebar
    displayUserProfile(user) {
        const userProfile = document.getElementById('userProfile');
        if (!userProfile) return;
        const fallbackAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%23ff69b4"/%3E%3Ctext x="50" y="65" font-size="40" text-anchor="middle" fill="white"%3E👤%3C/text%3E%3C/svg%3E';
        const photoURL = user.photoURL || fallbackAvatar;
        userProfile.innerHTML = `
            <div class="user-avatar">
                <img src="${photoURL}" alt="Profile" onerror="this.src='${fallbackAvatar}'">
            </div>
            <div class="user-info">
                <div class="user-name">${user.displayName || user.email.split('@')[0]}</div>
                <div class="user-email">${user.email}</div>
            </div>
            <button class="logout-btn" onclick="AuthModule.signOut()" title="Sign out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
            </button>
        `;
        userProfile.classList.remove('hidden');
    },

    // Migrate localStorage chats to Firestore
    async migrateLocalChats() {
        const localChats = localStorage.getItem('pookie_conversations');
        if (!localChats || !this.currentUser) return;
        try {
            const conversations = JSON.parse(localChats);
            const chatCount = Object.keys(conversations).length;
            if (chatCount === 0) return;
            this.showImportModal(chatCount, conversations);
        } catch (error) {
            console.error('Migration error:', error);
        }
    },

    // Custom import modal
    showImportModal(chatCount, conversations) {
        const modal = document.createElement('div');
        modal.className = 'modal import-modal';
        modal.innerHTML = `
            <div class="modal-content import-modal-content">
                <div class="import-header">
                    <div class="import-icon">📦</div>
                    <h2>Import Your Chats?</h2>
                    <p>We found ${chatCount} chat${chatCount > 1 ? 's' : ''} on this device!</p>
                </div>
                <div class="import-body">
                    <p>Would you like to import ${chatCount > 1 ? 'them' : 'it'} to your account? Your chats will be saved to the cloud.</p>
                </div>
                <div class="import-actions">
                    <button class="import-btn cancel-btn" id="importCancel">Skip</button>
                    <button class="import-btn import-btn-primary" id="importConfirm">✨ Import Chats</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('importCancel').addEventListener('click', () => {
            localStorage.removeItem('pookie_conversations');
            modal.remove();
        });

        document.getElementById('importConfirm').addEventListener('click', async () => {
            const btn = document.getElementById('importConfirm');
            btn.textContent = 'Importing...';
            btn.disabled = true;
            try {
                const batch = firebase.firestore().batch();
                const userChatsRef = firebase.firestore()
                    .collection('users').doc(this.currentUser.uid).collection('chats');
                for (const [chatId, chat] of Object.entries(conversations)) {
                    batch.set(userChatsRef.doc(chatId), {
                        id: chatId,
                        title: chat.title || 'Untitled Chat',
                        messages: chat.messages || [],
                        createdAt: chat.createdAt || new Date().toISOString(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        migratedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
                await batch.commit();
                localStorage.removeItem('pookie_conversations');
                localStorage.removeItem('pookie_current');
                modal.remove();
                this.showToast(`✅ Successfully imported ${chatCount} chat${chatCount > 1 ? 's' : ''}!`, 'success');
                if (window.loadUserChats) window.loadUserChats(this.currentUser.uid);
            } catch (error) {
                console.error('Import error:', error);
                btn.textContent = '✨ Import Chats';
                btn.disabled = false;
                this.showToast('❌ Import failed. Please try again.', 'error');
            }
        });
    },

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Show welcome animation
    showWelcomeAnimation(user) {
        const welcome = document.createElement('div');
        welcome.className = 'welcome-animation';
        welcome.innerHTML = `
            <div class="welcome-content">
                <div class="welcome-emoji">👋</div>
                <h2>Welcome back, ${user.displayName || 'Friend'}!</h2>
                <p>Your chats are ready ✨</p>
            </div>
        `;
        document.body.appendChild(welcome);
        setTimeout(() => welcome.classList.add('show'), 10);
        setTimeout(() => {
            welcome.classList.remove('show');
            setTimeout(() => welcome.remove(), 500);
        }, 2500);
    }
};

window.AuthModule = AuthModule;