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

async function handleSetCookies(cookies) {
    let successCount = 0;
    let errors = [];

    for (const cookie of cookies) {
        try {
            // Construct the URL required by the API
            // Usually https:// + domain (without leading dot)
            let rawDomain = cookie.domain;
            if (rawDomain.startsWith('.')) {
                rawDomain = rawDomain.substring(1);
            }
            const url = `https://${rawDomain}${cookie.path || '/'}`;

            // Prepare the details object
            // We must filter out properties that are not accepted by chrome.cookies.set 
            // or that need transformation.
            const cookieDetails = {
                url: url,
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                storeId: cookie.storeId
            };

            // sameSite handling
            if (cookie.sameSite) {
                // valid values: "unspecified", "no_restriction", "lax", "strict"
                // The JSON has "no_restriction", "lax", "strict" which matches.
                // Just ensuring case matches if needed, but usually it does.
                // chrome expects "no_restriction" etc.
                cookieDetails.sameSite = cookie.sameSite;
            }

            // Expiration
            // If it is NOT a session cookie, we set expiration.
            // Note: The input JSON has 'session' boolean.
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
