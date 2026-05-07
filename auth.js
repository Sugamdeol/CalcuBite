const supabaseUrl = 'https://uvutdprpvwwxytgblqob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dXRkcHJwdnd3eHl0Z2JscW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDU5ODcsImV4cCI6MjA5MzMyMTk4N30.75H5VjAtbpBMzvDiEyr9782_eDvlPh9gc6BfPzGHPCM';
window.sb = supabase.createClient(supabaseUrl, supabaseKey);

const INTERNAL_DOMAIN = '@nutriscan.ai';

const auth = {
    async signup(username, fullname, password) {
        // Normalize username: trim and lowercase
        const cleanUsername = username.trim().toLowerCase();
        const email = cleanUsername + INTERNAL_DOMAIN;

        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: cleanUsername,
                    full_name: fullname
                }
            }
        });

        if (error) {
            console.error('Signup error:', error);
            throw error;
        }
        return data;
    },

    async login(username, password) {
        const cleanUsername = username.trim().toLowerCase();
        const email = cleanUsername + INTERNAL_DOMAIN;

        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Login error:', error);
            throw error;
        }
        return data;
    },

    async logout() {
        await sb.auth.signOut();
        window.location.reload();
    },

    async getCurrentUser() {
        const { data: { user } } = await sb.auth.getUser();
        return user;
    },

    async getProfile(userId) {
        const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
        return data;
    },

    async updateProfile(userId, profileData) {
        const { data, error } = await sb.from('profiles').update(profileData).eq('id', userId);
        if (error) throw error;
        return data;
    }
};

window.auth = auth;
