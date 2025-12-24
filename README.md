# Stark Session Injector System

This project consists of a **Chrome Extension** and a **Web Interface** designed to inject session cookies for ChatGPT.

## 🚀 Setup Instructions

### Step 1: Install the Extension
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `extension` folder inside this directory (`cookie-loader-system/extension`).
5. The extension "Stark Session Injector" should now be active.

### Step 2: Run the Website
For the extension to communicate securely with the website, it is best to run the website on a local server (localhost).

**Using Python (Recommended):**
1. Open a terminal/command prompt.
2. Navigate to the `website` folder:
   ```bash
   cd cookie-loader-system/website
   ```
3. Start a simple HTTP server:
   ```bash
   python -m http.server 8000
   ```
4. Open your browser and go to: [http://localhost:8000](http://localhost:8000)

**Alternatively (File Access):**
If you prefer to just open `index.html` directly:
1. Go to the extension details page in `chrome://extensions/`.
2. Scroll down and enable **"Allow access to file URLs"**.
3. Double-click `index.html` to open it.

### Step 3: Inject Session
1. On the web page, you will see a "Status" indicator. It should say "Connected" if the extension is properly loaded.
2. Click the **"Inject Session"** button.
3. If successful, you will see a success message.
4. Go to [chatgpt.com](https://chatgpt.com) and verify you are logged in!

## ⚠️ Notes
- The cookies provided in the configuration are time-sensitive.
- Ensure you do not share your own sensitive cookies publicly.
