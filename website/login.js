const otpInput = document.getElementById('otp-input');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('login-error');

// Handle formatting (numbers only)
otpInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
});

// Authenticate
loginBtn.addEventListener('click', async () => {
    const otp = otpInput.value;
    if (otp.length !== 6) {
        showError("Please enter a 6-digit code");
        return;
    }

    setLoading(true);

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otp })
        });

        const data = await response.json();

        if (data.success) {
            // Store session
            localStorage.setItem('stark_auth_token', data.token);
            window.location.href = 'index.html';
        } else {
            showError(data.message || "Authentication Failed");
        }
    } catch (err) {
        showError("Server Connection Error");
        console.error(err);
    } finally {
        setLoading(false);
    }
});

function showError(msg) {
    errorMessage.querySelector('span').textContent = msg;
    errorMessage.classList.remove('hidden');

    // Shake animation
    const card = document.querySelector('.glass-card');
    card.style.animation = 'shake 0.4s ease';
    setTimeout(() => card.style.animation = '', 400);
}

function setLoading(isLoading) {
    if (isLoading) {
        loginBtn.style.opacity = 0.7;
        loginBtn.innerHTML = '<span class="btn-content"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Verifying...</span></span>';
        loginBtn.disabled = true;
    } else {
        loginBtn.style.opacity = 1;
        loginBtn.innerHTML = '<span class="btn-content"><span>Authenticate</span><i class="fa-solid fa-arrow-right"></i></span><div class="btn-glow"></div>';
        loginBtn.disabled = false;
    }
}

// Add shake keyframes to style dynamically
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
`;
document.head.appendChild(style);
