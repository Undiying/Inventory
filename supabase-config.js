/**
 * Supabase Configuration & Client
 * 
 * To use a real database that prevents double-checkout conflicts:
 * 1. Create a free account at https://supabase.com
 * 2. Create a new project named "Sheen Academy Inventory"
 * 3. Copy your "Project URL" and "API Key" (anon/public) below.
 */

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// In a real production app via Netlify, you would use environment variables.
// For now, we will use a global fallback logic.

export const db = {
    // This is a mock client that we will replace with real Supabase logic 
    // when you provide the keys above.
    isReal: SUPABASE_URL !== 'YOUR_SUPABASE_URL',
    
    async getAssets() {
        if (!this.isReal) return null; // Fallback to local memory
        const { data, error } = await supabase.from('assets').select('*');
        if (error) throw error;
        return data;
    },

    async signOut(assetId, userName, reason) {
        if (!this.isReal) return true; // Local success
        
        // Example of the "Concurrency Protection" using a database transaction/RPC
        const { data, error } = await supabase.rpc('sign_out_asset', {
            target_id: assetId,
            user_name: userName,
            sign_reason: reason
        });
        
        if (error) throw error;
        return data; // returns true if successful, false if already taken
    }
};
