const https = require('https');

const BOT_TOKEN = '8275282497:AAEdM3I9DHErbFFZB5W58sZMQcSDmffsgX8';
const WEBHOOK_URL = 'https://starkeotools.vercel.app/api/webhook/k12';

// First delete the webhook
const deleteUrl = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`;

console.log('Step 1: Deleting existing webhook...');
https.get(deleteUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Delete response:', JSON.parse(data));

        // Now set the new webhook
        console.log('\nStep 2: Setting new webhook to:', WEBHOOK_URL);
        const setUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(WEBHOOK_URL)}&drop_pending_updates=true`;

        https.get(setUrl, (res2) => {
            let data2 = '';
            res2.on('data', (chunk) => data2 += chunk);
            res2.on('end', () => {
                console.log('Set webhook response:', JSON.parse(data2));

                // Verify the webhook
                console.log('\nStep 3: Verifying webhook...');
                const verifyUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;

                https.get(verifyUrl, (res3) => {
                    let data3 = '';
                    res3.on('data', (chunk) => data3 += chunk);
                    res3.on('end', () => {
                        const info = JSON.parse(data3);
                        console.log('Webhook info:', JSON.stringify(info, null, 2));

                        if (info.result && info.result.url === WEBHOOK_URL) {
                            console.log('\n✅ SUCCESS! Webhook is properly configured!');
                            console.log('🎉 Your K12 bot is now 24/7 on Vercel!');
                        } else {
                            console.log('\n❌ Warning: Webhook URL doesn\'t match');
                            console.log('Expected:', WEBHOOK_URL);
                            console.log('Got:', info.result?.url || 'empty');
                        }
                    });
                });
            });
        });
    });
});
