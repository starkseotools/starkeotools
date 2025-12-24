console.log("[Stark Seo Tools] Content script initialized.");

// 1. Signal presence to the web page
function signalPresence() {
    if (document.body) {
        document.body.dataset.extensionInstalled = "true";
        console.log("[SST Injector] Signaled presence to page.");

        // If we are on ChatGPT, start protection
        if (window.location.hostname.includes("chatgpt.com")) {
            startChatProtection();
        }
    } else {
        requestAnimationFrame(signalPresence);
    }
}
signalPresence();

/**
 * Security: Protect ChatGPT Account
 */
function startChatProtection() {
    console.log("[SST Security] Protection Active for ChatGPT");

    // A. Inject CSS to hide profile and upgrade buttons
    const style = document.createElement('style');
    style.innerHTML = `
        /* Hide Bottom Sidebar Profile */
        div[class*="flex"][class*="items-center"][class*="gap-2"][class*="p-2"][class*="bg-token-sidebar-surface-primary"],
        div[class*="mt-auto"] > div:last-child,
        nav div[class*="group/profile"],
        /* Hide Upgrade buttons */
        a[href="/premium"],
        button[class*="bg-token-main-surface-primary"][class*="text-token-text-primary"],
        div[class*="bg-token-main-surface-primary"] button:has(div:contains("Upgrade")),
        .upgrade-button-class-here { 
            display: none !important; 
            visibility: hidden !important; 
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);

    // B. Block Settings Access
    const blockSettings = () => {
        const sensitiveUrls = ['#settings', '/settings', '/admin', '/billing'];
        const currentUrl = window.location.href.toLowerCase();

        sensitiveUrls.forEach(slug => {
            if (currentUrl.includes(slug)) {
                console.warn("[SST Security] Access to settings blocked!");
                window.location.href = "https://chatgpt.com/";
                alert("Security Alert: Access to Settings is restricted on this session.");
            }
        });
    };

    // Run check immediately and on every URL change
    blockSettings();
    window.addEventListener('popstate', blockSettings);
    window.addEventListener('hashchange', blockSettings);

    // Periodically check for dynamic elements that might appear later
    setInterval(blockSettings, 1000);
}

// 2. Listen for the custom event from the page
document.addEventListener('SST_INJECT_COOKIES', (e) => {
    console.log("[SST Injector] Received cookie payload.", e.detail);

    const { cookies } = e.detail;

    if (!cookies || !Array.isArray(cookies)) {
        console.error("[SST Injector] Invalid payload.");
        replyToPage(false, "Invalid cookie data received.");
        return;
    }

    // Send to background script
    chrome.runtime.sendMessage({ action: "setCookies", cookies }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("[SST Injector] Runtime error:", chrome.runtime.lastError);
            replyToPage(false, chrome.runtime.lastError.message);
            return;
        }

        replyToPage(response && response.success, response && response.error);
    });
});

// 3. Listen for disable request
document.addEventListener('SST_DISABLE_EXTENSIONS', () => {
    console.log("[SST Injector] Requesting to disable other extensions...");
    chrome.runtime.sendMessage({ action: "disableOtherExtensions" }, (response) => {
        const event = new CustomEvent('SST_DISABLE_RESPONSE', {
            detail: response
        });
        document.dispatchEvent(event);
    });
});

// Helper to send response back to page
function replyToPage(success, error) {
    // We must clone the detail object to pass it across worlds safely if needed, 
    // but usually primitives/simple objects work fine.
    const event = new CustomEvent('SST_INJECT_RESPONSE', {
        detail: { success, error }
    });
    document.dispatchEvent(event);
}
