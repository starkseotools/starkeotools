const TARGET_DOMAINS = ["chatgpt.com", ".chatgpt.com"];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "setCookies") {
        checkOtherExtensions().then((hasOthers) => {
            if (hasOthers) {
                // The specific error message requested by the user
                sendResponse({ success: false, error: "injection failed delete other extensions other than my extension to continue" });
            } else {
                handleSetCookies(message.cookies).then((result) => {
                    sendResponse(result);
                });
            }
        });
        return true; // Keep channel open for async response
    }

    if (message.action === "disableOtherExtensions") {
        disableAllOtherExtensions().then((count) => {
            sendResponse({ success: true, count: count });
        });
        return true;
    }
});

// Watch for extensions being enabled
chrome.management.onEnabled.addListener((info) => {
    // If the enabled extension is NOT this one, and is of type 'extension'
    if (info.id !== chrome.runtime.id && info.type === 'extension') {
        console.log(`Extension ${info.name} was enabled. Clearing cookies and reloading tabs...`);
        clearTargetCookies().then(() => {
            reloadTargetTabs();
        });
    }
});

async function reloadTargetTabs() {
    const domains = TARGET_DOMAINS; // ["chatgpt.com", ".chatgpt.com"]
    // Convert domains to match patterns for query
    // We want *://chatgpt.com/* and *://*.chatgpt.com/*
    const patterns = ["*://chatgpt.com/*", "*://*.chatgpt.com/*"];

    // We can query tabs by url
    try {
        const tabs = await chrome.tabs.query({ url: patterns });
        for (const tab of tabs) {
            console.log("Reloading tab:", tab.url);
            chrome.tabs.reload(tab.id);
        }
    } catch (err) {
        console.error("Error reloading tabs:", err);
    }
}

async function clearTargetCookies() {
    // Clear cookies for target domains
    const domains = TARGET_DOMAINS;
    console.log("[SST Protect] Clearing cookies because an unauthorized extension was enabled.");

    for (const domain of domains) {
        try {
            const cookies = await chrome.cookies.getAll({ domain: domain });
            for (const cookie of cookies) {
                let rawDomain = cookie.domain;
                if (rawDomain.startsWith('.')) rawDomain = rawDomain.substring(1);
                const url = `https://${rawDomain}${cookie.path}`;
                await chrome.cookies.remove({ url: url, name: cookie.name });
            }
        } catch (err) {
            console.error("Error clearing cookies:", err);
        }
    }
}

async function disableAllOtherExtensions() {
    return new Promise((resolve) => {
        chrome.management.getAll((extensions) => {
            const others = extensions.filter(ext =>
                ext.type === 'extension' &&
                ext.enabled &&
                ext.id !== chrome.runtime.id
            );

            let disabledCount = 0;
            const promises = others.map(ext => {
                return new Promise((res) => {
                    chrome.management.setEnabled(ext.id, false, () => {
                        disabledCount++;
                        res();
                    });
                });
            });

            Promise.all(promises).then(() => {
                resolve(disabledCount);
            });
        });
    });
}

async function checkOtherExtensions() {
    return new Promise((resolve) => {
        chrome.management.getAll((extensions) => {
            const others = extensions.filter(ext =>
                ext.type === 'extension' &&
                ext.enabled &&
                ext.id !== chrome.runtime.id
            );
            console.log("Other extensions found:", others.map(e => e.name));
            resolve(others.length > 0);
        });
    });
}

async function clearTargetData() {
    console.log("[SST Security] Performing deep cleaning for ChatGPT...");

    // Auth and core domains
    const origins = [
        "https://chatgpt.com",
        "https://www.chatgpt.com",
        "https://auth.openai.com",
        "https://auth0.com",
        "https://ab.chatgpt.com"
    ];

    return new Promise((resolve) => {
        chrome.browsingData.remove({
            "origins": origins
        }, {
            "cache": true,
            "cookies": true,
            "localStorage": true,
            "indexedDB": true,
            "serviceWorkers": true
        }, resolve);
    });
}

async function handleSetCookies(cookies) {
    let successCount = 0;
    let errors = [];

    // 1. Deep clean before injection
    await clearTargetData();

    for (const cookie of cookies) {
        try {
            // Construct base URL
            let rawDomain = cookie.domain;
            const isSubdomain = rawDomain.startsWith('.');
            const domainForUrl = isSubdomain ? rawDomain.substring(1) : rawDomain;
            const url = `https://${domainForUrl}${cookie.path || '/'}`;

            const cookieDetails = {
                url: url,
                name: cookie.name,
                value: cookie.value,
                path: cookie.path || '/',
                secure: true,
                httpOnly: cookie.httpOnly || false
            };

            // Essential: Domain must match exactly for wildcard cookies
            if (isSubdomain) {
                cookieDetails.domain = cookie.domain;
            }

            // Cloudflare/Auth0 fix: Force SameSite to None for cross-site auth tokens
            // This is critical for modern browsers to accept these cookies correctly
            cookieDetails.sameSite = "no_restriction";

            // Expiration
            if (!cookie.session && cookie.expirationDate) {
                cookieDetails.expirationDate = cookie.expirationDate;
            }

            await chrome.cookies.set(cookieDetails);
            successCount++;
        } catch (error) {
            console.error(`Failed to set cookie ${cookie.name}:`, error);
            errors.push(`${cookie.name}: ${error.message}`);
        }
    }

    if (errors.length > 0 && successCount === 0) {
        return { success: false, error: "Failed to set all cookies. " + errors.join(", ") };
    } else if (errors.length > 0) {
        // Partial success
        return { success: true, error: `Set ${successCount} cookies, but some failed: ${errors.join(", ")}` };
    }

    return { success: true };
}
