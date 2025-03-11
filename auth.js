// Supabase initialization
const supabaseUrl = 'https://wefdmpmdyquuspucxpnn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZmRtcG1keXF1dXNwdWN4cG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA5MTU2MDMsImV4cCI6MjA1NjQ5MTYwM30.Lhn5TRevwGosKH05m2D9UoNWtw0uVq-WDGDhliY8gzg';
const supabase = supabaseClient.createClient(supabaseUrl, supabaseKey);

// DOM elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginTemplate = document.getElementById('login-template');
const registerTemplate = document.getElementById('register-template');
const resetPasswordTemplate = document.getElementById('reset-password-template');
const userProfileElem = document.getElementById('user-profile');
const userNameElem = document.getElementById('user-name');
const userAvatarElem = document.getElementById('user-avatar');
const userTierElem = document.getElementById('user-tier');
const adminLinkElem = document.getElementById('admin-link');
const premiumNotification = document.getElementById('premium-notification');

// Global user state
let currentUser = null;
let userProfile = null;
let lastAdWatched = null;

// Authentication state
async function checkAuth() {
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error checking authentication:', error);
    showLandingPage();
    return false;
  }
  
  if (data.session) {
    currentUser = data.session.user;
    await fetchUserProfile();
    updateUIForUser();
    return true;
  } else {
    showLandingPage();
    return false;
  }
}

// Fetch user profile data
async function fetchUserProfile() {
  if (!currentUser) return;
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  
  if (error) {
    console.error('Error fetching user profile:', error);
    
    // If profile doesn't exist, create it
    if (error.code === 'PGRST116') {
      await createUserProfile();
    }
    return;
  }
  
  userProfile = data;
  lastAdWatched = data.last_ad_watched;
}

// Create new user profile
async function createUserProfile() {
  if (!currentUser) return null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        id: currentUser.id,
        full_name: currentUser.user_metadata?.full_name || 'User',
        avatar_url: currentUser.user_metadata?.avatar_url || null,
        email: currentUser.email,
        is_admin: false,
        scans_remaining: 5,
        last_scan_reset: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
    
    userProfile = data;
    return data;
  } catch (err) {
    console.error('Exception creating user profile:', err);
    return null;
  }
}

// Update UI for authenticated user
function updateUIForUser() {
  // Hide landing page if visible
  const landingPage = document.getElementById('landing-page');
  if (landingPage) {
    landingPage.style.display = 'none';
  }
  document.body.classList.remove('landing-mode');
  
  // Show app container, hide auth container
  authContainer.style.display = 'none';
  appContainer.style.display = 'block';
  
  // Update user info in UI
  userNameElem.textContent = userProfile?.full_name || currentUser.email.split('@')[0];
  
  if (userProfile?.avatar_url) {
    userAvatarElem.src = userProfile.avatar_url;
  } else {
    userAvatarElem.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNameElem.textContent)}&background=random`;
  }
  
  // Show admin link if user is admin
  if (adminLinkElem) {
    if (userProfile?.is_admin) {
      adminLinkElem.style.display = 'flex';
    } else {
      adminLinkElem.style.display = 'none';
    }
  }
  
  // Check if features should be unlocked by ad viewing
  checkAdUnlock();
}

// Check if user has watched an ad recently
function checkAdUnlock() {
  if (!premiumNotification) return;
  
  const now = new Date();
  const adWatchedTime = lastAdWatched ? new Date(lastAdWatched) : null;
  
  // Ad unlocks features for 24 hours
  if (adWatchedTime && ((now - adWatchedTime) / (1000 * 60 * 60)) < 24) {
    premiumNotification.style.display = 'none';
  } else {
    premiumNotification.style.display = 'flex';
  }
}

// Show the landing page
function showLandingPage() {
  const landingPage = document.getElementById('landing-page');
  const appContainer = document.getElementById('app-container');
  const authContainer = document.getElementById('auth-container');
  
  if (landingPage) {
    landingPage.style.display = 'block';
    appContainer.style.display = 'none';
    authContainer.style.display = 'none';
    document.body.classList.add('landing-mode');
  } else {
    showLoginForm();
  }
}

// Show the login form
function showLoginForm() {
  const landingPage = document.getElementById('landing-page');
  if (landingPage) {
    landingPage.style.display = 'none';
  }
  
  authContainer.style.display = 'flex';
  appContainer.style.display = 'none';
  document.body.classList.remove('landing-mode');
  
  // Clone template content
  const template = document.getElementById('login-template');
  if (!template) {
    console.error('Login template not found');
    return;
  }
  
  const content = document.importNode(template.content, true);
  authContainer.innerHTML = '';
  authContainer.appendChild(content);
  
  // Add event listeners
  const loginForm = document.getElementById('login-form');
  const registerLink = document.getElementById('register-link');
  const forgotPasswordLink = document.getElementById('forgot-password-link');
  const googleLoginBtn = document.getElementById('google-login');
  
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerLink) registerLink.addEventListener('click', showRegisterForm);
  if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', showResetPasswordForm);
  if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);
  
  // Password visibility toggle
  const togglePassword = document.querySelector('.toggle-password');
  const passwordInput = document.getElementById('login-password');
  
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePassword.classList.toggle('fa-eye');
      togglePassword.classList.toggle('fa-eye-slash');
    });
  }
}

// Show the register form
function showRegisterForm(e) {
  if (e) e.preventDefault();
  
  const landingPage = document.getElementById('landing-page');
  if (landingPage) {
    landingPage.style.display = 'none';
  }
  
  authContainer.style.display = 'flex';
  appContainer.style.display = 'none';
  document.body.classList.remove('landing-mode');
  
  // Clone template content
  const content = document.importNode(registerTemplate.content, true);
  authContainer.innerHTML = '';
  authContainer.appendChild(content);
  
  // Add event listeners
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('login-link').addEventListener('click', showLoginForm);
  document.getElementById('google-register').addEventListener('click', handleGoogleLogin);
  
  // Password visibility toggle
  const togglePassword = document.querySelector('.toggle-password');
  const passwordInput = document.getElementById('register-password');
  
  togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    togglePassword.classList.toggle('fa-eye');
    togglePassword.classList.toggle('fa-eye-slash');
  });
  
  // Password strength meter
  const strengthBar = document.getElementById('strength-bar');
  const strengthText = document.getElementById('strength-text');
  
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    const strength = calculatePasswordStrength(password);
    
    strengthBar.style.width = `${strength.score * 25}%`;
    strengthBar.style.backgroundColor = strength.color;
    strengthText.textContent = strength.label;
    strengthText.style.color = strength.color;
  });
}

// Show the reset password form
function showResetPasswordForm(e) {
  if (e) e.preventDefault();
  
  // Clone template content
  const content = document.importNode(resetPasswordTemplate.content, true);
  authContainer.innerHTML = '';
  authContainer.appendChild(content);
  
  // Add event listeners
  document.getElementById('reset-form').addEventListener('submit', handleResetPassword);
  document.getElementById('back-to-login-link').addEventListener('click', showLoginForm);
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const rememberMe = document.getElementById('remember-me').checked;
  const errorElement = document.getElementById('login-error');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        persistSession: rememberMe
      }
    });
    
    if (error) throw error;
    
    currentUser = data.user;
    await fetchUserProfile();
    updateUIForUser();
    
  } catch (error) {
    errorElement.style.display = 'block';
    errorElement.textContent = error.message || 'Failed to login. Please try again.';
  }
}

// Handle register form submission
async function handleRegister(e) {
  e.preventDefault();
  
  const fullName = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const termsAgreed = document.getElementById('terms-agree').checked;
  const errorElement = document.getElementById('register-error');
  
  if (!termsAgreed) {
    errorElement.style.display = 'block';
    errorElement.textContent = 'You must agree to the Terms of Service and Privacy Policy.';
    return;
  }
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        },
        emailRedirectTo: window.location.origin
      }
    });
    
    if (error) throw error;
    
    // Show success message
    errorElement.style.display = 'block';
    errorElement.textContent = 'Registration successful! Please check your email to confirm your account.';
    errorElement.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
    errorElement.style.color = 'var(--success)';
    
    // Redirect to login after a delay
    setTimeout(() => {
      showLoginForm();
    }, 3000);
    
  } catch (error) {
    errorElement.style.display = 'block';
    errorElement.textContent = error.message || 'Failed to register. Please try again.';
  }
}

// Handle password reset request
async function handleResetPassword(e) {
  e.preventDefault();
  
  const email = document.getElementById('reset-email').value;
  const errorElement = document.getElementById('reset-error');
  const successElement = document.getElementById('reset-success');
  
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    });
    
    if (error) throw error;
    
    // Show success message
    if (successElement) {  
      successElement.style.display = 'block';
      successElement.textContent = 'Password reset link sent! Please check your email.';
    }
    
  } catch (error) {
    if (errorElement) {  
      errorElement.style.display = 'block';
      errorElement.textContent = error.message || 'Failed to send reset link. Please try again.';
    }
  }
}

// Handle Google login
async function handleGoogleLogin() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) throw error;
    
  } catch (error) {
    console.error('Google login error:', error);
    alert('Failed to login with Google. Please try again.');
  }
}

// Handle logout
async function handleLogout() {
  try {
    await supabase.auth.signOut();
    currentUser = null;
    userProfile = null;
    showLoginForm();
  } catch (error) {
    console.error('Logout error:', error);
    alert('Failed to logout. Please try again.');
  }
}

// Calculate password strength
function calculatePasswordStrength(password) {
  if (!password) {
    return { score: 0, label: 'Password strength', color: 'var(--text-tertiary)' };
  }
  
  let score = 0;
  
  // Length check
  if (password.length > 6) score += 1;
  if (password.length > 10) score += 1;
  
  // Complexity checks
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  // Determine label and color
  let label, color;
  
  switch (score) {
    case 0:
    case 1:
      label = 'Weak';
      color = 'var(--danger)';
      break;
    case 2:
    case 3:
      label = 'Medium';
      color = 'var(--warning)';
      break;
    case 4:
      label = 'Strong';
      color = 'var(--success)';
      break;
    case 5:
      label = 'Very Strong';
      color = 'var(--success)';
      break;
  }
  
  return { score: score, label, color };
}

// Watch ad to unlock premium features temporarily
async function watchAd() {
  try {
    const adModal = document.getElementById('ad-modal');
    
    if (!adModal) {
      console.error('Ad modal element not found');
      return;
    }
    
    const adTimerElement = document.getElementById('ad-timer');
    const skipButton = document.getElementById('ad-skip-button');
    const skipTimerElement = document.getElementById('skip-timer');
    
    if (!adTimerElement || !skipButton || !skipTimerElement) {
      console.error('Ad elements not found');
      return;
    }
    
    // Show ad modal
    adModal.style.display = 'block';
  
    // Simulate ad playback
    let adDuration = 10; 
    let skipDuration = 3; 
    
    // Update ad timer every second
    const adInterval = setInterval(() => {
      adTimerElement.textContent = `${adDuration}s`;
      adDuration--;
      
      if (adDuration < 0) {
        clearInterval(adInterval);
        completeAd();
      }
    }, 1000);
    
    // Update skip timer
    const skipInterval = setInterval(() => {
      skipTimerElement.textContent = skipDuration;
      skipDuration--;
      
      if (skipDuration < 0) {
        clearInterval(skipInterval);
        skipButton.disabled = false;
        skipButton.textContent = 'Skip Ad';
      }
    }, 1000);
    
    // Skip button event
    skipButton.addEventListener('click', function skipHandler() {
      if (!skipButton.disabled) {
        clearInterval(adInterval);
        clearInterval(skipInterval);
        skipButton.removeEventListener('click', skipHandler);
        completeAd();
      }
    });
    
    // Complete ad function
    async function completeAd() {
      // Hide ad modal
      adModal.style.display = 'none';
      
      // Update user profile
      lastAdWatched = new Date().toISOString();
      
      // Update in database
      if (currentUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            last_ad_watched: lastAdWatched,
            scans_remaining: 999 
          })
          .eq('id', currentUser.id);
        
        if (error) {
          console.error('Error updating ad watched time:', error);
        }
        
        // Update analytics
        try {
          const { error: analyticsError } = await supabase
            .from('analytics')
            .insert([{
              user_id: currentUser.id,
              event_type: 'ad_watched',
              event_data: {}
            }]);
          
          if (analyticsError) {
            console.error('Error logging analytics:', analyticsError);
          }
        } catch (analyticsEx) {
          console.error('Exception logging analytics:', analyticsEx);
        }
      }
      
      // Update local user profile
      if (userProfile) {
        userProfile.last_ad_watched = lastAdWatched;
        userProfile.scans_remaining = 999; 
      }
      
      // Hide premium notification
      const premiumNotification = document.getElementById('premium-notification');
      if (premiumNotification) {
        premiumNotification.style.display = 'none';
      }
      
      // Show success notification
      alert('Thank you for watching! Unlimited scans unlocked for 24 hours.');
    }
  } catch (error) {
    console.error('Error showing ad:', error);
    alert('An error occurred while trying to show the ad. Please try again.');
  }
}

// Reset user's scan count after watching an ad
async function resetScansAfterAd() {
  if (!currentUser) return false;
  
  try {
    // Get the system settings to determine max scans
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('free_scans_per_day')
      .single();
    
    const defaultScans = 5;
    const maxScans = settingsData?.free_scans_per_day || defaultScans;
    
    // Update the user's scans_remaining to max value
    const { error } = await supabase
      .from('profiles')
      .update({ scans_remaining: 999 }) 
      .eq('id', currentUser.id);
    
    if (error) {
      console.error('Error resetting scans count:', error);
      return false;
    }
    
    // Update local user profile
    if (userProfile) {
      userProfile.scans_remaining = 999;
    }
    
    return true;
  } catch (error) {
    console.error('Error in resetScansAfterAd:', error);
    return false;
  }
}

// Update scans remaining for user
async function updateScansRemaining(scansUsed = 1) {
  if (!currentUser) return true;
  
  // Check if user profile exists
  if (!userProfile) {
    await fetchUserProfile();
    // Create profile if it doesn't exist
    if (!userProfile) {
      userProfile = await createUserProfile();
      if (!userProfile) return false;
    }
  }
  
  // Ensure scans_remaining has a valid value
  if (!userProfile.scans_remaining && userProfile.scans_remaining !== 0) {
    userProfile.scans_remaining = 5;
  }
  
  if (userProfile.scans_remaining <= 0) {
    // Out of scans, show notification
    if (premiumNotification) premiumNotification.style.display = 'flex';
    return false;
  }
  
  const newScansRemaining = userProfile.scans_remaining - scansUsed;
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ scans_remaining: newScansRemaining })
      .eq('id', currentUser.id);
    
    if (error) throw error;
    
    userProfile.scans_remaining = newScansRemaining;
    return true;
  } catch (error) {
    console.error('Error updating scans remaining:', error);
    return false;
  }
}

// Reset daily scan count
async function resetDailyScanCount() {
  if (!currentUser) return;
  
  const lastReset = new Date(userProfile.last_scan_reset);
  const now = new Date();
  const dayDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
  
  if (dayDiff >= 1) {
    const { error } = await supabase
      .from('profiles')
      .update({
        scans_remaining: 5, 
        last_scan_reset: now.toISOString()
      })
      .eq('id', currentUser.id);
    
    if (error) {
      console.error('Error resetting scan count:', error);
      return;
    }
    
    userProfile.scans_remaining = 5;
    userProfile.last_scan_reset = now.toISOString();
  }
}

// Update user profile
async function updateProfile(profileData) {
  if (!currentUser) return;
  
  const { error } = await supabase
    .from('profiles')
    .update(profileData)
    .eq('id', currentUser.id);
  
  if (error) {
    console.error('Error updating profile:', error);
    return false;
  }
  
  // Update local user profile data
  userProfile = { ...userProfile, ...profileData };
  updateUIForUser();
  
  return true;
}

// Show profile modal
function showProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) {
    console.error('Profile modal element not found');
    return;
  }
  
  // Ensure the user profile data is loaded before proceeding
  if (!userProfile) {
    fetchUserProfile().then(() => {
      if (userProfile) {
        populateProfileModal();
      } else {
        console.error('Failed to load user profile');
        alert('Unable to load profile data. Please try again.');
      }
    }).catch(error => {
      console.error('Error fetching profile data:', error);
      alert('Unable to load profile data. Please try again.');
    });
  } else {
    populateProfileModal();
  }
  
  // Show modal
  profileModal.style.display = 'block';
}

// Helper function to populate profile modal with data
function populateProfileModal() {
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const planInput = document.getElementById('profile-plan');
  const avatarImg = document.getElementById('profile-avatar-img');
  const freePlan = document.getElementById('free-plan');
  const proPlan = document.getElementById('pro-plan');
  const currentPlanBtn = document.getElementById('current-plan-btn');
  const upgradePlanBtn = document.getElementById('upgrade-plan-btn');
  
  // Check if essential elements exist before proceeding
  if (!nameInput || !emailInput) {
    console.error('Essential profile elements not found');
    return;
  }
  
  // Fill profile data
  nameInput.value = userProfile?.full_name || '';
  emailInput.value = currentUser?.email || '';
  if (planInput) planInput.value = 'Free';
  
  if (userProfile?.avatar_url) {
    avatarImg.src = userProfile.avatar_url;
  } else {
    avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameInput.value)}&background=random`;
  }
  
  // Show/hide plan buttons based on current plan - with null checks
  if (freePlan) freePlan.classList.add('active-plan');
  if (proPlan) proPlan.classList.remove('active-plan');
  if (currentPlanBtn) currentPlanBtn.style.display = 'none';
  if (upgradePlanBtn) {
    upgradePlanBtn.style.display = 'block';
    upgradePlanBtn.textContent = 'Watch Ad Now';
    upgradePlanBtn.disabled = false;
  }
  
  // Update ad rewards text
  const adRewardDesc = document.querySelector('.ad-setting-item:nth-child(2) p');
  if (adRewardDesc) {
    adRewardDesc.textContent = 'Watching an ad unlocks unlimited scans for 24 hours.';
  }

  // Form submission
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      
      const newName = nameInput.value.trim();
      const newPassword = document.getElementById('profile-password')?.value.trim() || '';
      
      let updateData = {};
      
      if (newName && newName !== userProfile?.full_name) {
        updateData.full_name = newName;
      }
      
      // Update profile in supabase
      if (Object.keys(updateData).length > 0) {
        const success = await updateProfile(updateData);
        
        if (success) {
          alert('Profile updated successfully!');
        } else {
          alert('Failed to update profile. Please try again.');
        }
      }
      
      // Update password if provided
      if (newPassword) {
        try {
          const { error } = await supabase.auth.updateUser({
            password: newPassword
          });
          
          if (error) throw error;
          
          alert('Password updated successfully!');
        } catch (error) {
          alert(`Failed to update password: ${error.message}`);
        }
      }
    };
  }
  
  // Change avatar
  const changeAvatarBtn = document.getElementById('change-avatar');
  if (changeAvatarBtn) {
    changeAvatarBtn.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 2 * 1024 * 1024) {
          alert('File size must be less than 2MB');
          return;
        }
        
        try {
          // Upload to supabase storage
          const fileName = `avatar-${currentUser.id}-${Date.now()}`;
          const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, file);
          
          if (error) throw error;
          
          // Get public URL
          const { data: urlData } = await supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          
          // Update profile with new avatar URL
          const avatarUrl = urlData.publicUrl;
          const success = await updateProfile({ avatar_url: avatarUrl });
          
          if (success) {
            avatarImg.src = avatarUrl;
            if (userAvatarElem) userAvatarElem.src = avatarUrl;
          }
          
        } catch (error) {
          alert(`Failed to upload avatar: ${error.message}`);
        }
      };
      
      input.click();
    };
  }
  
  // Upgrade plan button with null check
  if (upgradePlanBtn) {
    upgradePlanBtn.onclick = () => {
      watchAd();
    };
  }
}

// Show upgrade modal
function showUpgradeModal() {
  watchAd(); 
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication on page load
  checkAuth();
  
  // Logout event
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }
  
  // Profile link
  const profileLink = document.getElementById('profile-link');
  if (profileLink) {
    profileLink.addEventListener('click', (e) => {
      e.preventDefault();
      showProfileModal();
    });
  }
  
  // Admin link
  const adminLink = document.getElementById('admin-link');
  if (adminLink) {
    adminLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.admin && typeof window.admin.showAdminDashboard === 'function') {
        window.admin.showAdminDashboard();
      } else {
        console.error('Admin functionality not available');
      }
    });
  }
  
  // Watch ad button
  const watchAdButton = document.getElementById('watch-ad-button');
  if (watchAdButton) {
    watchAdButton.addEventListener('click', () => {
      watchAd();
    });
  }
  
  // Watch ad in profile modal
  const watchAdNow = document.getElementById('watch-ad-now');
  if (watchAdNow) {
    watchAdNow.addEventListener('click', () => {
      watchAd();
    });
  }
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
  
  // Close buttons in modals
  document.querySelectorAll('.close-modal').forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      modal.style.display = 'none';
    });
  });
});

// Check for auth errors in URL hash on page load
window.addEventListener('DOMContentLoaded', () => {
  const hash = window.location.hash;
  if (hash.includes('error=')) {
    const params = new URLSearchParams(hash.substring(1));
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    
    if (error === 'access_denied' && params.get('error_code') === 'otp_expired') {
      showResetPasswordForm();
      const errorElement = document.getElementById('reset-error');
      if (errorElement) {
        errorElement.style.display = 'block';
        errorElement.textContent = 'Email confirmation link has expired. Please request a new one.';
      }
    }
  }
});

// Export functions to be used in other scripts
window.auth = {
  checkAuth,
  updateScansRemaining,
  resetDailyScanCount,
  watchAd,
  currentUser: () => currentUser,
  userProfile: () => userProfile,
  isPremium: () => false, 
  lastAdWatched: () => lastAdWatched
};