const supabaseUrl = 'https://uvutdprpvwwxytgblqob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dXRkcHJwdnd3eHl0Z2JscW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDU5ODcsImV4cCI6MjA5MzMyMTk4N30.75H5VjAtbpBMzvDiEyr9782_eDvlPh9gc6BfPzGHPCM';
window.sb = supabase.createClient(supabaseUrl, supabaseKey);

const INTERNAL_DOMAIN = '@nutriscanai-internal.com';

const auth = {
    async signup(username, fullname, password) {
        const email = username + INTERNAL_DOMAIN;
        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                    full_name: fullname
                }
            }
        });
        if (error) throw error;
        return data;
    },

    async login(username, password) {
        const email = username + INTERNAL_DOMAIN;
        const { data, error } = await sb.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
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
