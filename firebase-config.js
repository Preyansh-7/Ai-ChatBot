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
  apiKey: "AIzaSyBWg6cbmaULmx68iw-q7Zx9rY22HWkxzDU",
  authDomain: "pookie-chatbot.firebaseapp.com",
  projectId: "pookie-chatbot",
  storageBucket: "pookie-chatbot.firebasestorage.app",
  messagingSenderId: "369880041757",
  appId: "1:369880041757:web:cf2cd68ccd0785c15ab9f4"
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
