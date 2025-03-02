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
let isPremium = false;
let lastAdWatched = null;

// Authentication state
async function checkAuth() {
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error checking authentication:', error);
    showLoginForm();
    return false;
  }
  
  if (data.session) {
    currentUser = data.session.user;
    await fetchUserProfile();
    updateUIForUser();
    return true;
  } else {
    showLoginForm();
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
  isPremium = data.is_premium;
  lastAdWatched = data.last_ad_watched;
}

// Create new user profile
async function createUserProfile() {
  if (!currentUser) return;
  
  const { data, error } = await supabase
    .from('profiles')
    .insert([{
      id: currentUser.id,
      full_name: currentUser.user_metadata?.full_name || 'User',
      avatar_url: currentUser.user_metadata?.avatar_url || null,
      email: currentUser.email,
      is_premium: false,
      is_admin: false,
      scans_remaining: 5,
      last_scan_reset: new Date().toISOString()
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating user profile:', error);
    return;
  }
  
  userProfile = data;
}

// Update UI for authenticated user
function updateUIForUser() {
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
  
  // Set user tier
  userTierElem.textContent = isPremium ? 'Pro' : 'Free';
  
  // Show admin link if user is admin
  if (userProfile?.is_admin) {
    adminLinkElem.style.display = 'flex';
  } else {
    adminLinkElem.style.display = 'none';
  }
  
  // Check if premium features should be unlocked by ad viewing
  checkAdUnlock();
}

// Check if user has watched an ad recently
function checkAdUnlock() {
  if (isPremium) {
    premiumNotification.style.display = 'none';
    return;
  }
  
  const now = new Date();
  const adWatchedTime = lastAdWatched ? new Date(lastAdWatched) : null;
  
  // Ad unlocks features for 24 hours
  if (adWatchedTime && ((now - adWatchedTime) / (1000 * 60 * 60)) < 24) {
    premiumNotification.style.display = 'none';
  } else {
    premiumNotification.style.display = 'flex';
  }
}

// Show the login form
function showLoginForm() {
  authContainer.style.display = 'flex';
  appContainer.style.display = 'none';
  
  // Clone template content
  const content = document.importNode(loginTemplate.content, true);
  authContainer.innerHTML = '';
  authContainer.appendChild(content);
  
  // Add event listeners
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-link').addEventListener('click', showRegisterForm);
  document.getElementById('forgot-password-link').addEventListener('click', showResetPasswordForm);
  document.getElementById('google-login').addEventListener('click', handleGoogleLogin);
  
  // Password visibility toggle
  const togglePassword = document.querySelector('.toggle-password');
  const passwordInput = document.getElementById('login-password');
  
  togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    togglePassword.classList.toggle('fa-eye');
    togglePassword.classList.toggle('fa-eye-slash');
  });
}

// Show the register form
function showRegisterForm(e) {
  if (e) e.preventDefault();
  
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
    successElement.style.display = 'block';
    successElement.textContent = 'Password reset link sent! Please check your email.';
    
  } catch (error) {
    errorElement.style.display = 'block';
    errorElement.textContent = error.message || 'Failed to send reset link. Please try again.';
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
    isPremium = false;
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
  const adModal = document.getElementById('ad-modal');
  const adTimerElement = document.getElementById('ad-timer');
  const skipButton = document.getElementById('ad-skip-button');
  const skipTimerElement = document.getElementById('skip-timer');
  
  // Show ad modal
  adModal.style.display = 'block';
  
  // Simulate ad playback
  let adDuration = 30;
  let skipDuration = 5;
  
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
  skipButton.addEventListener('click', () => {
    if (!skipButton.disabled) {
      clearInterval(adInterval);
      clearInterval(skipInterval);
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
        .update({ last_ad_watched: lastAdWatched })
        .eq('id', currentUser.id);
      
      if (error) {
        console.error('Error updating ad watched time:', error);
      }
      
      // Update analytics
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
    }
    
    // Hide premium notification
    premiumNotification.style.display = 'none';
    
    // Show success notification
    alert('Thank you for watching! Premium features unlocked for 24 hours.');
  }
}

// Update scans remaining for user
async function updateScansRemaining(scansUsed = 1) {
  if (!currentUser) return true;
  if (isPremium) return true;
  
  // Check if userProfile exists
  if (!userProfile) {
    await fetchUserProfile();
    // If still no profile, create one
    if (!userProfile) {
      await createUserProfile();
      if (!userProfile) return false;
    }
  }
  
  if (userProfile.scans_remaining <= 0) {
    // Out of scans, show notification
    alert('You have reached your daily scan limit. Upgrade to Pro or watch an ad to continue.');
    return false;
  }
  
  const newScansRemaining = userProfile.scans_remaining - scansUsed;
  
  const { error } = await supabase
    .from('profiles')
    .update({ scans_remaining: newScansRemaining })
    .eq('id', currentUser.id);
  
  if (error) {
    console.error('Error updating scans remaining:', error);
    return false;
  }
  
  userProfile.scans_remaining = newScansRemaining;
  return true;
}

// Reset daily scan count
async function resetDailyScanCount() {
  if (!currentUser || isPremium) return;
  
  const lastReset = new Date(userProfile.last_scan_reset);
  const now = new Date();
  const dayDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
  
  if (dayDiff >= 1) {
    const { error } = await supabase
      .from('profiles')
      .update({
        scans_remaining: 5, // Default daily scan limit
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

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication on page load
  checkAuth();
  
  // Logout event
  document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    handleLogout();
  });
  
  // Profile link
  document.getElementById('profile-link').addEventListener('click', (e) => {
    e.preventDefault();
    showProfileModal();
  });
  
  // Admin link
  document.getElementById('admin-link').addEventListener('click', (e) => {
    e.preventDefault();
    showAdminDashboard();
  });
  
  // Watch ad button
  document.getElementById('watch-ad-button').addEventListener('click', () => {
    watchAd();
  });
  
  // Upgrade button
  document.getElementById('upgrade-button').addEventListener('click', () => {
    showUpgradeModal();
  });
  
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

// Show profile modal
function showProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const planInput = document.getElementById('profile-plan');
  const avatarImg = document.getElementById('profile-avatar-img');
  const freePlan = document.getElementById('free-plan');
  const proPlan = document.getElementById('pro-plan');
  const currentPlanBtn = document.getElementById('current-plan-btn');
  const upgradePlanBtn = document.getElementById('upgrade-plan-btn');
  
  // Fill profile data
  nameInput.value = userProfile?.full_name || '';
  emailInput.value = currentUser?.email || '';
  planInput.value = isPremium ? 'Pro' : 'Free';
  
  if (userProfile?.avatar_url) {
    avatarImg.src = userProfile.avatar_url;
  } else {
    avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameInput.value)}&background=random`;
  }
  
  // Show/hide plan buttons based on current plan
  if (isPremium) {
    freePlan.classList.remove('active-plan');
    proPlan.classList.add('active-plan');
    currentPlanBtn.style.display = 'none';
    upgradePlanBtn.style.display = 'block';
    upgradePlanBtn.textContent = 'Current Plan';
    upgradePlanBtn.disabled = true;
  } else {
    freePlan.classList.add('active-plan');
    proPlan.classList.remove('active-plan');
    currentPlanBtn.style.display = 'block';
    upgradePlanBtn.style.display = 'block';
    upgradePlanBtn.textContent = 'Upgrade';
    upgradePlanBtn.disabled = false;
  }
  
  // Form submission
  document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const newName = nameInput.value.trim();
    const newPassword = document.getElementById('profile-password').value.trim();
    
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
  
  // Change avatar
  document.getElementById('change-avatar').onclick = () => {
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
          userAvatarElem.src = avatarUrl;
        }
        
      } catch (error) {
        alert(`Failed to upload avatar: ${error.message}`);
      }
    };
    
    input.click();
  };
  
  // Upgrade plan
  upgradePlanBtn.onclick = () => {
    if (!isPremium) {
      showUpgradeModal();
    }
  };
  
  // Show modal
  profileModal.style.display = 'block';
}

// Show upgrade modal
function showUpgradeModal() {
  alert('This is a demo version. In a real application, this would redirect to a payment processor.');
  
  // In a real app, you would redirect to Stripe or another payment processor
  // And then handle the webhook from Stripe to update the user's subscription
}

// Export functions to be used in other scripts
window.auth = {
  checkAuth,
  updateScansRemaining,
  resetDailyScanCount,
  watchAd,
  currentUser: () => currentUser,
  userProfile: () => userProfile,
  isPremium: () => isPremium,
  lastAdWatched: () => lastAdWatched
};