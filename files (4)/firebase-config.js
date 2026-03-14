// ============================================
// FIREBASE CONFIGURATION
// ============================================
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project
// 3. Enable Authentication (Email/Password + Google)
// 4. Enable Firestore Database
// 5. Go to Project Settings → Your apps → Web app
// 6. Copy the firebaseConfig and paste below

const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let auth, db;

function initFirebase() {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Enable persistence
        db.enablePersistence()
            .catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                } else if (err.code == 'unimplemented') {
                    console.warn('Browser doesn\'t support persistence.');
                }
            });
        
        console.log('🔥 Firebase initialized!');
        return true;
    } else {
        console.error('Firebase SDK not loaded!');
        return false;
    }
}

// Export for use in other files
window.firebaseConfig = firebaseConfig;
window.initFirebase = initFirebase;
