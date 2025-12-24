require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8000;

// ==========================================
// 🛡️ DATABASE CONFIG
// ==========================================
const DB_PATH = path.join(__dirname, 'database.json');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN || '8403194805:AAErwOTnxTKTzvKuchog1T8jqKScErVgJo8';
const K12_BOT_TOKEN = process.env.K12_BOT_TOKEN || '8275282497:AAEdM3I9DHErbFFZB5W58sZMQcSDmffsgX8';
const ADMIN_ID = process.env.ADMIN_ID || '6268548597';
const APP_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.APP_URL;

// Supabase Connection
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Client Initialized");
}

// Global DB Cache (for in-memory use or local fallback)
let localDb = { users: {} };
const loadLocalDb = () => {
    try {
        if (fs.existsSync(DB_PATH)) localDb = JSON.parse(fs.readFileSync(DB_PATH));
    } catch (e) { console.error("Local DB Load Error", e); }
};
const saveLocalDb = () => fs.writeFileSync(DB_PATH, JSON.stringify(localDb, null, 4));
loadLocalDb();

// Helper to get user (Unified)
const getUser = async (telegramId) => {
    const idStr = telegramId.toString();
    if (supabase) {
        const { data, error } = await supabase.from('users').select('*').eq('telegramId', idStr).single();
        if (error && error.code !== 'PGRST116') console.error("Supabase Get Error:", error);
        return data;
    } else {
        return localDb.users[idStr];
    }
};

// Helper to update/create user (Unified)
const updateUser = async (telegramId, data) => {
    const idStr = telegramId.toString();
    if (supabase) {
        const { data: updated, error } = await supabase.from('users').upsert({ telegramId: idStr, ...data }).select().single();
        if (error) console.error("Supabase Update Error:", error);
        return updated;
    } else {
        localDb.users[idStr] = { ...localDb.users[idStr], ...data, telegramId: parseInt(idStr) };
        saveLocalDb();
        return localDb.users[idStr];
    }
};

// Sessions: Map<token, userObject>
const sessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Initialize Bots
let bot;
let k12Bot;

try {
    const isProduction = !!process.env.VERCEL_URL;

    // 1. MAIN BOT
    if (BOT_TOKEN) {
        if (isProduction && APP_URL) {
            bot = new TelegramBot(BOT_TOKEN);
            bot.setWebHook(`${APP_URL}/api/webhook/main`)
                .then(() => console.log("Main Webhook Set"))
                .catch(e => console.error("Main Webhook Error", e.message));
        } else {
            bot = new TelegramBot(BOT_TOKEN, { polling: true });
        }
        console.log(`Main Bot Initialized (${isProduction && APP_URL ? 'Webhook' : 'Polling'})`);

        bot.setMyCommands([
            { command: 'start', description: 'Welcome & How to use' },
            { command: 'otp', description: 'Get your 6-digit access code' },
            { command: 'credits', description: 'Check your balance' },
            { command: 'help', description: 'View help guide' }
        ]);

        // Welcome message
        bot.onText(/\/start/, (msg) => {
            const welcomeMessage = `👋 *Hey ${msg.from.first_name || 'there'}! Welcome to Stark Seo Tools.*
            
Get premium access to ChatGPT Plus, Perplexity Pro, and more... all for *FREE*! 🎁

🌐 *START HERE:*
Visit: [starkseotools.com](https://starkseotools.com)

🚀 *How to use:*
1. Join our channel: @starkseotools
2. Send /otp here to get your code
3. Login on our website
4. Enjoy your tools!

Need help? Just type /help.`;

            bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
        });

        const REQUIRED_CHANNEL = '@starkseotools';

        bot.onText(/\/otp/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;

            try {
                const chatMember = await bot.getChatMember(REQUIRED_CHANNEL, userId);
                const isMember = ['creator', 'administrator', 'member'].includes(chatMember.status) || (chatMember.status === 'restricted' && chatMember.is_member);

                if (isMember) {
                    const otp = Math.floor(100000 + Math.random() * 900000).toString();
                    const expiry = Date.now() + 5 * 60 * 1000;

                    let user = await getUser(userId);
                    if (!user) {
                        user = await updateUser(userId, {
                            username: msg.from.username,
                            first_name: msg.from.first_name,
                            credits: 0.00,
                            photo_url: null,
                            hasK12: false,
                            referralCount: 0,
                            lastDailyClaim: 0
                        });
                    }

                    if (supabase) {
                        await supabase.from('otps').upsert({
                            otp,
                            telegramId: userId.toString(),
                            expiry,
                            type: 'main'
                        });
                    }

                    bot.sendMessage(chatId, `🔐 Your Access Code: *${otp}*\n\nValid for 5 minutes.`, { parse_mode: 'Markdown' });
                } else {
                    bot.sendMessage(chatId, `⚠️ *Access Denied*\n\nYou must join our channel to get an access code.\n\n👉 [Join Here](https://t.me/starkseotools) and try /otp again.`, { parse_mode: 'Markdown' });
                }
            } catch (error) {
                console.error("OTP Error:", error.message);
                bot.sendMessage(chatId, `⚠️ *System Error*\n\nVerification failed.`);
            }
        });

        bot.onText(/\/help/, (msg) => {
            const helpMessage = `📚 *Stark Seo Tools - Help Center*
            
/start - Welcome & How to use
/otp - Get your 6-digit access code
/credits - Check your balance
/help - View this help guide

🌐 Website: [starkseotools.com](https://starkseotools.com)`;
            bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
        });

        // Balance Command
        bot.onText(/\/credits/, async (msg) => {
            const userId = msg.from.id;
            const user = await getUser(userId);
            const balance = user ? (user.credits || 0) : 0;
            bot.sendMessage(msg.chat.id, `💰 *Your Balance:* $${balance.toFixed(2)}\n\nYou can use this balance to access premium tools!`, { parse_mode: 'Markdown' });
        });

        // Add Credits Command (Admin only)
        bot.onText(/\/addcredits (\d+)/, async (msg, match) => {
            const userId = msg.from.id;
            const amount = parseInt(match[1]);
            const db = getDb();
            const userIdStr = userId.toString();

            if (!db.users[userIdStr]) {
                db.users[userIdStr] = {
                    telegramId: userId,
                    username: msg.from.username,
                    first_name: msg.from.first_name,
                    credits: 0,
                    hasK12: false
                };
            }

            db.users[userIdStr].credits += amount;
            saveDb(db);

            bot.sendMessage(msg.chat.id, `✅ Added $${amount.toFixed(2)}. New Balance: $${db.users[userIdStr].credits.toFixed(2)}.`);
        });
    }

    // 2. K12 SPECIALIZED BOT
    if (K12_BOT_TOKEN) {
        if (isProduction && APP_URL) {
            k12Bot = new TelegramBot(K12_BOT_TOKEN);
            k12Bot.setWebHook(`${APP_URL}/api/webhook/k12`)
                .then(() => console.log("K12 Webhook Set"))
                .catch(e => console.error("K12 Webhook Error", e.message));
        } else {
            k12Bot = new TelegramBot(K12_BOT_TOKEN, { polling: true });
        }
        console.log(`K12 Bot Initialized (${isProduction && APP_URL ? 'Webhook' : 'Polling'})`);
        const userState = new Map(); // Tracks conversational state
        const supportTickets = new Map(); // Maps Admin Message ID -> User ID for replies

        console.log("ChatGPT K12 Activation Bot started...");

        k12Bot.setMyCommands([
            { command: 'start', description: 'Main Menu' },
            { command: 'balance', description: 'My Balance' },
            { command: 'refer', description: 'Refer & Earn' },
            { command: 'redeem', description: 'Redeem $7 for Account' },
            { command: 'help', description: 'Contact Support' }
        ]);

        // Use raw API to set description (What can this bot do?)
        const setBotMetadata = async () => {
            const token = process.env.K12_BOT_TOKEN;
            const description = "Welcome to K12 Private Activator! 🚀\n\nThis bot specializes in providing ChatGPT K12 Education Accounts for your private use. Get unlimited access to advanced models with full privacy.\n\nPress Start to begin your K12 Account journey!";
            const shortDescription = "Private ChatGPT K12 Education Account. Unlimited usage, total privacy.";

            try {
                await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description })
                });
                await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ short_description: shortDescription })
                });
            } catch (e) { console.error("Metadata error:", e); }
        };
        setBotMetadata();

        k12Bot.onText(/\/start( (.+))?/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            const referralCode = match[2];

            let user = await getUser(userId);
            // Create user if not exists
            if (!user) {
                user = await updateUser(userId, {
                    username: msg.from.username,
                    first_name: msg.from.first_name,
                    credits: 0.00,
                    photo_url: null,
                    hasK12: false,
                    referredBy: referralCode || null,
                    referralCount: 0,
                    lastDailyClaim: 0
                });

                // If referred by someone, award them
                if (referralCode && referralCode !== userId) {
                    const referrer = await getUser(referralCode);
                    if (referrer) {
                        await updateUser(referralCode, {
                            referralCount: (referrer.referralCount || 0) + 1,
                            credits: (referrer.credits || 0) + 0.10
                        });
                        k12Bot.sendMessage(referralCode, "🎁 *Referral Reward!*\n\nHigh five! Someone joined using your link. You've earned *$0.10*!", { parse_mode: 'Markdown' });
                    }
                }
            }

            const welcome = `🌟 *STARK SEO TOOLS - K12 ACCOUNT* 🌟

Welcome to the official ChatGPT K12 Education account portal. We specialize in providing premium K12 Private EDU sessions for your personal account.

💎 *Why ChatGPT K12 Account?*
• No Usage Limits (Advanced Models)
• Enhanced AI Creative Capabilities
• Dedicated Private Session
• 100% Secure & Reliable

🚀 *Account Flow:*
1️⃣ Provide your account credentials.
2️⃣ Complete the *$7.00* manual payment.
3️⃣ Send screenshot proof.
4️⃣ K12 Account ready in 5-10 minutes!

*Get your K12 Account now:*`;

            const opts = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🖥 Enter Dashboard", callback_data: "enter_dashboard" }],
                        [{ text: "⚡ Get K12 Account", callback_data: "start_activation" }]
                    ]
                }
            };
            k12Bot.sendMessage(chatId, welcome, opts);
        });

        // Handle Callback Queries (K12 Bot)
        k12Bot.on('callback_query', async (cb) => {
            const chatId = cb.message.chat.id;
            const data = cb.data;
            const userIdStr = cb.from.id.toString();

            if (data === "enter_dashboard") {
                k12Bot.answerCallbackQuery(cb.id);
                const user = await getUser(userIdStr);
                if (!user) return k12Bot.sendMessage(chatId, "❌ Please type /start first.");

                const dashboardMsg = `💎 *K12 ACCOUNT DASHBOARD* 💎

Use this menu to manage your K12 Account, check your balance, or invite friends to earn a free account.

💰 *Your Wallet:* $${(user.credits || 0).toFixed(2)}
👤 *Status:* ${user.hasK12 ? "✅ Account Active" : "⏳ No Active Account"}

🚀 *Quick Actions:*
• Tap "Get K12 Account" to begin.
• Accumulate *$7.00* via referrals for a free K12 Account!`;

                const opts = {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "⚡ Get K12 Account", callback_data: "start_activation" }],
                            [
                                { text: "💰 My Balance", callback_data: "cmd_balance" },
                                { text: "👥 Refer & Earn", callback_data: "cmd_refer" }
                            ],
                            [{ text: "🎁 Redeem $7 Balance", callback_data: "cmd_redeem" }]
                        ]
                    }
                };
                k12Bot.sendMessage(chatId, dashboardMsg, opts);
            }
            else if (data === "start_activation") {
                userState.set(chatId, { step: 'WAITING_FOR_EMAIL' });
                k12Bot.answerCallbackQuery(cb.id);
                k12Bot.sendMessage(chatId, "📧 *Step 1/3: Account Email*\n\nPlease send the *Email Address* linked to your ChatGPT account.\n\n⚠️ *Warning:* Use a *FRESH ACCOUNT* for best results.", { parse_mode: 'Markdown' });
            }
            else if (data === "cmd_balance") {
                k12Bot.answerCallbackQuery(cb.id);
                const user = await getUser(userIdStr);
                const balance = user ? (user.credits || 0) : 0;
                k12Bot.sendMessage(chatId, `💰 *Wallet Balance:* $${balance.toFixed(2)}\n\nYou can claim a *Free Activation* once you reach *$7.00*!`, { parse_mode: 'Markdown' });
            }
            else if (data === "cmd_refer") {
                k12Bot.answerCallbackQuery(cb.id);
                const botUsername = 'chatgptk12activationbot';
                const refLink = `https://t.me/${botUsername}?start=${userIdStr}`;
                k12Bot.sendMessage(chatId, `👥 *Refer & Earn System*\n\nInvite friends and earn *$0.10* for each join!\n\n🔗 *Your Link:* \`${refLink}\``, { parse_mode: 'Markdown' });
            }
            else if (data === "cmd_redeem") {
                k12Bot.answerCallbackQuery(cb.id);
                const user = await getUser(userIdStr);
                if (user && user.credits >= 7.00) {
                    userState.set(chatId, { step: 'WAITING_FOR_EMAIL', isRedeeming: true });
                    k12Bot.sendMessage(chatId, "🎁 K12 Account Redemption Started!\n\nYou have enough balance for a free K12 Account. Let's begin.\n\n📧 Step 1/2: Account Email\nPlease send the Email Address for your K12 Account.");
                } else {
                    const need = (7.00 - (user ? user.credits : 0)).toFixed(2);
                    k12Bot.sendMessage(chatId, `❌ Insufficient Balance\n\nYou need $7.00 to redeem. You are $${need} short.\n\nKeep referring friends to earn more!`);
                }
            }
            else if (data === "pay_USDT_SOL" || data === "pay_SOL") {
                k12Bot.answerCallbackQuery(cb.id);
                k12Bot.sendMessage(chatId, "`Gqr1jfKUBZh5C1VQvDizVaycRch7VoCaXZqinB3aCVUN`", { parse_mode: 'Markdown' });
                k12Bot.sendMessage(chatId, "☝️ Click the address above to copy it.\nNetwork: *Solana*", { parse_mode: 'Markdown' });
            }
            else if (data === "pay_TRX") {
                k12Bot.answerCallbackQuery(cb.id);
                k12Bot.sendMessage(chatId, "`TAsUkGdKLYcRKmJxS6uvc5fRM5auQkxwMq`", { parse_mode: 'Markdown' });
                k12Bot.sendMessage(chatId, "☝️ Click the address above to copy it.\nNetwork: *Tron (TRC20)*", { parse_mode: 'Markdown' });
            }
        });

        // Manual Activate Command
        k12Bot.onText(/\/activate/, (msg) => {
            const chatId = msg.chat.id;
            userState.set(chatId, { step: 'WAITING_FOR_EMAIL' });
            k12Bot.sendMessage(chatId, "📧 Step 1/3: Account Email\n\nPlease send the Email Address linked to your ChatGPT account.\n\n⚠️ Warning: We strongly recommend using a FRESH ACCOUNT.");
        });

        // Handle Conversational Input
        k12Bot.on('message', async (msg) => {
            if (msg.text && msg.text.startsWith('/')) return; // Ignore commands

            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();

            // Admin Reply Bridge (Always Active)
            if (userId === ADMIN_ID && msg.reply_to_message) {
                const targetUserId = supportTickets.get(msg.reply_to_message.message_id);
                if (targetUserId) {
                    if (msg.photo) {
                        k12Bot.sendPhoto(targetUserId, msg.photo[msg.photo.length - 1].file_id, { caption: msg.caption });
                    } else if (msg.text) {
                        k12Bot.sendMessage(targetUserId, msg.text);
                    }
                    return; // Don't process as state input
                }
            }

            const state = userState.get(chatId);

            if (!state) {
                // Forward to Admin (User -> Admin Support)
                if (ADMIN_ID && userId !== ADMIN_ID) {
                    if (msg.photo) {
                        const forwardMsg = `👤 *${msg.from.first_name}* (@${msg.from.username || 'N/A'}) sent a photo:`;
                        k12Bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, { caption: forwardMsg, parse_mode: 'Markdown' }).then((sentMsg) => {
                            supportTickets.set(sentMsg.message_id, userId);
                        });
                    } else if (msg.text) {
                        const forwardMsg = `👤 *${msg.from.first_name}* (@${msg.from.username || 'N/A'})\n\n${msg.text}`;
                        k12Bot.sendMessage(ADMIN_ID, forwardMsg).then((sentMsg) => {
                            supportTickets.set(sentMsg.message_id, userId);
                        });
                    }
                }
                return;
            }

            if (state.step === 'WAITING_FOR_EMAIL') {
                const email = msg.text.trim();
                if (!email.includes('@')) {
                    return k12Bot.sendMessage(chatId, "❌ Invalid email format. Please try again.");
                }

                userState.set(chatId, { ...state, step: state.isRedeeming ? 'REDEEM_WAITING_FOR_PASSWORD' : 'WAITING_FOR_PASSWORD', email: email });
                k12Bot.sendMessage(chatId, "🔑 *Step 2: Account Password*\n\nPlease send the *Password* for this ChatGPT account.", { parse_mode: 'Markdown' });
            }
            else if (state.step === 'WAITING_FOR_PASSWORD') {
                const password = msg.text;
                userState.set(chatId, { ...state, step: 'WAITING_FOR_PROOF', password: password });

                const paymentInfo = `💳 *Step 3/3: Payment Verification*

Please send *$7.00* to one of our official addresses below:

🔹 *USDT / SOL (Solana Network):*
\`Gqr1jfKUBZh5C1VQvDizVaycRch7VoCaXZqinB3aCVUN\`

🔸 *TRX (Tron Network):*
\`TAsUkGdKLYcRKmJxS6uvc5fRM5auQkxwMq\`

⚠️ *After Paying:* 
Send your *Wallet Address* and a *Screenshot* of the transaction.`;

                const opts = {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "💵 Copy USDT (Solana)", callback_data: "pay_USDT_SOL" }],
                            [{ text: "☀️ Copy SOL (Solana)", callback_data: "pay_SOL" }],
                            [{ text: "🔥 Copy TRX (Tron)", callback_data: "pay_TRX" }]
                        ]
                    }
                };

                k12Bot.sendMessage(chatId, paymentInfo, opts);
            }
            else if (state.step === 'WAITING_FOR_PROOF') {
                if (state.isRedeeming) return; // Skip if redeeming

                // Handle text (wallet address) or photo (screenshot)
                if (msg.photo || msg.text) {
                    const userId = msg.from.id.toString();
                    const email = state.email;
                    const password = state.password;
                    const proof = msg.text || (msg.caption ? `Caption: ${msg.caption}` : "Screenshot attached");

                    // Forward EVERYTHING to Admin
                    const adminMsg = `🚨 *NEW K12 ACCOUNT REQUEST* 🚨
👤 From: ${msg.from.first_name} (@${msg.from.username || 'N/A'})
🆔 ID: \`${userId}\`

📧 Email: \`${email}\`
🔑 Pass: \`${password}\`
📝 Proof/Address: ${proof}`;

                    if (ADMIN_ID) {
                        const sent = msg.photo ?
                            await k12Bot.sendPhoto(ADMIN_ID, msg.photo[msg.photo.length - 1].file_id, { caption: adminMsg }) :
                            await k12Bot.sendMessage(ADMIN_ID, adminMsg);

                        supportTickets.set(sent.message_id, userId);
                    }

                    k12Bot.sendMessage(chatId, "✅ Details & Proof Received!\n\nOur team is now verifying your payment and setting up your K12 Account. This usually takes 5-10 minutes. We will notify you here once it's live!");
                    userState.delete(chatId);
                }
            }
            else if (state.step === 'REDEEM_WAITING_FOR_PASSWORD') {
                const password = msg.text;
                const email = state.email;
                const userId = msg.from.id.toString();
                const user = await getUser(userId);

                if (user && user.credits >= 7.00) {
                    await updateUser(userId, { credits: (user.credits || 0) - 7.00 });

                    const adminMsg = `🎁 *NEW FREE REDEMPTION ($7.00)* 🎁
👤 From: ${msg.from.first_name} (@${msg.from.username || 'N/A'})
🆔 ID: \`${userId}\`

📧 Email: \`${email}\`
🔑 Pass: \`${password}\`
💰 Status: Paid via Balance`;

                    if (ADMIN_ID) {
                        const sent = await k12Bot.sendMessage(ADMIN_ID, adminMsg);
                        supportTickets.set(sent.message_id, userId);
                    }

                    k12Bot.sendMessage(chatId, "✅ Redemption Successful!\n\n$7.00 has been deducted from your balance. Our team will setup your K12 Account in 5-10 minutes!");
                    userState.delete(chatId);
                }
            }
        });




        // Balance command
        k12Bot.onText(/\/balance/, async (msg) => {
            const user = await getUser(msg.from.id);
            const balance = user ? (user.credits || 0) : 0;
            k12Bot.sendMessage(msg.chat.id, `💰 Current Balance: $${balance.toFixed(2)}\n\nYou can redeem a Free K12 Account once you reach $7.00!`);
        });

        // Refer command
        k12Bot.onText(/\/refer/, (msg) => {
            const userId = msg.from.id.toString();
            const botUsername = 'chatgptk12activationbot';
            const refLink = `https://t.me/${botUsername}?start=${userId}`;
            k12Bot.sendMessage(msg.chat.id, `👥 Refer & Earn\n\nInvite friends and earn $0.10 for each join!\n\n🔗 Your link: ${refLink}`);
        });

        // Redeem command
        k12Bot.onText(/\/redeem/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            const user = await getUser(userId);
            if (user && user.credits >= 7.00) {
                userState.set(chatId, { step: 'WAITING_FOR_EMAIL', isRedeeming: true });
                k12Bot.sendMessage(chatId, "🎁 K12 Account Redemption Started!\n\nYou have enough balance for a free K12 Account. Let's begin.\n\n📧 Step 1/2: Account Email\nPlease send the Email Address for your K12 Account.");
            } else {
                const need = (7.00 - (user ? user.credits : 0)).toFixed(2);
                k12Bot.sendMessage(chatId, `❌ Insufficient Balance\n\nYou need $7.00 to redeem. You are $${need} short.\n\nKeep referring friends to earn more!`);
            }
        });

        // Help Command
        k12Bot.onText(/\/help/, (msg) => {
            const helpMsg = `🛠 Support Center

If you have questions or issues, please message us directly. Our team is here to help!

👤 Admin: @shanmukha2k6
🌐 Dashboard: [starkseotools.com](https://starkseotools.com)`;
            k12Bot.sendMessage(msg.chat.id, helpMsg);
        });

        // Admin: List Users
        k12Bot.onText(/\/users/, async (msg) => {
            if (msg.from.id.toString() !== ADMIN_ID) return k12Bot.sendMessage(msg.chat.id, "❌ Unauthorized.");

            let users = [];
            if (supabase) {
                const { data, error } = await supabase.from('users').select('*');
                if (error) return k12Bot.sendMessage(msg.chat.id, "Error fetching from Supabase.");
                users = data;
            } else {
                users = Object.values(localDb.users);
            }

            if (users.length === 0) return k12Bot.sendMessage(msg.chat.id, "No users found in database.");

            let response = `👥 User Management Dashboard\nTotal Users: ${users.length}\n\n`;
            users.forEach((user, index) => {
                const line = `${index + 1}. ${user.first_name || user.firstName || 'User'} (@${user.username || 'n/a'})\n   ID: ${user.telegramId}\n   Balance: $${(user.credits || 0).toFixed(2)}\n   Refs: ${user.referralCount || 0}\n\n`;

                if ((response + line).length > 4000) {
                    k12Bot.sendMessage(msg.chat.id, response);
                    response = "";
                }
                response += line;
            });

            if (response) k12Bot.sendMessage(msg.chat.id, response);
        });

        // Admin: Reply to user
        k12Bot.onText(/\/reply (\d+) (.+)/, (msg, match) => {
            if (msg.from.id.toString() !== ADMIN_ID) return k12Bot.sendMessage(msg.chat.id, "❌ Unauthorized.");
            const targetId = match[1];
            const replyMsg = match[2];
            k12Bot.sendMessage(targetId, `💬 *Message from Admin:* \n\n${replyMsg}`, { parse_mode: 'Markdown' });
            k12Bot.sendMessage(msg.chat.id, `✅ Message sent to ${targetId}`);
        });

        // Admin: Add Credits
        k12Bot.onText(/\/addcredits (\d+) (\d+)/, async (msg, match) => {
            if (msg.from.id.toString() !== ADMIN_ID) return k12Bot.sendMessage(msg.chat.id, "❌ Unauthorized.");
            const targetId = match[1];
            const amount = parseInt(match[2]);

            const user = await getUser(targetId);
            if (user) {
                const updated = await updateUser(targetId, { credits: (user.credits || 0) + amount });
                k12Bot.sendMessage(msg.chat.id, `✅ Added $${amount.toFixed(2)} to User ${targetId}. Total: $${updated.credits.toFixed(2)}`);
                k12Bot.sendMessage(targetId, `💰 *Balance Updated!*\n\n$${amount.toFixed(2)} have been added to your account.\nTotal Balance: $${updated.credits.toFixed(2)}.`, { parse_mode: 'Markdown' });
            } else {
                k12Bot.sendMessage(msg.chat.id, `❌ User ${targetId} not found.`);
            }
        });

        // Admin: Grant K12 Whitelist
        k12Bot.onText(/\/grantk12 (\d+)/, async (msg, match) => {
            if (msg.from.id.toString() !== ADMIN_ID) return k12Bot.sendMessage(msg.chat.id, "❌ Unauthorized.");
            const targetId = match[1];
            const user = await getUser(targetId);
            if (user) {
                await updateUser(targetId, { hasK12: true });
                k12Bot.sendMessage(msg.chat.id, `✅ Success! K12 whitelisted for ${targetId}`);
            } else {
                k12Bot.sendMessage(msg.chat.id, `❌ User ${targetId} not found.`);
            }
        });
    }

} catch (error) {
    console.error("Bots Initialization Error:", error);
}

// Webhook Endpoints
app.post('/api/webhook/main', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.post('/api/webhook/k12', (req, res) => {
    k12Bot.processUpdate(req.body);
    res.sendStatus(200);
});

// OxaPay Webhook for Automated Payments
app.post('/api/webhook/oxapay', async (req, res) => {
    const { status, amount, orderId, trackId } = req.body;
    console.log(`[PAYMENT WEBHOOK] Status: ${status} | Order: ${orderId} | Amount: ${amount}`);

    if (status === 'paid' || status === 'success') {
        const userId = orderId.split('_')[0];
        const user = await getUser(userId);

        if (user) {
            const amountToAdd = parseFloat(amount);
            const updated = await updateUser(userId, { credits: (user.credits || 0) + amountToAdd });

            // Notify user
            if (k12Bot) {
                k12Bot.sendMessage(userId, `✅ *Payment Confirmed!*\n\nSuccessfully received *$${amount}*.\n*$${amountToAdd.toFixed(2)}* has been added to your balance!\n\nNew Balance: $${updated.credits.toFixed(2)}.`, { parse_mode: 'Markdown' });
            }
        }
    }
    res.sendStatus(200);
});

// Routes
app.post('/api/login', async (req, res) => {
    const { otp } = req.body;

    // Developer Hack
    if (otp === '000000') {
        const token = 'dev_token_' + Date.now();
        const devUser = { telegramId: '999', username: 'DevUser', first_name: 'Developer' };
        sessions.set(token, devUser);
        return res.json({ success: true, token, user: devUser });
    }

    if (!otp) return res.status(400).json({ success: false, message: 'OTP Required' });

    let otpData = null;
    if (supabase) {
        const { data, error } = await supabase.from('otps').select('*').eq('otp', otp).single();
        if (!error) otpData = data;
    }

    if (otpData) {
        if (Date.now() < otpData.expiry) {
            const token = 'stark_' + Math.random().toString(36).substr(2, 9);
            const user = await getUser(otpData.telegramId);

            sessions.set(token, user);
            if (supabase) await supabase.from('otps').delete().eq('otp', otp);

            return res.json({ success: true, token, user });
        } else {
            if (supabase) await supabase.from('otps').delete().eq('otp', otp);
            return res.status(401).json({ success: false, message: 'OTP Expired' });
        }
    }

    return res.status(401).json({ success: false, message: 'Invalid OTP' });
});

// Get User Credits API
app.get('/api/user/credits', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false });

    const sessionUser = sessions.get(token);
    if (!sessionUser) return res.status(401).json({ success: false });

    // sessionUser.id comes from the OTP data which we set earlier
    const user = await getUser(sessionUser.telegramId || sessionUser.id);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({
        success: true,
        credits: user.credits,
        user: user
    });
});

// Multi-Tool Cookie API (Proxying Cloudflare Worker)
app.get('/api/cookies/:toolId', async (req, res) => {
    try {
        const { toolId } = req.params;
        const CF_WORKER_URL = `https://sparkseotools.earn7148.workers.dev/${toolId}`;

        const response = await fetch(CF_WORKER_URL);
        const data = await response.json();

        res.json({ success: true, cookies: data });
        console.log(`Cookies for ${toolId} pulled from Cloudflare`);
    } catch (error) {
        console.error("Cloudflare Fetch Error:", error.message);
        res.status(500).json({ success: false, message: "Failed to fetch remote cookies" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
