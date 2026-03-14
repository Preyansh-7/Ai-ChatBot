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
        
        // Listen for auth state changes
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
            
            // Update profile with display name
            await userCredential.user.updateProfile({
                displayName: displayName
            });
            
            // Create user document in Firestore
            await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
                email: email,
                displayName: displayName,
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
            
            // Create/update user document
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
    
    // Get current user
    getCurrentUser() {
        return this.currentUser;
    },
    
    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    },
    
    // Called when user logs in
    onLoginSuccess(user) {
        console.log('👤 User logged in:', user.email);
        
        // Hide auth modal
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.add('hidden');
        
        // Show user profile
        this.displayUserProfile(user);
        
        // Migrate localStorage chats to Firestore
        this.migrateLocalChats();
        
        // Load user's chats from Firestore
        if (window.loadUserChats) {
            window.loadUserChats(user.uid);
        }
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: user }));
    },
    
    // Called when user logs out
    onLogout() {
        console.log('👋 User logged out');
        
        // Show auth modal
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('hidden');
        
        // Hide user profile
        const userProfile = document.getElementById('userProfile');
        if (userProfile) userProfile.classList.add('hidden');
        
        // Clear state
        if (window.state) {
            window.state.conversations = {};
            window.state.currentChatId = null;
        }
        
        // Clear chat display
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) chatMessages.innerHTML = '';
        
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        
        // Dispatch custom event
        window.dispatchEvent(new Event('userLoggedOut'));
    },
    
    // Display user profile in sidebar
    displayUserProfile(user) {
        const userProfile = document.getElementById('userProfile');
        if (!userProfile) return;
        
        const photoURL = user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ff69b4"/><text x="50" y="65" font-size="40" text-anchor="middle" fill="white">👤</text></svg>';
        
        userProfile.innerHTML = `
            <div class="user-avatar">
                <img src="${photoURL}" alt="Profile" onerror="this.src='data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 100 100\\"><circle cx=\\"50\\" cy=\\"50\\" r=\\"40\\" fill=\\"%23ff69b4\\"/><text x=\\"50\\" y=\\"65\\" font-size=\\"40\\" text-anchor=\\"middle\\" fill=\\"white\\">👤</text></svg>'">
            </div>
            <div class="user-info">
                <div class="user-name">${user.displayName || user.email.split('@')[0]}</div>
                <div class="user-email">${user.email}</div>
            </div>
            <button class="logout-btn" onclick="AuthModule.signOut()">
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
            
            // Ask user if they want to import
            const shouldImport = confirm(`Found ${chatCount} chat(s) on this device. Import to your account?`);
            if (!shouldImport) {
                localStorage.removeItem('pookie_conversations');
                return;
            }
            
            // Upload to Firestore
            const batch = firebase.firestore().batch();
            const userChatsRef = firebase.firestore().collection('users').doc(this.currentUser.uid).collection('chats');
            
            for (const [chatId, chat] of Object.entries(conversations)) {
                batch.set(userChatsRef.doc(chatId), {
                    ...chat,
                    migratedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            await batch.commit();
            
            // Clear localStorage
            localStorage.removeItem('pookie_conversations');
            localStorage.removeItem('pookie_current');
            
            alert(`✅ Successfully imported ${chatCount} chat(s)!`);
            
        } catch (error) {
            console.error('Migration error:', error);
        }
    }
};

// Make globally available
window.AuthModule = AuthModule;
