# 🥗 NutriScan AI

**Snap your food, get an instant AI-powered nutrition breakdown.** NutriScan analyzes food photos and packaged food labels, tracks your health goals, and gives you a personal nutrition dashboard — all in an installable PWA.

🌐 **Live:** [nutriscanai.vercel.app](https://nutriscanai.vercel.app/)

## ✨ Features

- 📸 **Camera capture** — point at your plate and analyze instantly
- 🏷️ **Label mode** — scan packaged food nutrition labels
- 💬 Conversational follow-up questions about your food
- 📊 Nutrition charts and personal dashboard
- 🎯 Health goals tracking
- 🌗 Light/dark themes
- 🔐 Supabase authentication + admin panel
- 📱 Installable PWA with service worker

## 🛠️ Tech Stack

- **Vanilla JavaScript** · HTML · CSS (no framework)
- **AI vision** for food & label analysis
- **Supabase** — auth, profiles, storage
- **Chart.js** for nutrition visualizations
- PWA: manifest + service worker + TWA asset links

## 🚀 Getting Started

```bash
git clone https://github.com/Sugamdeol/NutriScan-Ai.git
cd NutriScan-Ai
python -m http.server 8080
```

Configure your Supabase project and AI keys in `auth.js` / `script.js`.

## 🔑 Admin Panel Access

1. Register and log in with your account.
2. Grant admin permissions by running this in the Supabase SQL Editor:

   ```sql
   UPDATE profiles SET is_admin = true WHERE id = 'YOUR_USER_ID';
   ```

3. The admin panel (see `admin.js`) becomes available on login.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

Built with ❤️ by [Sugam Deol](https://github.com/Sugamdeol)
