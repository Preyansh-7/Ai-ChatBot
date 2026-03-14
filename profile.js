// ============================================
// PROFILE MODULE
// Handles display name, avatar, password updates
// ============================================

const ProfileModule = {

    open() {
        const user = AuthModule.getCurrentUser();
        if (!user) return;

        const fallback = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%23ff69b4"/%3E%3Ctext x="50" y="65" font-size="40" text-anchor="middle" fill="white"%3E👤%3C/text%3E%3C/svg%3E';

        // Populate fields
        document.getElementById('profileAvatarPreview').src = user.photoURL || fallback;
        document.getElementById('profileName').value = user.displayName || '';
        document.getElementById('profileEmail').value = user.email || '';
        document.getElementById('profileNewPassword').value = '';
        document.getElementById('profileConfirmPassword').value = '';

        document.getElementById('profileModal').classList.remove('hidden');
    },

    close() {
        document.getElementById('profileModal').classList.add('hidden');
    },

    // Convert file to base64 data URL for preview
    handleAvatarPreview(file) {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            AuthModule.showToast('❌ Image must be under 2MB', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('profileAvatarPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    // Upload avatar to Cloudinary (free tier) or use Firebase Storage if you have it
    // For simplicity we store as a base64 data URL in Firestore (fine for small images)
    async uploadAvatar(file) {
        return new Promise((resolve, reject) => {
            if (!file) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result); // base64 string
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async save() {
        const user = AuthModule.getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('saveProfileBtn');
        const newName = document.getElementById('profileName').value.trim();
        const newPassword = document.getElementById('profileNewPassword').value;
        const confirmPassword = document.getElementById('profileConfirmPassword').value;
        const fileInput = document.getElementById('avatarFileInput');
        const file = fileInput.files[0] || null;

        // Validate
        if (!newName) {
            AuthModule.showToast('❌ Display name cannot be empty', 'error');
            return;
        }
        if (newPassword && newPassword.length < 6) {
            AuthModule.showToast('❌ Password must be at least 6 characters', 'error');
            return;
        }
        if (newPassword && newPassword !== confirmPassword) {
            AuthModule.showToast('❌ Passwords do not match', 'error');
            return;
        }

        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            let photoURL = user.photoURL;

            // Upload new avatar if chosen
            if (file) {
                photoURL = await this.uploadAvatar(file);
            }

            // Update Firebase Auth profile
            const updates = {};
            if (newName !== user.displayName) updates.displayName = newName;
            if (photoURL !== user.photoURL) updates.photoURL = photoURL;

            if (Object.keys(updates).length > 0) {
                await user.updateProfile(updates);
            }

            // Update password if provided
            if (newPassword) {
                await user.updatePassword(newPassword);
            }

            // Update Firestore user doc
            await firebase.firestore().collection('users').doc(user.uid).update({
                displayName: newName,
                photoURL: photoURL || null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Refresh sidebar profile
            AuthModule.displayUserProfile(user);

            AuthModule.showToast('✅ Profile updated!', 'success');
            this.close();

        } catch (error) {
            console.error('Profile update error:', error);

            // Firebase requires recent login for password change
            if (error.code === 'auth/requires-recent-login') {
                AuthModule.showToast('⚠️ Please sign out and sign back in to change your password', 'error');
            } else {
                AuthModule.showToast('❌ Update failed: ' + error.message, 'error');
            }
        } finally {
            btn.textContent = '💾 Save Changes';
            btn.disabled = false;
        }
    },

    init() {
        // Close button
        document.getElementById('closeProfile')?.addEventListener('click', () => this.close());

        // Close on backdrop click
        document.getElementById('profileModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('profileModal')) this.close();
        });

        // Save button
        document.getElementById('saveProfileBtn')?.addEventListener('click', () => this.save());

        // Avatar file input preview
        document.getElementById('avatarFileInput')?.addEventListener('change', (e) => {
            this.handleAvatarPreview(e.target.files[0]);
        });

        // Click avatar in sidebar to open profile
        // (we delegate since sidebar is re-rendered on login)
        document.getElementById('userProfile')?.addEventListener('click', (e) => {
            if (e.target.closest('.user-avatar')) this.open();
        });

        // Re-attach after profile re-render (auth.js calls displayUserProfile on login)
        window.addEventListener('userLoggedIn', () => {
            setTimeout(() => {
                document.getElementById('userProfile')?.addEventListener('click', (e) => {
                    if (e.target.closest('.user-avatar')) this.open();
                });
            }, 100);
        });
    }
};

window.ProfileModule = ProfileModule;