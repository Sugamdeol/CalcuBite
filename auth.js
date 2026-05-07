const SUPABASE_URL = 'https://uvutdprpvwwxytgblqob.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RR_QVRSANDGFTW2TABuglA_3wEq2eLU'; // To be replaced

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let userProfile = null;

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    
    if (currentUser) {
        await fetchUserProfile();
        showApp();
    } else {
        showLanding();
    }
}

async function fetchUserProfile() {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (error) {
        console.error('Error fetching profile:', error);
        return;
    }
    
    userProfile = data;

    // Check if profile is complete (needs AI limits)
    if (!userProfile.daily_limits) {
        document.getElementById('profile-setup').style.display = 'block';
        document.getElementById('dashboard-view').style.display = 'none';
    } else {
        document.getElementById('profile-setup').style.display = 'none';
        document.getElementById('dashboard-view').style.display = 'block';
    }
}

async function handleAuth(email, password, fullName = null, isRegister = false) {
    const errorElem = document.getElementById('auth-error');
    errorElem.textContent = '';
    
    try {
        if (isRegister) {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName }
                }
            });
            if (error) throw error;

            // Create profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: data.user.id,
                    full_name: fullName,
                    username: email.split('@')[0]
                }]);
            if (profileError) console.error('Profile creation error:', profileError);

            alert('Registration successful! Please check your email for confirmation (if enabled) or just try logging in.');
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
        }

        await checkAuth();
    } catch (err) {
        errorElem.textContent = err.message;
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    userProfile = null;
    showLanding();
}

function showLanding() {
    document.getElementById('landing-page').style.display = 'block';
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('user-nav').style.display = 'none';
}

function showApp() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('user-nav').style.display = 'flex';
}

function showAuth(isRegister = false) {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('auth-container').style.display = 'flex';
    
    const title = document.getElementById('auth-title');
    const nameField = document.getElementById('name-field');
    const submitBtn = document.getElementById('auth-submit');
    const switchLink = document.getElementById('auth-switch-link');
    const switchText = document.getElementById('auth-switch-text');
    
    if (isRegister) {
        title.textContent = 'Register';
        nameField.style.display = 'block';
        submitBtn.textContent = 'Create Account';
        switchText.textContent = 'Already have an account?';
        switchLink.textContent = 'Login';
    } else {
        title.textContent = 'Login';
        nameField.style.display = 'none';
        submitBtn.textContent = "Let's Go";
        switchText.textContent = "Don't have an account?";
        switchLink.textContent = 'Register';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    document.getElementById('hero-signup-btn').addEventListener('click', () => showAuth(true));
    document.getElementById('auth-switch-link').addEventListener('click', (e) => {
        e.preventDefault();
        const isRegister = document.getElementById('auth-title').textContent === 'Login';
        showAuth(isRegister);
    });

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const fullName = document.getElementById('auth-name').value;
        const isRegister = document.getElementById('auth-title').textContent === 'Register';
        
        await handleAuth(email, password, fullName, isRegister);
    });
    
    document.getElementById('logout-link').addEventListener('click', handleLogout);
});

window.auth = { supabase: supabaseClient, currentUser, userProfile };
