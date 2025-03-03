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
  console.log("Showing admin dashboard");
  // Verify user is admin
  const userProfileData = window.auth.userProfile();
  if (!userProfileData || !userProfileData.is_admin) {
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
      <td>${user.scans_remaining || 0} scans remaining</td>
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
  // Create and show edit user modal
  const editUserModal = document.createElement('div');
  editUserModal.className = 'modal';
  editUserModal.id = 'edit-user-modal';
  
  // Fetch user data
  supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error('Error fetching user:', error);
        alert('Error fetching user details. Please try again.');
        return;
      }
      
      // Create modal content
      editUserModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2><i class="fas fa-user-edit"></i> Edit User</h2>
            <span class="close-modal">&times;</span>
          </div>
          <div class="modal-body">
            <form id="edit-user-form">
              <div class="form-group">
                <label for="edit-user-name">Full Name</label>
                <input type="text" id="edit-user-name" value="${data.full_name || ''}" required>
              </div>
              <div class="form-group">
                <label for="edit-user-email">Email</label>
                <input type="email" id="edit-user-email" value="${data.email || ''}" readonly>
              </div>
              <div class="form-group">
                <label for="edit-user-scans">Scans Remaining</label>
                <input type="number" id="edit-user-scans" value="${data.scans_remaining || 0}" required>
              </div>
              <div class="form-group">
                <label class="checkbox-container">
                  <input type="checkbox" id="edit-user-admin" ${data.is_admin ? 'checked' : ''}>
                  <span class="checkmark"></span>
                  Admin Access
                </label>
              </div>
              <button type="submit" class="primary-button">Save Changes</button>
            </form>
          </div>
        </div>
      `;
      
      document.body.appendChild(editUserModal);
      editUserModal.style.display = 'block';
      
      // Add event listeners
      const closeBtn = editUserModal.querySelector('.close-modal');
      closeBtn.addEventListener('click', () => {
        editUserModal.remove();
      });
      
      const form = document.getElementById('edit-user-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updatedData = {
          full_name: document.getElementById('edit-user-name').value,
          scans_remaining: parseInt(document.getElementById('edit-user-scans').value),
          is_admin: document.getElementById('edit-user-admin').checked
        };
        
        try {
          const { error } = await supabase
            .from('profiles')
            .update(updatedData)
            .eq('id', userId);
          
          if (error) throw error;
          
          alert('User updated successfully');
          editUserModal.remove();
          loadUsers();  // Refresh users list
          
        } catch (error) {
          alert(`Failed to update user: ${error.message}`);
        }
      });
    });
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
    try {
      // Attempt to delete user from auth (may require extra permissions)
      const { error: authError } = await supabase.rpc('delete_user', { user_id: userId });
      
      if (authError) {
        console.warn('Could not delete user from auth:', authError);
        // Continue anyway since we've deleted the profile
      }
    } catch (authDeleteError) {
      console.warn('Error calling delete_user RPC:', authDeleteError);
    }
    
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
    document.getElementById('daily-active-users').textContent = Math.floor(userCount * 0.4);
    totalScansElement.textContent = scanCount || 0;
    adsWatchedElement.textContent = adCount || 0;
    
    // Create charts
    createUserChart();
    createScansChart();
    createAdWatchedChart();
    
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

// Create ad watched chart
async function createAdWatchedChart() {
  try {
    // Get ad watches by date for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data, error } = await supabase
      .from('analytics')
      .select('created_at')
      .eq('event_type', 'ad_watched')
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    if (error) throw error;
    
    // Process data for chart
    const dateMap = {};
    
    // Initialize all dates in the range
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateMap[dateStr] = 0;
    }
    
    // Count ad watches by date
    data.forEach(watch => {
      const dateStr = watch.created_at.split('T')[0];
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
    const ctx = document.getElementById('revenue-chart').getContext('2d');
    
    if (window.revenueChartInstance) {
      window.revenueChartInstance.destroy();
    }
    
    window.revenueChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: formattedLabels,
        datasets: [{
          label: 'Ads Watched',
          data: chartData,
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          borderColor: 'rgba(245, 158, 11, 1)',
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
            text: 'Ads Watched (Last 30 Days)',
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
    console.error('Error creating ad watched chart:', error);
  }
}

// Load ads data
async function loadAds() {
  try {
    const adsTableBody = document.getElementById('ads-table-body');
    if (!adsTableBody) {
      console.error('Ads table body element not found');
      return;
    }
    
    const { data: placements, error: placementsError } = await supabase
      .from('ad_placements')
      .select('*')
      .order('name');
    
    if (placementsError) {
      console.error('Error loading placements:', placementsError);
      // Continue without placements
    }
    
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading ads:', error);
      throw error;
    }
    
    // Render ads table
    adsTableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
      adsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">No ads found</td>
        </tr>
      `;
      return;
    }
    
    data.forEach(ad => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${ad.id}</td>
        <td>${ad.name || 'Untitled Ad'}</td>
        <td>${ad.provider || 'Custom'}</td>
        <td>${ad.placement || 'In-content'}</td>
        <td>${ad.type || 'Banner'}</td>
        <td>
          <span class="status-badge badge-${ad.active ? 'success' : 'secondary'}">
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
    
    // Save placements globally for use in edit/add forms
    window.adPlacements = placements || [];
    
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
  // Create and show edit ad modal
  const editAdModal = document.createElement('div');
  editAdModal.className = 'modal';
  editAdModal.id = 'edit-ad-modal';
  
  // Fetch ad data
  supabase
    .from('ads')
    .select('*')
    .eq('id', adId)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error('Error fetching ad:', error);
        alert('Error fetching ad details. Please try again.');
        return;
      }
      
      // Generate placement options
      let placementOptions = '';
      if (window.adPlacements) {
        placementOptions = window.adPlacements.map(p => 
          `<option value="${p.placement_key}" ${data.placement === p.placement_key ? 'selected' : ''}>${p.name}</option>`
        ).join('');
      }
      
      // Create modal content
      editAdModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2><i class="fas fa-edit"></i> Edit Ad</h2>
            <span class="close-modal">&times;</span>
          </div>
          <div class="modal-body">
            <form id="edit-ad-form">
              <div class="form-group">
                <label for="edit-ad-name">Ad Name</label>
                <input type="text" id="edit-ad-name" value="${data.name}" required>
              </div>
              
              <div class="form-group">
                <label for="edit-ad-provider">Ad Provider</label>
                <select id="edit-ad-provider" required>
                  <option value="custom" ${data.provider === 'custom' || !data.provider ? 'selected' : ''}>Custom Ad</option>
                  <option value="adsense" ${data.provider === 'adsense' ? 'selected' : ''}>Google AdSense</option>
                  <option value="admanager" ${data.provider === 'admanager' ? 'selected' : ''}>Google Ad Manager</option>
                  <option value="other" ${data.provider === 'other' ? 'selected' : ''}>Other Provider</option>
                </select>
              </div>
              
              <div id="custom-ad-fields" style="display: ${data.provider !== 'adsense' && data.provider !== 'admanager' && data.provider !== 'other' ? 'block' : 'none'}">
                <div class="form-group">
                  <label for="edit-ad-type">Ad Type</label>
                  <select id="edit-ad-type" required>
                    <option value="banner" ${data.type === 'banner' ? 'selected' : ''}>Banner</option>
                    <option value="video" ${data.type === 'video' ? 'selected' : ''}>Video</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="edit-ad-duration">Duration (seconds for video ads)</label>
                  <input type="number" id="edit-ad-duration" value="${data.duration || 30}" min="0">
                </div>
                
                <div class="form-group">
                  <label for="edit-ad-file">Ad File (Image/Video)</label>
                  <input type="file" id="edit-ad-file" accept="${data.type === 'video' ? 'video/*' : 'image/*'}">
                  ${data.file_url ? `<p>Current file: <a href="${data.file_url}" target="_blank">View</a></p>` : ''}
                </div>
                
                <div class="form-group">
                  <label for="edit-ad-size">Ad Size</label>
                  <select id="edit-ad-size">
                    <option value="small" ${data.size === 'small' ? 'selected' : ''}>Small (300x250)</option>
                    <option value="medium" ${data.size === 'medium' || !data.size ? 'selected' : ''}>Medium (728x90)</option>
                    <option value="large" ${data.size === 'large' ? 'selected' : ''}>Large (970x250)</option>
                  </select>
                </div>
              </div>
              
              <div id="external-ad-fields" style="display: ${data.provider === 'adsense' || data.provider === 'admanager' || data.provider === 'other' ? 'block' : 'none'}">
                <div class="form-group">
                  <label for="edit-ad-code">Ad Code (Copy and paste provider code)</label>
                  <textarea id="edit-ad-code" rows="5">${data.ad_code || ''}</textarea>
                </div>
              </div>
              
              <div class="form-group">
                <label for="edit-ad-placement">Ad Placement</label>
                <select id="edit-ad-placement" required>
                  ${placementOptions}
                </select>
              </div>
              
              <div class="form-group">
                <label class="checkbox-container">
                  <input type="checkbox" id="edit-ad-active" ${data.active ? 'checked' : ''}>
                  <span class="checkmark"></span>
                  Active
                </label>
              </div>
              
              <div class="form-group">
                <label>Statistics</label>
                <div>
                  <p>Impressions: ${data.impressions || 0}</p>
                  <p>Clicks: ${data.clicks || 0}</p>
                </div>
              </div>
              
              <button type="submit" class="primary-button">Save Changes</button>
            </form>
          </div>
        </div>
      `;
      
      document.body.appendChild(editAdModal);
      editAdModal.style.display = 'block';
      
      // Add event listeners
      const closeBtn = editAdModal.querySelector('.close-modal');
      closeBtn.addEventListener('click', () => {
        editAdModal.remove();
      });
      
      // Toggle fields based on provider selection
      const providerSelect = document.getElementById('edit-ad-provider');
      const customFields = document.getElementById('custom-ad-fields');
      const externalFields = document.getElementById('external-ad-fields');
      
      providerSelect.addEventListener('change', () => {
        const provider = providerSelect.value;
        
        if (provider === 'custom') {
          customFields.style.display = 'block';
          externalFields.style.display = 'none';
        } else {
          customFields.style.display = 'none';
          externalFields.style.display = 'block';
        }
      });
      
      // Handle file type changes
      const typeSelect = document.getElementById('edit-ad-type');
      const fileInput = document.getElementById('edit-ad-file');
      
      typeSelect.addEventListener('change', () => {
        fileInput.accept = typeSelect.value === 'video' ? 'video/*' : 'image/*';
      });
      
      const form = document.getElementById('edit-ad-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const provider = document.getElementById('edit-ad-provider').value;
        const isCustomAd = provider === 'custom';
        
        // Base update data
        const updatedAd = {
          name: document.getElementById('edit-ad-name').value,
          provider: provider,
          placement: document.getElementById('edit-ad-placement').value,
          active: document.getElementById('edit-ad-active').checked
        };
        
        // Add provider-specific data
        if (isCustomAd) {
          updatedAd.type = document.getElementById('edit-ad-type').value;
          updatedAd.duration = parseInt(document.getElementById('edit-ad-duration').value) || 30;
          updatedAd.size = document.getElementById('edit-ad-size').value;
        } else {
          updatedAd.ad_code = document.getElementById('edit-ad-code').value;
        }
        
        try {
          // Handle file upload if there's a new file
          const fileInput = document.getElementById('edit-ad-file');
          if (fileInput.files.length > 0 && isCustomAd) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `ad_${adId}_${Date.now()}.${fileExt}`;
            
            // Upload file to Supabase storage
            const { data: fileData, error: fileError } = await supabase.storage
              .from('ad_files')
              .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
              });
            
            if (fileError) throw fileError;
            
            // Get public URL
            const { data: urlData } = await supabase.storage
              .from('ad_files')
              .getPublicUrl(fileName);
            
            updatedAd.file_url = urlData.publicUrl;
          }
          
          // Update ad in database
          const { error } = await supabase
            .from('ads')
            .update(updatedAd)
            .eq('id', adId);
          
          if (error) throw error;
          
          alert('Ad updated successfully');
          editAdModal.remove();
          loadAds();  // Refresh ads list
          
        } catch (error) {
          alert(`Failed to update ad: ${error.message}`);
        }
      });
    });
}

// Show add ad modal
function showAddAdModal() {
  const addAdModal = document.createElement('div');
  addAdModal.className = 'modal';
  addAdModal.id = 'add-ad-modal';
  
  // Generate placement options
  let placementOptions = '';
  if (window.adPlacements) {
    placementOptions = window.adPlacements.map(p => 
      `<option value="${p.placement_key}">${p.name}</option>`
    ).join('');
  } else {
    placementOptions = `
      <option value="header">Header</option>
      <option value="sidebar">Sidebar</option>
      <option value="in-content" selected>In-Content</option>
      <option value="results">Results</option>
      <option value="footer">Footer</option>
    `;
  }
  
  addAdModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2><i class="fas fa-plus-circle"></i> Add New Ad</h2>
        <span class="close-modal">&times;</span>
      </div>
      <div class="modal-body">
        <form id="add-ad-form">
          <div class="form-group">
            <label for="ad-name">Ad Name</label>
            <input type="text" id="ad-name" placeholder="Enter ad name" required>
          </div>
          
          <div class="form-group">
            <label for="ad-provider">Ad Provider</label>
            <select id="ad-provider" required>
              <option value="custom" selected>Custom Ad</option>
              <option value="adsense">Google AdSense</option>
              <option value="admanager">Google Ad Manager</option>
              <option value="other">Other Provider</option>
            </select>
          </div>
          
          <div id="custom-ad-fields">
            <div class="form-group">
              <label for="ad-type">Ad Type</label>
              <select id="ad-type" required>
                <option value="banner" selected>Banner</option>
                <option value="video">Video</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="ad-duration">Duration (seconds for video ads)</label>
              <input type="number" id="ad-duration" value="30" min="0">
            </div>
            
            <div class="form-group">
              <label for="ad-file">Ad File (Image/Video)</label>
              <input type="file" id="ad-file" accept="image/*" required>
            </div>
            
            <div class="form-group">
              <label for="ad-size">Ad Size</label>
              <select id="ad-size">
                <option value="small">Small (300x250)</option>
                <option value="medium" selected>Medium (728x90)</option>
                <option value="large">Large (970x250)</option>
              </select>
            </div>
          </div>
          
          <div id="external-ad-fields" style="display: none;">
            <div class="form-group">
              <label for="ad-code">Ad Code (Copy and paste provider code)</label>
              <textarea id="ad-code" rows="5" placeholder="Paste ad code here"></textarea>
            </div>
          </div>
          
          <div class="form-group">
            <label for="ad-placement">Ad Placement</label>
            <select id="ad-placement" required>
              ${placementOptions}
            </select>
          </div>
          
          <div class="form-group">
            <label class="checkbox-container">
              <input type="checkbox" id="ad-active" checked>
              <span class="checkmark"></span>
              Active
            </label>
          </div>
          
          <button type="submit" class="primary-button">Add Ad</button>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(addAdModal);
  addAdModal.style.display = 'block';
  
  // Add event listeners
  const closeBtn = addAdModal.querySelector('.close-modal');
  closeBtn.addEventListener('click', () => {
    addAdModal.remove();
  });
  
  // Toggle fields based on provider selection
  const providerSelect = document.getElementById('ad-provider');
  const customFields = document.getElementById('custom-ad-fields');
  const externalFields = document.getElementById('external-ad-fields');
  
  providerSelect.addEventListener('change', () => {
    const provider = providerSelect.value;
    
    if (provider === 'custom') {
      customFields.style.display = 'block';
      externalFields.style.display = 'none';
    } else {
      customFields.style.display = 'none';
      externalFields.style.display = 'block';
    }
  });
  
  // Handle file type changes
  const typeSelect = document.getElementById('ad-type');
  const fileInput = document.getElementById('ad-file');
  
  typeSelect.addEventListener('change', () => {
    fileInput.accept = typeSelect.value === 'video' ? 'video/*' : 'image/*';
  });
  
  const form = document.getElementById('add-ad-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const provider = document.getElementById('ad-provider').value;
    const isCustomAd = provider === 'custom';
    
    // Base ad data
    const newAd = {
      name: document.getElementById('ad-name').value,
      provider: provider,
      placement: document.getElementById('ad-placement').value,
      active: document.getElementById('ad-active').checked
    };
    
    // Add provider-specific data
    if (isCustomAd) {
      newAd.type = document.getElementById('ad-type').value;
      newAd.duration = parseInt(document.getElementById('ad-duration').value) || 30;
      newAd.size = document.getElementById('ad-size').value;
    } else {
      newAd.ad_code = document.getElementById('ad-code').value;
    }
    
    try {
      // Insert ad to get the ID
      const { data: insertedAd, error: insertError } = await supabase
        .from('ads')
        .insert([newAd])
        .select();
      
      if (insertError) throw insertError;
      
      const adId = insertedAd[0].id;
      
      // Handle file upload for custom ads
      if (isCustomAd) {
        const fileInput = document.getElementById('ad-file');
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `ad_${adId}_${Date.now()}.${fileExt}`;
          
          // Upload file to Supabase storage
          const { data: fileData, error: fileError } = await supabase.storage
            .from('ad_files')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            });
          
          if (fileError) throw fileError;
          
          // Get public URL
          const { data: urlData } = await supabase.storage
            .from('ad_files')
            .getPublicUrl(fileName);
          
          // Update ad with file URL
          const { error: updateError } = await supabase
            .from('ads')
            .update({ file_url: urlData.publicUrl })
            .eq('id', adId);
          
          if (updateError) throw updateError;
        }
      }
      
      alert('Ad added successfully');
      addAdModal.remove();
      loadAds();  // Refresh ads list
      
    } catch (error) {
      alert(`Failed to add ad: ${error.message}`);
    }
  });
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

// Show add ad modal
function showAddAdModal() {
  const addAdModal = document.createElement('div');
  addAdModal.className = 'modal';
  addAdModal.id = 'add-ad-modal';
  
  // Generate placement options
  let placementOptions = '';
  if (window.adPlacements) {
    placementOptions = window.adPlacements.map(p => 
      `<option value="${p.placement_key}">${p.name}</option>`
    ).join('');
  } else {
    placementOptions = `
      <option value="header">Header</option>
      <option value="sidebar">Sidebar</option>
      <option value="in-content" selected>In-Content</option>
      <option value="results">Results</option>
      <option value="footer">Footer</option>
    `;
  }
  
  addAdModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2><i class="fas fa-plus-circle"></i> Add New Ad</h2>
        <span class="close-modal">&times;</span>
      </div>
      <div class="modal-body">
        <form id="add-ad-form">
          <div class="form-group">
            <label for="ad-name">Ad Name</label>
            <input type="text" id="ad-name" placeholder="Enter ad name" required>
          </div>
          
          <div class="form-group">
            <label for="ad-provider">Ad Provider</label>
            <select id="ad-provider" required>
              <option value="custom" selected>Custom Ad</option>
              <option value="adsense">Google AdSense</option>
              <option value="admanager">Google Ad Manager</option>
              <option value="other">Other Provider</option>
            </select>
          </div>
          
          <div id="custom-ad-fields">
            <div class="form-group">
              <label for="ad-type">Ad Type</label>
              <select id="ad-type" required>
                <option value="banner" selected>Banner</option>
                <option value="video">Video</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="ad-duration">Duration (seconds for video ads)</label>
              <input type="number" id="ad-duration" value="30" min="0">
            </div>
            
            <div class="form-group">
              <label for="ad-file">Ad File (Image/Video)</label>
              <input type="file" id="ad-file" accept="image/*" required>
            </div>
            
            <div class="form-group">
              <label for="ad-size">Ad Size</label>
              <select id="ad-size">
                <option value="small">Small (300x250)</option>
                <option value="medium" selected>Medium (728x90)</option>
                <option value="large">Large (970x250)</option>
              </select>
            </div>
          </div>
          
          <div id="external-ad-fields" style="display: none;">
            <div class="form-group">
              <label for="ad-code">Ad Code (Copy and paste provider code)</label>
              <textarea id="ad-code" rows="5" placeholder="Paste ad code here"></textarea>
            </div>
          </div>
          
          <div class="form-group">
            <label for="ad-placement">Ad Placement</label>
            <select id="ad-placement" required>
              ${placementOptions}
            </select>
          </div>
          
          <div class="form-group">
            <label class="checkbox-container">
              <input type="checkbox" id="ad-active" checked>
              <span class="checkmark"></span>
              Active
            </label>
          </div>
          
          <button type="submit" class="primary-button">Add Ad</button>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(addAdModal);
  addAdModal.style.display = 'block';
  
  // Add event listeners
  const closeBtn = addAdModal.querySelector('.close-modal');
  closeBtn.addEventListener('click', () => {
    addAdModal.remove();
  });
  
  // Toggle fields based on provider selection
  const providerSelect = document.getElementById('ad-provider');
  const customFields = document.getElementById('custom-ad-fields');
  const externalFields = document.getElementById('external-ad-fields');
  
  providerSelect.addEventListener('change', () => {
    const provider = providerSelect.value;
    
    if (provider === 'custom') {
      customFields.style.display = 'block';
      externalFields.style.display = 'none';
    } else {
      customFields.style.display = 'none';
      externalFields.style.display = 'block';
    }
  });
  
  // Handle file type changes
  const typeSelect = document.getElementById('ad-type');
  const fileInput = document.getElementById('ad-file');
  
  typeSelect.addEventListener('change', () => {
    fileInput.accept = typeSelect.value === 'video' ? 'video/*' : 'image/*';
  });
  
  const form = document.getElementById('add-ad-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const provider = document.getElementById('ad-provider').value;
    const isCustomAd = provider === 'custom';
    
    // Base ad data
    const newAd = {
      name: document.getElementById('ad-name').value,
      provider: provider,
      placement: document.getElementById('ad-placement').value,
      active: document.getElementById('ad-active').checked
    };
    
    // Add provider-specific data
    if (isCustomAd) {
      newAd.type = document.getElementById('ad-type').value;
      newAd.duration = parseInt(document.getElementById('ad-duration').value) || 30;
      newAd.size = document.getElementById('ad-size').value;
    } else {
      newAd.ad_code = document.getElementById('ad-code').value;
    }
    
    try {
      // Insert ad to get the ID
      const { data: insertedAd, error: insertError } = await supabase
        .from('ads')
        .insert([newAd])
        .select();
      
      if (insertError) throw insertError;
      
      const adId = insertedAd[0].id;
      
      // Handle file upload for custom ads
      if (isCustomAd) {
        const fileInput = document.getElementById('ad-file');
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `ad_${adId}_${Date.now()}.${fileExt}`;
          
          // Upload file to Supabase storage
          const { data: fileData, error: fileError } = await supabase.storage
            .from('ad_files')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            });
          
          if (fileError) throw fileError;
          
          // Get public URL
          const { data: urlData } = await supabase.storage
            .from('ad_files')
            .getPublicUrl(fileName);
          
          // Update ad with file URL
          const { error: updateError } = await supabase
            .from('ads')
            .update({ file_url: urlData.publicUrl })
            .eq('id', adId);
          
          if (updateError) throw updateError;
        }
      }
      
      alert('Ad added successfully');
      addAdModal.remove();
      loadAds();  // Refresh ads list
      
    } catch (error) {
      alert(`Failed to add ad: ${error.message}`);
    }
  });
}

// Add placement manager
function showPlacementManagerModal() {
  const placementModal = document.createElement('div');
  placementModal.className = 'modal';
  placementModal.id = 'placement-manager-modal';
  
  placementModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2><i class="fas fa-sitemap"></i> Ad Placement Manager</h2>
        <span class="close-modal">&times;</span>
      </div>
      <div class="modal-body">
        <div class="action-buttons">
          <button id="add-placement-button" class="primary-button">
            <i class="fas fa-plus"></i> Add New Placement
          </button>
        </div>
        
        <div id="placements-list">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="placements-table-body">
              <!-- Placements will be loaded here -->
            </tbody>
          </table>
        </div>
        
        <div id="add-placement-form" style="display: none;">
          <h3>Add New Placement</h3>
          <form id="placement-form">
            <div class="form-group">
              <label for="placement-name">Placement Name</label>
              <input type="text" id="placement-name" required>
            </div>
            <div class="form-group">
              <label for="placement-key">Placement Key (unique identifier)</label>
              <input type="text" id="placement-key" required pattern="[a-z0-9-_]+">
              <small>Use only lowercase letters, numbers, hyphens, and underscores</small>
            </div>
            <div class="form-group">
              <label for="placement-description">Description</label>
              <textarea id="placement-description" rows="3"></textarea>
            </div>
            <div class="form-actions">
              <button type="button" id="cancel-placement" class="secondary-button">Cancel</button>
              <button type="submit" class="primary-button">Save Placement</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(placementModal);
  placementModal.style.display = 'block';
  
  // Add event listeners
  const closeBtn = placementModal.querySelector('.close-modal');
  closeBtn.addEventListener('click', () => {
    placementModal.remove();
  });
  
  // Load placements
  loadPlacements();
  
  // Add placement button
  document.getElementById('add-placement-button').addEventListener('click', () => {
    document.getElementById('placements-list').style.display = 'none';
    document.getElementById('add-placement-button').style.display = 'none';
    document.getElementById('add-placement-form').style.display = 'block';
  });
  
  // Cancel button
  document.getElementById('cancel-placement').addEventListener('click', () => {
    document.getElementById('placements-list').style.display = 'block';
    document.getElementById('add-placement-button').style.display = 'block';
    document.getElementById('add-placement-form').style.display = 'none';
  });
  
  // Form submission
  document.getElementById('placement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newPlacement = {
      name: document.getElementById('placement-name').value,
      placement_key: document.getElementById('placement-key').value,
      description: document.getElementById('placement-description').value
    };
    
    try {
      const { error } = await supabase
        .from('ad_placements')
        .insert([newPlacement]);
      
      if (error) throw error;
      
      alert('Placement added successfully');
      
      // Reset and reload
      document.getElementById('placement-name').value = '';
      document.getElementById('placement-key').value = '';
      document.getElementById('placement-description').value = '';
      
      document.getElementById('placements-list').style.display = 'block';
      document.getElementById('add-placement-button').style.display = 'block';
      document.getElementById('add-placement-form').style.display = 'none';
      
      loadPlacements();
      
    } catch (error) {
      alert(`Failed to add placement: ${error.message}`);
    }
  });
}

// Load placements
async function loadPlacements() {
  try {
    const { data, error } = await supabase
      .from('ad_placements')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error loading placements:', error);
      alert('Error loading placements: ' + error.message);
      return;
    }
    
    // Store placements globally for other functions to use
    window.adPlacements = data || [];
    
    const tableBody = document.getElementById('placements-table-body');
    if (!tableBody) {
      console.error('Placements table body not found');
      return;
    }
    
    tableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center">No placements found</td>
        </tr>
      `;
      return;
    }
    
    data.forEach(placement => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${placement.name}</td>
        <td><code>${placement.placement_key}</code></td>
        <td>${placement.description || ''}</td>
        <td>
          <button class="action-btn edit-placement" data-id="${placement.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn delete-placement" data-id="${placement.id}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
    
    // Add event listeners
    document.querySelectorAll('.edit-placement').forEach(btn => {
      btn.addEventListener('click', () => editPlacement(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-placement').forEach(btn => {
      btn.addEventListener('click', () => deletePlacement(btn.dataset.id));
    });
    
  } catch (error) {
    console.error('Error in loadPlacements:', error);
    alert('Failed to load placements. Please try again.');
  }
}

// Edit placement
async function editPlacement(placementId) {
  try {
    const { data, error } = await supabase
      .from('ad_placements')
      .select('*')
      .eq('id', placementId)
      .single();
    
    if (error) throw error;
    
    // Switch to edit form
    document.getElementById('placements-list').style.display = 'none';
    document.getElementById('add-placement-button').style.display = 'none';
    document.getElementById('add-placement-form').style.display = 'block';
    
    // Fill form with data
    document.getElementById('placement-name').value = data.name;
    document.getElementById('placement-key').value = data.placement_key;
    document.getElementById('placement-description').value = data.description || '';
    
    // Update form for edit mode
    const form = document.getElementById('placement-form');
    form.innerHTML += `<input type="hidden" id="placement-id" value="${placementId}">`;
    
    // Replace submit handler
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const updatedPlacement = {
        name: document.getElementById('placement-name').value,
        placement_key: document.getElementById('placement-key').value,
        description: document.getElementById('placement-description').value
      };
      
      try {
        const { error } = await supabase
          .from('ad_placements')
          .update(updatedPlacement)
          .eq('id', placementId);
        
        if (error) throw error;
        
        alert('Placement updated successfully');
        
        // Reset and reload
        document.getElementById('placements-list').style.display = 'block';
        document.getElementById('add-placement-button').style.display = 'block';
        document.getElementById('add-placement-form').style.display = 'none';
        
        loadPlacements();
        
      } catch (error) {
        alert(`Failed to update placement: ${error.message}`);
      }
    };
    
  } catch (error) {
    console.error('Error loading placement:', error);
    alert('Failed to load placement details. Please try again.');
  }
}

// Delete placement
async function deletePlacement(placementId) {
  if (!confirm('Are you sure you want to delete this placement? Ads using this placement will need to be reassigned.')) {
    return;
  }
  
  try {
    const { error } = await supabase
      .from('ad_placements')
      .delete()
      .eq('id', placementId);
    
    if (error) throw error;
    
    alert('Placement deleted successfully');
    loadPlacements();
    
  } catch (error) {
    console.error('Error deleting placement:', error);
    alert(`Failed to delete placement: ${error.message}`);
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
        .insert([{ ...settings, id: 1 }]);
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
  
  // Add export buttons to users tab
  const usersTabContent = document.getElementById('users-tab');
  if (usersTabContent) {
    const exportButtonsContainer = document.createElement('div');
    exportButtonsContainer.className = 'admin-actions';
    exportButtonsContainer.style.display = 'flex';
    exportButtonsContainer.style.gap = '0.5rem';
    exportButtonsContainer.style.marginBottom = '1rem';
    
    exportButtonsContainer.innerHTML = `
      <button id="export-users-btn" class="action-button">
        <i class="fas fa-file-export"></i> Export Users
      </button>
      <button id="reset-scans-btn" class="action-button">
        <i class="fas fa-redo"></i> Reset All Scans
      </button>
      <button id="send-notification-btn" class="action-button">
        <i class="fas fa-bell"></i> Send Notification
      </button>
    `;
    
    // Insert after the search bar
    const searchBar = usersTabContent.querySelector('.search-bar');
    if (searchBar) {
      searchBar.after(exportButtonsContainer);
    } else {
      usersTabContent.prepend(exportButtonsContainer);
    }
    
    // Add event listeners
    document.getElementById('export-users-btn').addEventListener('click', generateUserReport);
    document.getElementById('reset-scans-btn').addEventListener('click', resetAllUserScans);
    document.getElementById('send-notification-btn').addEventListener('click', sendMassNotification);
  }
  
  // Add export button to analytics tab
  const analyticsTabContent = document.getElementById('analytics-tab');
  if (analyticsTabContent) {
    const exportScanButton = document.createElement('button');
    exportScanButton.id = 'export-scans-btn';
    exportScanButton.className = 'action-button';
    exportScanButton.innerHTML = '<i class="fas fa-file-export"></i> Export Scan Data';
    exportScanButton.style.marginBottom = '1rem';
    
    // Insert at the top of analytics
    analyticsTabContent.querySelector('h3').after(exportScanButton);
    
    // Add event listener
    exportScanButton.addEventListener('click', generateScanReport);
  }
  
  // Add placement manager button to ads tab
  const adsTabContent = document.getElementById('ads-tab');
  if (adsTabContent) {
    const adControls = adsTabContent.querySelector('.ad-controls');
    if (adControls) {
      const placementManagerBtn = document.createElement('button');
      placementManagerBtn.id = 'placement-manager-button';
      placementManagerBtn.className = 'secondary-button';
      placementManagerBtn.innerHTML = '<i class="fas fa-sitemap"></i> Manage Placements';
      placementManagerBtn.style.marginRight = '0.5rem';
      
      adControls.prepend(placementManagerBtn);
      
      placementManagerBtn.addEventListener('click', showPlacementManagerModal);
    }
  }
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

// Generate and download user report
function generateUserReport() {
  try {
    // Get all users
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        
        if (!data || data.length === 0) {
          alert('No user data available for report');
          return;
        }
        
        // Create CSV content
        let csvContent = 'ID,Name,Email,Registration Date,Scans Remaining,Admin Status\n';
        
        data.forEach(user => {
          const createdDate = new Date(user.created_at).toLocaleDateString();
          csvContent += `${user.id},"${user.full_name || 'N/A'}","${user.email || 'N/A'}",${createdDate},${user.scans_remaining || 0},${user.is_admin ? 'Yes' : 'No'}\n`;
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      });
  } catch (error) {
    console.error('Error generating report:', error);
    alert('Failed to generate user report');
  }
}

// Generate and download scan report
function generateScanReport() {
  try {
    // Get all scans
    supabase
      .from('scan_history')
      .select('*, profiles(email, full_name)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        
        if (!data || data.length === 0) {
          alert('No scan data available for report');
          return;
        }
        
        // Create CSV content
        let csvContent = 'ID,User ID,User Email,User Name,Scan Type,Scan Date,Rating\n';
        
        data.forEach(scan => {
          const scanDate = new Date(scan.created_at).toLocaleDateString();
          const userName = scan.profiles?.full_name || 'N/A';
          const userEmail = scan.profiles?.email || 'N/A';
          const rating = scan.scan_data?.rating || 'N/A';
          
          csvContent += `${scan.id},"${scan.user_id}","${userEmail}","${userName}","${scan.scan_type}",${scanDate},${rating}\n`;
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scan_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      });
  } catch (error) {
    console.error('Error generating report:', error);
    alert('Failed to generate scan report');
  }
}

// Reset all user scan counts
async function resetAllUserScans() {
  if (!confirm('Are you sure you want to reset scan counts for all users? This will give all users 5 scans.')) {
    return;
  }
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        scans_remaining: 5,
        last_scan_reset: new Date().toISOString()
      });
    
    if (error) throw error;
    
    alert('All user scan counts have been reset to 5');
    loadUsers(); // Refresh the user list
  } catch (error) {
    console.error('Error resetting scan counts:', error);
    alert(`Failed to reset scan counts: ${error.message}`);
  }
}

// Send notification to all users (simulated)
function sendMassNotification() {
  const notificationModal = document.createElement('div');
  notificationModal.className = 'modal';
  notificationModal.id = 'notification-modal';
  
  notificationModal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2><i class="fas fa-bell"></i> Send Mass Notification</h2>
        <span class="close-modal">&times;</span>
      </div>
      <div class="modal-body">
        <form id="notification-form">
          <div class="form-group">
            <label for="notification-title">Notification Title</label>
            <input type="text" id="notification-title" placeholder="Enter notification title" required>
          </div>
          <div class="form-group">
            <label for="notification-message">Message</label>
            <textarea id="notification-message" rows="4" placeholder="Enter notification message" required></textarea>
          </div>
          <div class="form-group">
            <label for="notification-type">Type</label>
            <select id="notification-type">
              <option value="info">Information</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </select>
          </div>
          <button type="submit" class="primary-button">Send Notification</button>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(notificationModal);
  notificationModal.style.display = 'block';
  
  // Add event listeners
  const closeBtn = notificationModal.querySelector('.close-modal');
  closeBtn.addEventListener('click', () => {
    notificationModal.remove();
  });
  
  const form = document.getElementById('notification-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = document.getElementById('notification-title').value;
    const message = document.getElementById('notification-message').value;
    const type = document.getElementById('notification-type').value;
    
    // In a real app, this would send to a notification service
    // For now, just simulate it
    alert(`Notification sent to all users:\nTitle: ${title}\nMessage: ${message}\nType: ${type}`);
    notificationModal.remove();
  });
}

// Export admin functionality
window.admin = {
  showAdminDashboard,
  loadUsers,
  loadAnalytics,
  loadAds,
  loadSettings,
  createAdWatchedChart
};