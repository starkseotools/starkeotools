/*
    Stark Seo Tools - Session Injector Logic
*/

// Auth Check
(function checkAuth() {
  const token = localStorage.getItem('stark_auth_token');
  if (!token) {
    window.location.replace('login.html');
  }
})();

// COOKIE_DATA is now fetched remotely from /api/cookies

const injectBtn = document.getElementById('inject-btn');
const statusMessage = document.getElementById('status-message');
const extStatus = document.getElementById('ext-status');

// Helper to update UI
function updateStatus(success, message) {
  statusMessage.classList.remove('hidden', 'visible', 'error');

  // Force reflow
  void statusMessage.offsetWidth;

  if (success) {
    statusMessage.querySelector('span').textContent = message || "Session injected successfully!";
    statusMessage.classList.add('visible');
  } else {
    statusMessage.querySelector('span').textContent = message || "Injection failed.";
    statusMessage.classList.add('visible', 'error');
  }
}

// 1. Check if extension is ready (optional handshake)
const checkExtension = () => {
  // We try to dispatch a 'PING' event and see if we get a pong back instantly or via listener
  // Actually, simpler: The Content Script can inject a data attribute on body
  if (document.body.dataset.extensionInstalled) {
    extStatus.textContent = "Connected";
    extStatus.classList.remove('pending');
    extStatus.classList.add('connected');
  } else {
    setTimeout(checkExtension, 500);
  }
};
checkExtension();

// 2. Handle Button Click
injectBtn.addEventListener('click', async () => {
  // Add loading state
  injectBtn.style.opacity = '0.7';
  injectBtn.innerHTML = '<span class="btn-content"><i class="fa-solid fa-spinner fa-spin"></i><span>Fetching...</span></span>';

  try {
    // 1. Fetch remote cookies from server
    const response = await fetch('/api/cookies');
    const data = await response.json();

    if (data.success) {
      // 2. Dispatch Event with remote cookies
      const event = new CustomEvent('SST_INJECT_COOKIES', { detail: { cookies: data.cookies } });
      document.dispatchEvent(event);
      console.log("Remote cookies fetched and dispatched");
    } else {
      updateStatus(false, "Failed to load remote cookies.");
      resetBtn();
    }
  } catch (error) {
    console.error("Fetch Error:", error);
    updateStatus(false, "Server connection error.");
    resetBtn();
  }
});

function resetBtn() {
  injectBtn.style.opacity = '1';
  injectBtn.innerHTML = '<span class="btn-content"><i class="fa-solid fa-bolt"></i><span>Inject Session</span></span><div class="btn-glow"></div>';
}

// 3. Listen for Response from Content Script
document.addEventListener('SST_INJECT_RESPONSE', (e) => {
  const { success, error } = e.detail;

  // Reset button
  injectBtn.style.opacity = '1';
  injectBtn.innerHTML = '<span class="btn-content"><i class="fa-solid fa-bolt"></i><span>Inject Session</span></span><div class="btn-glow"></div>';

  if (success) {
    updateStatus(true);
    console.log("Cookies injected successfully");

    // Open ChatGPT after a short delay to allow cookies to settle
    setTimeout(() => {
      window.open('https://chatgpt.com', '_blank');
    }, 1000);
  } else {
    updateStatus(false, error || "Injection failed.");
    console.error("Cookie injection failed", error);

    // If error is about other extensions, show the disable button
    if (error && error.includes("delete other extensions")) {
      document.getElementById('disable-ext-btn').classList.remove('hidden');
    }
  }
});

// 4. Handle Disable Extensions Button
const disableBtn = document.getElementById('disable-ext-btn');
disableBtn.addEventListener('click', () => {
  disableBtn.style.opacity = '0.7';
  disableBtn.innerHTML = '<span class="btn-content"><i class="fa-solid fa-spinner fa-spin"></i><span>Disabling...</span></span>';

  // Send message to extension via event
  // We need a new event listener in content.js for this, or reuse the same channel?
  // Content.js listens for NEXUZ_INJECT_COOKIES, let's add NEXUZ_DISABLE_EXTENSIONS
  const event = new CustomEvent('SST_DISABLE_EXTENSIONS');
  document.dispatchEvent(event);
});

// Listener for Disable Response (reuse same response channel or new one? let's use same for simplicity if content.js handles it)
document.addEventListener('SST_DISABLE_RESPONSE', (e) => {
  const { success, count } = e.detail;
  disableBtn.style.opacity = '1';
  disableBtn.innerHTML = '<span class="btn-content"><i class="fa-solid fa-check"></i><span>Disabled ' + count + ' Exts</span></span>';

  setTimeout(() => {
    disableBtn.classList.add('hidden');
    // Auto retry injection?
    injectBtn.click();
  }, 1500);
});
