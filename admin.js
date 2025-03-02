// Admin Dashboard Functionality

// DOM elements
const adminDashboard = document.getElementById('admin-dashboard');
const adminTabs = document.querySelectorAll('.admin-tab');
const adminTabContents = document.querySelectorAll('.admin-tab-content');
const usersTableBody = document.getElementById('users-table-body');
const adsTableBody = document.getElementById('ads-table-body');
const totalUsersElement = document.getElementById('total-users');
const proUsersElement = document.getElementById('pro-users');
const totalScansElement = document.getElementById('total-scans');
const adsWatchedElement = document.getElementById('ads-watched');
const settingsForm = document.getElementById('settings-form');

// Global variables
let currentPage = 1;
let pageSize = 10;
let totalUsers = 0;
let userChartInstance = null;
let scansChartInstance = null;

// Show the admin dashboard
function showAdminDashboard() {
  // Verify user is admin
  const userProfile = window.auth.userProfile();
  if (!userProfile || !userProfile.is_admin) {
    alert('You do not have permission to access the admin dashboard.');
    return;
  }
  
  adminDashboard.style.display = 'block';
  loadUsers();
  loadAnalytics();
  loadAds();
  loadSettings();
}

// Load users for the users tab
async function loadUsers() {
  try {
    // Get count for pagination
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    totalUsers = count;
    
    // Get paginated users
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Update UI
    renderUsersTable(data);
    updatePagination();
    
  } catch (error) {
    console.error('Error loading users:', error);
    alert('Failed to load users. Please try again.');
  }
}

// Render users table
function renderUsersTable(users) {
  usersTableBody.innerHTML = '';
  
  if (!users || users.length === 0) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">No users found</td>
      </tr>
    `;
    return;
  }
  
  users.forEach(user => {
    const createdDate = new Date(user.created_at).toLocaleDateString();
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.id.substring(0, 8)}...</td>
      <td>${user.full_name || 'N/A'}</td>
      <td>${user.email || 'N/A'}</td>
      <td>
        <span class="status-badge ${user.is_premium ? 'badge-success' : 'badge-secondary'}">
          ${user.is_premium ? 'Pro' : 'Free'}
        </span>
      </td>
      <td>${createdDate}</td>
      <td>
        <button class="action-btn edit-user" data-id="${user.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn delete-user" data-id="${user.id}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    
    usersTableBody.appendChild(row);
  });
  
  // Add event listeners to buttons
  document.querySelectorAll('.edit-user').forEach(btn => {
    btn.addEventListener('click', () => editUser(btn.dataset.id));
  });
  
  document.querySelectorAll('.delete-user').forEach(btn => {
    btn.addEventListener('click', () => deleteUser(btn.dataset.id));
  });
}

// Update pagination UI
function updatePagination() {
  const totalPages = Math.ceil(totalUsers / pageSize);
  document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
  
  document.getElementById('prev-page').disabled = currentPage <= 1;
  document.getElementById('next-page').disabled = currentPage >= totalPages;
}

// Edit user
function editUser(userId) {
  // Implement user editing functionality
  alert(`Edit user functionality would open a modal for user ID: ${userId}`);
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
    return;
  }
  
  try {
    // Delete user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (profileError) throw profileError;
    
    // In a real application, you would also delete the user from auth.users
    // This requires admin privileges with Supabase
    
    alert('User deleted successfully');
    loadUsers();
    loadAnalytics();
    
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(`Failed to delete user: ${error.message}`);
  }
}

// Load analytics data
async function loadAnalytics() {
  try {
    // Get total users count
    const { count: userCount, error: userCountError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (userCountError) throw userCountError;
    
    // Get premium users count
    const { count: premiumCount, error: premiumCountError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_premium', true);
    
    if (premiumCountError) throw premiumCountError;
    
    // Get total scans count
    const { count: scanCount, error: scanCountError } = await supabase
      .from('scan_history')
      .select('*', { count: 'exact', head: true });
    
    if (scanCountError) throw scanCountError;
    
    // Get ads watched count
    const { count: adCount, error: adCountError } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'ad_watched');
    
    if (adCountError) throw adCountError;
    
    // Update UI
    totalUsersElement.textContent = userCount;
    proUsersElement.textContent = premiumCount;
    totalScansElement.textContent = scanCount || 0;
    adsWatchedElement.textContent = adCount || 0;
    
    // Create charts
    createUserChart();
    createScansChart();
    
  } catch (error) {
    console.error('Error loading analytics:', error);
    alert('Failed to load analytics data. Please try again.');
  }
}

// Create user growth chart
async function createUserChart() {
  try {
    // Get user signups by date for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    if (error) throw error;
    
    // Process data for chart
    const dateMap = {};
    const labels = [];
    
    // Initialize all dates in the range
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateMap[dateStr] = 0;
    }
    
    // Count signups by date
    data.forEach(user => {
      const dateStr = user.created_at.split('T')[0];
      if (dateMap[dateStr] !== undefined) {
        dateMap[dateStr]++;
      }
    });
    
    // Sort dates and prepare chart data
    const sortedDates = Object.keys(dateMap).sort();
    const chartData = sortedDates.map(date => dateMap[date]);
    
    // Format dates for display
    const formattedLabels = sortedDates.map(date => {
      const d = new Date(date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    
    // Create chart
    const ctx = document.getElementById('users-chart').getContext('2d');
    
    if (userChartInstance) {
      userChartInstance.destroy();
    }
    
    userChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: formattedLabels,
        datasets: [{
          label: 'New Users',
          data: chartData,
          backgroundColor: 'rgba(79, 70, 229, 0.2)',
          borderColor: 'rgba(79, 70, 229, 1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: 'User Growth (Last 30 Days)',
            font: {
              size: 16
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating user chart:', error);
  }
}

// Create scans chart
async function createScansChart() {
  try {
    // Get scan counts by date for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data, error } = await supabase
      .from('scan_history')
      .select('created_at, scan_type')
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    if (error) throw error;
    
    // Process data for chart
    const dateMap = {};
    const labelScans = {};
    const foodScans = {};
    const gymScans = {};
    
    // Initialize all dates in the range
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      labelScans[dateStr] = 0;
      foodScans[dateStr] = 0;
      gymScans[dateStr] = 0;
    }
    
    // Count scans by date and type
    data.forEach(scan => {
      const dateStr = scan.created_at.split('T')[0];
      if (labelScans[dateStr] !== undefined) {
        if (scan.scan_type === 'label') {
          labelScans[dateStr]++;
        } else if (scan.scan_type === 'food') {
          foodScans[dateStr]++;
        } else if (scan.scan_type === 'gym') {
          gymScans[dateStr]++;
        }
      }
    });
    
    // Sort dates and prepare chart data
    const sortedDates = Object.keys(labelScans).sort();
    
    // Format dates for display
    const formattedLabels = sortedDates.map(date => {
      const d = new Date(date);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    
    // Prepare datasets
    const labelData = sortedDates.map(date => labelScans[date]);
    const foodData = sortedDates.map(date => foodScans[date]);
    const gymData = sortedDates.map(date => gymScans[date]);
    
    // Create chart
    const ctx = document.getElementById('scans-chart').getContext('2d');
    
    if (scansChartInstance) {
      scansChartInstance.destroy();
    }
    
    scansChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: formattedLabels,
        datasets: [
          {
            label: 'Label Scans',
            data: labelData,
            backgroundColor: 'rgba(79, 70, 229, 0.7)',
            borderWidth: 0
          },
          {
            label: 'Food Scans',
            data: foodData,
            backgroundColor: 'rgba(14, 165, 233, 0.7)',
            borderWidth: 0
          },
          {
            label: 'Gym Scans',
            data: gymData,
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: 'Scans by Type (Last 30 Days)',
            font: {
              size: 16
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            ticks: {
              precision: 0
            }
          },
          x: {
            stacked: true
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating scans chart:', error);
  }
}

// Load ads data
async function loadAds() {
  try {
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Render ads table
    adsTableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
      adsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">No ads found</td>
        </tr>
      `;
      return;
    }
    
    data.forEach(ad => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${ad.id}</td>
        <td>${ad.name}</td>
        <td>${ad.type}</td>
        <td>${ad.duration} seconds</td>
        <td>
          <span class="status-badge ${ad.active ? 'badge-success' : 'badge-secondary'}">
            ${ad.active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <button class="action-btn edit-ad" data-id="${ad.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn toggle-ad" data-id="${ad.id}" data-active="${ad.active}">
            <i class="fas fa-${ad.active ? 'pause' : 'play'}"></i>
          </button>
          <button class="action-btn delete-ad" data-id="${ad.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      
      adsTableBody.appendChild(row);
    });
    
    // Add event listeners
    document.querySelectorAll('.edit-ad').forEach(btn => {
      btn.addEventListener('click', () => editAd(btn.dataset.id));
    });
    
    document.querySelectorAll('.toggle-ad').forEach(btn => {
      btn.addEventListener('click', () => toggleAd(btn.dataset.id, btn.dataset.active === 'true'));
    });
    
    document.querySelectorAll('.delete-ad').forEach(btn => {
      btn.addEventListener('click', () => deleteAd(btn.dataset.id));
    });
    
  } catch (error) {
    console.error('Error loading ads:', error);
    alert('Failed to load ads. Please try again.');
  }
}

// Edit ad
function editAd(adId) {
  alert(`Edit ad functionality would open a modal for ad ID: ${adId}`);
}

// Toggle ad active status
async function toggleAd(adId, currentActive) {
  try {
    const { error } = await supabase
      .from('ads')
      .update({ active: !currentActive })
      .eq('id', adId);
    
    if (error) throw error;
    
    loadAds();
    
  } catch (error) {
    console.error('Error toggling ad:', error);
    alert(`Failed to update ad: ${error.message}`);
  }
}

// Delete ad
async function deleteAd(adId) {
  if (!confirm('Are you sure you want to delete this ad?')) {
    return;
  }
  
  try {
    const { error } = await supabase
      .from('ads')
      .delete()
      .eq('id', adId);
    
    if (error) throw error;
    
    loadAds();
    
  } catch (error) {
    console.error('Error deleting ad:', error);
    alert(`Failed to delete ad: ${error.message}`);
  }
}

// Load system settings
async function loadSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      document.getElementById('free-scans').value = data.free_scans_per_day;
      document.getElementById('ad-duration').value = data.ad_unlock_hours;
      document.getElementById('enable-ads').checked = data.ads_enabled;
      document.getElementById('enable-registration').checked = data.registration_enabled;
    }
    
  } catch (error) {
    console.error('Error loading settings:', error);
    alert('Failed to load system settings. Please try again.');
  }
}

// Save system settings
async function saveSettings(e) {
  e.preventDefault();
  
  const settings = {
    free_scans_per_day: parseInt(document.getElementById('free-scans').value),
    ad_unlock_hours: parseInt(document.getElementById('ad-duration').value),
    ads_enabled: document.getElementById('enable-ads').checked,
    registration_enabled: document.getElementById('enable-registration').checked
  };
  
  try {
    // Check if settings exist
    const { data, error } = await supabase
      .from('system_settings')
      .select('id')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    let result;
    
    if (data) {
      // Update existing settings
      result = await supabase
        .from('system_settings')
        .update(settings)
        .eq('id', data.id);
    } else {
      // Insert new settings
      result = await supabase
        .from('system_settings')
        .insert([settings]);
    }
    
    if (result.error) throw result.error;
    
    alert('Settings saved successfully');
    
  } catch (error) {
    console.error('Error saving settings:', error);
    alert(`Failed to save settings: ${error.message}`);
  }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      adminTabs.forEach(t => t.classList.remove('active'));
      adminTabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
    });
  });
  
  // Pagination
  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadUsers();
    }
  });
  
  document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(totalUsers / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      loadUsers();
    }
  });
  
  // Search users
  document.getElementById('search-button').addEventListener('click', () => {
    const searchTerm = document.getElementById('user-search').value.trim();
    searchUsers(searchTerm);
  });
  
  document.getElementById('user-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const searchTerm = e.target.value.trim();
      searchUsers(searchTerm);
    }
  });
  
  // Add new ad button
  document.getElementById('add-ad-button').addEventListener('click', () => {
    showAddAdModal();
  });
  
  // Settings form
  settingsForm.addEventListener('submit', saveSettings);
});

// Search users
async function searchUsers(searchTerm) {
  if (!searchTerm) {
    currentPage = 1;
    loadUsers();
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    
    if (error) throw error;
    
    renderUsersTable(data);
    
    // Update pagination text
    document.getElementById('page-info').textContent = `Search Results: ${data.length} user(s)`;
    
    // Disable pagination buttons for search results
    document.getElementById('prev-page').disabled = true;
    document.getElementById('next-page').disabled = true;
    
  } catch (error) {
    console.error('Error searching users:', error);
    alert(`Search failed: ${error.message}`);
  }
}

// Show add ad modal
function showAddAdModal() {
  alert('This would open a modal to add a new ad. Implementation left as an exercise.');
  
  // In a real application, you would:
  // 1. Open a modal with a form
  // 2. Allow uploading or linking to ad media
  // 3. Set ad properties (name, type, duration, etc.)
  // 4. Save to the 'ads' table in Supabase
}

// Export admin functionality
window.admin = {
  showAdminDashboard,
  loadUsers,
  loadAnalytics,
  loadAds,
  loadSettings
};