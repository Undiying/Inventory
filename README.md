# Sheen Academy Inventory Management System

A premium, glassmorphism-themed inventory and asset management system built for Sheen Academy.

## Features

- **Dashboard**: High-level overview of total, available, signed-out, and broken assets.
- **Categorized Management**: Specialized views for Office, Classroom, and Robotics items.
- **Robotics Kits**: Track individual components within kits (e.g., Motors, Hubs).
- **Audit Logs**: Complete history of every sign-in, sign-out, and condition change.
- **Double-Sign-Out Prevention**: Built-in logic to prevent multiple people from checking out the same asset.

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+).
- **Icons**: Lucide Icons.
- **Typography**: Inter (Google Fonts).
- **Database**: Supabase (Recommended) or LocalStorage fallback.

## Setup & Deployment

1. **GitHub**: We have pushed this code to your repository at `https://github.com/Undiying/Inventory`.
2. **Netlify**:
   - Log in to [Netlify.com](https://www.netlify.com).
   - Click **Add new site** > **Import an existing project**.
   - Connect to your GitHub and select the `Inventory` repository.
   - Netlify will automatically deploy the site.

## Database Integration (Supabase)

To enable the real-time "Double Sign-Out" protection across different computers:
1. Go to [Supabase](https://supabase.com) and create a free project.
2. In the `supabase-config.js` file, replace the placeholders with your **Project URL** and **Anon Key**.
3. Create an `assets` table in the Supabase SQL editor (I can provide the schema if needed).

---
Created with ❤️ by Antigravity for Sheen Academy.
