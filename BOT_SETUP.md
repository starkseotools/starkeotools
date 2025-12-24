# 🤖 How to Create & Connect Your Telegram Bot

Follow these simple steps to get your access code system working.

## Step 1: Create the Bot on Telegram
1. Open the **Telegram** app on your phone or desktop.
2. Search for **"BotFather"** (Verified account with a blue checkmark).
3. Click **Start** or type `/start`.
4. Type `/newbot` and press Enter.
5. **Name your bot**: Enter a display name (e.g., "My Access Bot").
6. **Choose a username**: Enter a unique username ending in `bot` (e.g., `MySuperAccess_bot`).
7. **Copy the Token**: BotFather will give you a long string of characters called the **HTTP API Token**.
   - It looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
   - **Copy this entire token.**

## Step 2: Connect it to the Code
1. Go to your project folder: `cookie-loader-system`.
2. Open the file **`server.js`** in a text editor (Notepad, VS Code, etc.).
3. Find this line (around line 11):
   ```javascript
   const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN_HERE';
   ```
4. Replace `'YOUR_TELEGRAM_BOT_TOKEN_HERE'` with your actual token inside the quotes.
   - Example:
   ```javascript
   const BOT_TOKEN = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'; // example
   ```
5. **Save** the file.

## Step 3: Run the System
1. Open your terminal/command prompt in the `cookie-loader-system` folder.
2. Run the server:
   ```bash
   node server.js
   ```
3. You should see "Telegram Bot started..." in the console.

## Step 4: Login
1. Open [http://localhost:8000](http://localhost:8000).
2. It will ask for a verification code.
3. Go to your new bot in Telegram.
4. Type `/start` or `/otp`.
5. The bot will send you a 6-digit code.
6. Enter that code on the website to access the tool!
