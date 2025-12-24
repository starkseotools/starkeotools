/*
    Stark Seo Tools - Session Injector Logic
*/

// Global User Data
let currentUser = null;

// Auth & Credits Check
async function initApp() {
  const token = localStorage.getItem('stark_auth_token');
  if (!token) {
    window.location.replace('login.html');
    return;
  }

  try {
    const response = await fetch('/api/user/credits', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.success) {
      currentUser = data.user;
      const formattedBalance = (parseFloat(data.credits) || 0).toFixed(2);
      document.getElementById('user-coins').textContent = `$${formattedBalance}`;
      console.log(`Welcome back, ${currentUser.first_name || 'User'}! Balance: $${formattedBalance}`);
    } else {
      // Invalid session
      localStorage.clear();
      window.location.replace('login.html');
    }
  } catch (e) {
    console.error("Auth initialization failed", e);
  }
}
initApp();

function logout() {
  localStorage.clear();
  window.location.replace('login.html');
}

// COOKIE_DATA is now fetched remotely from /api/cookies connected to Cloudflare

const statusMessage = document.getElementById('status-message'); // Global fallback status
const extStatus = document.getElementById('ext-status');

let currentActiveBtn = null;
let currentActiveStatus = null;
let currentSiteUrl = "https://chatgpt.com"; // Default fallback

// Helper to update UI
function updateStatus(success, message, localStatusContainer) {
  const target = localStatusContainer || statusMessage;
  target.classList.remove('hidden');

  // Reset classes
  target.classList.remove('bg-green-50', 'text-green-600', 'border-green-100');
  target.classList.remove('bg-red-50', 'text-red-600', 'border-red-100');

  // Force reflow
  void target.offsetWidth;

  const iconClass = success ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation';
  const msgText = message || (success ? "Session ready!" : "Injection failed.");

  if (success) {
    target.classList.add('bg-green-50', 'text-green-600', 'border-green-100');
  } else {
    target.classList.add('bg-red-50', 'text-red-600', 'border-red-100');
  }

  target.innerHTML = `<i class="${iconClass}"></i> <span class="ml-2">${msgText}</span>`;
}

// 1. Check if extension is ready
const checkExtension = () => {
  if (document.body.dataset.extensionInstalled) {
    extStatus.textContent = "Connected";
    extStatus.classList.remove('bg-gray-100', 'text-gray-500');
    extStatus.classList.add('bg-green-100', 'text-green-600', 'border', 'border-green-200');
  } else {
    setTimeout(checkExtension, 500);
  }
};
checkExtension();

// 2. Handle Multiple Button Clicks
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.inject-btn');
  if (!btn) return;

  const toolId = btn.dataset.toolId || 'app1';
  currentSiteUrl = btn.dataset.siteUrl || "https://chatgpt.com";
  currentActiveBtn = btn;
  currentActiveStatus = btn.parentElement.querySelector('.status-msg');

  // Add loading state
  btn.style.opacity = '0.7';
  btn.innerHTML = '<span class="btn-content"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading...</span></span>';

  try {
    const response = await fetch(`/api/cookies/${toolId}`);
    const data = await response.json();

    if (data.success) {
      const event = new CustomEvent('SST_INJECT_COOKIES', { detail: { cookies: data.cookies } });
      document.dispatchEvent(event);
      console.log(`Remote cookies for ${toolId} fetched`);
    } else {
      updateStatus(false, "No session found.", currentActiveStatus);
      resetBtn(btn);
    }
  } catch (error) {
    console.error("Fetch Error:", error);
    updateStatus(false, "Server Error.", currentActiveStatus);
    resetBtn(btn);
  }
});

function resetBtn(btn) {
  if (!btn) return;
  btn.style.opacity = '1';
  btn.innerHTML = '<span class="btn-content"><i class="fa-solid fa-bolt"></i><span>Access Session</span></span><div class="btn-glow"></div>';
}

// 3. Listen for Response from Content Script
document.addEventListener('SST_INJECT_RESPONSE', (e) => {
  const { success, error } = e.detail;

  resetBtn(currentActiveBtn);

  if (success) {
    updateStatus(true, "Session Started!", currentActiveStatus);
    setTimeout(() => {
      window.open(currentSiteUrl, '_blank');
    }, 1000);
  } else {
    updateStatus(false, error || "Failed.", currentActiveStatus);
    if (error && error.includes("delete other extensions")) {
      // Show global disable button if visible
      const disableGlobal = document.getElementById('disable-ext-btn');
      if (disableGlobal) disableGlobal.classList.remove('hidden');
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
  // Content.js listens for SST_INJECT_COOKIES, let's add SST_DISABLE_EXTENSIONS
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
