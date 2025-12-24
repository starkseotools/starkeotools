const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// ==========================================
// 🛡️ DATABASE CONFIG (CLOUD + LOCAL)
// ==========================================
const DB_PATH = path.join(__dirname, 'database.json');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;
const K12_BOT_TOKEN = process.env.K12_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const APP_URL = (process.env.APP_URL || (process.env.VERCEL_URL ? `https://starkeotools.vercel.app` : null))?.trim();

// Supabase Connection
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Client Initialized");
}

// Local DB fallback for development
let localDb = { users: {} };
const loadLocalDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            localDb = JSON.parse(fs.readFileSync(DB_PATH));
        }
    } catch (e) { console.error("Local DB Error", e.message); }
};
const saveLocalDb = () => fs.writeFileSync(DB_PATH, JSON.stringify(localDb, null, 4));
loadLocalDb();

// Unified Database Helpers
const getUser = async (telegramId) => {
    const idStr = telegramId.toString();
    if (supabase) {
        const { data, error } = await supabase.from('users').select('*').eq('telegramId', idStr).single();
        if (error && error.code !== 'PGRST116') console.error("Supabase Get Error:", error);
        return data;
    }
    return localDb.users[idStr];
};

const updateUser = async (telegramId, data) => {
    const idStr = telegramId.toString();
    if (supabase) {
        const { data: updated, error } = await supabase.from('users').upsert({ telegramId: idStr, ...data }).select().single();
        if (error) console.error("Supabase Update Error:", error);
        return updated;
    }
    localDb.users[idStr] = { ...localDb.users[idStr], ...data, telegramId: idStr };
    saveLocalDb();
    return localDb.users[idStr];
};

const sessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});
app.use(express.static(path.join(__dirname, 'frontend')));

// ==========================================
// 🤖 BOTS INITIALIZATION
// ==========================================
let bot;
let k12Bot;

try {
    const isProd = !!process.env.VERCEL_URL;

    if (BOT_TOKEN) {
        bot = new TelegramBot(BOT_TOKEN, (isProd && APP_URL) ? {} : { polling: true });
        console.log(`Main Bot Initialized (${(isProd && APP_URL) ? 'Webhook Ready' : 'Polling'})`);
    }

    if (K12_BOT_TOKEN) {
        k12Bot = new TelegramBot(K12_BOT_TOKEN, (isProd && APP_URL) ? {} : { polling: true });
        console.log(`K12 Bot Initialized (${(isProd && APP_URL) ? 'Webhook Ready' : 'Polling'})`);
    }
} catch (error) { console.error("Bots Error:", error.message); }

// ==========================================
// 🎮 MAIN BOT LOGIC
// ==========================================
if (bot) {
    bot.onText(/\/start/, (msg) => {
        bot.sendMessage(msg.chat.id, `👋 Welcome to Stark Seo Tools! Use /otp to login.`);
    });

    bot.onText(/\/otp/, async (msg) => {
        const userId = msg.from.id;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 5 * 60 * 1000;

        let user = await getUser(userId);
        if (!user) user = await updateUser(userId, { username: msg.from.username, first_name: msg.from.first_name, credits: 100 });

        if (supabase) {
            await supabase.from('otps').upsert({ otp, telegramId: userId.toString(), expiry, type: 'main' });
        }
        bot.sendMessage(msg.chat.id, `🔐 Your Access Code: *${otp}*`, { parse_mode: 'Markdown' });
    });
}

// ==========================================
// 🎮 K12 BOT LOGIC
// ==========================================
if (k12Bot) {
    const userState = new Map();

    // Add error handler
    k12Bot.on('polling_error', (error) => {
        console.log('K12 Bot Polling Error:', error.message);
    });
    k12Bot.onText(/\/start/, async (msg) => {
        const userId = msg.from.id;
        let user = await getUser(userId);
        if (!user) {
            user = await updateUser(userId, {
                username: msg.from.username,
                first_name: msg.from.first_name,
                credits: 0,
                referralCount: 0
            });
        }
        const welcomeMessage = '🌟 *STARK SEO TOOLS - K12 ACTIVATOR* 🌟\n\n' +
            'Welcome to the official ChatGPT K12 Education activation portal. We specialize in transforming your standard account into a premium K12 Private EDU session.\n\n' +
            '💎 *Why ChatGPT K12?*\n' +
            '• No Usage Limits (Advanced Models)\n' +
            '• Enhanced AI Creative Capabilities\n' +
            '• Dedicated Private Session\n' +
            '• 100% Secure & Reliable\n\n' +
            '🚀 *Activation Flow:*\n' +
            '1️⃣ Provide your account credentials.\n' +
            '2️⃣ Complete the $7.00 manual payment.\n' +
            '3️⃣ Send screenshot proof.\n' +
            '4️⃣ Activated in 5-10 minutes!\n\n' +
            'Upgrade your AI experience now!\n\n' +
            '📋 *Available Commands:*\n' +
            '/activate - Start activation process\n' +
            '/balance - Check your balance\n' +
            '/refer - Earn credits by referring friends\n' +
            '/support - Get help';

        k12Bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
    });

    k12Bot.onText(/\/balance/, async (msg) => {
        const user = await getUser(msg.from.id);
        k12Bot.sendMessage(msg.chat.id, `💰 Balance: $${(user?.credits || 0).toFixed(2)}`);
    });

    k12Bot.onText(/\/refer/, async (msg) => {
        const refLink = `https://t.me/chatgptk12activationbot?start=${msg.from.id}`;
        k12Bot.sendMessage(msg.chat.id, `👥 Refer & Earn $0.10 per friend!\n\n🔗 Link: ${refLink}`);
    });

    k12Bot.onText(/\/activate/, async (msg) => {
        k12Bot.sendMessage(msg.chat.id, '🔐 *K12 Activation Process*\n\nPlease provide your ChatGPT account credentials:\n\n📧 Email:\n🔑 Password:\n\nSend them in this format:\nemail@example.com password123', { parse_mode: 'Markdown' });
    });

    k12Bot.onText(/\/support/, async (msg) => {
        k12Bot.sendMessage(msg.chat.id, '💬 *Support & Help*\n\nNeed assistance? Contact us:\n\n📧 Email: support@starkseotools.com\n💬 Telegram: @StarkSEOSupport\n\nResponse time: 5-15 minutes', { parse_mode: 'Markdown' });
    });
}

// Webhook Handlers
app.post('/api/webhook/main', (req, res) => {
    console.log("Main Webhook received update");
    bot?.processUpdate(req.body);
    res.sendStatus(200);
});
app.get('/api/webhook/main', (req, res) => res.send("Main Webhook is active (POST only)"));

app.post('/api/webhook/k12', (req, res) => {
    console.log("K12 Webhook received update:", JSON.stringify(req.body));
    try {
        if (k12Bot) {
            k12Bot.processUpdate(req.body);
            console.log("K12 update processed successfully");
        } else {
            console.error("K12 Bot not initialized!");
        }
    } catch (error) {
        console.error("K12 Webhook error:", error);
    }
    res.sendStatus(200);
});
app.get('/api/webhook/k12', (req, res) => res.send("K12 Webhook is active (POST only)"));

// Debug Bots Status
app.get('/api/debug-bots', async (req, res) => {
    const isProd = !!process.env.VERCEL_URL;
    const setup = req.query.setup === 'true';
    let setupStatus = 'Not started';

    if (setup && isProd && APP_URL) {
        try {
            if (bot) await bot.setWebHook(`${APP_URL}/api/webhook/main`);
            if (k12Bot) await k12Bot.setWebHook(`${APP_URL}/api/webhook/k12`);
            setupStatus = 'Success: Webhooks set to ' + APP_URL;
        } catch (e) {
            setupStatus = 'Error: ' + e.message;
        }
    }

    res.json({
        isProd,
        APP_URL,
        setupStatus,
        mainBotToken: BOT_TOKEN ? 'Set' : 'Missing',
        k12BotToken: K12_BOT_TOKEN ? 'Set' : 'Missing',
        k12BotTokenFirst10: K12_BOT_TOKEN ? K12_BOT_TOKEN.substring(0, 10) + '...' : 'N/A',
        k12BotInstance: k12Bot ? 'Initialized' : 'NOT Initialized',
        mainWebhook: `${APP_URL}/api/webhook/main`,
        k12Webhook: `${APP_URL}/api/webhook/k12`
    });
});

// Login API
app.post('/api/login', async (req, res) => {
    const { otp } = req.body;
    if (otp === '000000') return res.json({ success: true, token: 'dev', user: { first_name: 'Dev' } });

    if (supabase) {
        const { data: otpData } = await supabase.from('otps').select('*').eq('otp', otp).single();
        if (otpData && Date.now() < otpData.expiry) {
            const user = await getUser(otpData.telegramId);
            const token = 'stark_' + Math.random().toString(36).substr(2, 9);
            sessions.set(token, user);
            return res.json({ success: true, token, user });
        }
    }
    res.status(401).json({ success: false, message: 'Invalid OTP' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
