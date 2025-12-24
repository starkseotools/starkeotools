const https = require('https');

const BOT_TOKEN = '8275282497:AAEdM3I9DHErbFFZB5W58sZMQcSDmffsgX8';
const WEBHOOK_URL = 'https://starkeotools.vercel.app/api/webhook/k12';

const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(WEBHOOK_URL)}`;

console.log('Setting webhook to:', WEBHOOK_URL);

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const response = JSON.parse(data);
        console.log('✅ Webhook setup response:', response);
        if (response.ok) {
            console.log('🎉 Webhook successfully configured!');
            console.log('Your K12 bot is now available 24/7 at https://starkeotools.vercel.app');
        } else {
            console.log('❌ Error setting webhook:', response.description);
        }
    });
}).on('error', (err) => {
    console.error('❌ Error:', err);
});
