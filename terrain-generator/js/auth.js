const API_URL = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function showAuthPage() {
    const authPage = document.getElementById('authPage');
    const appPage = document.getElementById('appPage');

    if (authPage) authPage.style.display = 'flex';
    if (appPage) appPage.style.display = 'none';
}

function showAppPage() {
    const authPage = document.getElementById('authPage');
    const appPage = document.getElementById('appPage');

    if (authPage) authPage.style.display = 'none';
    if (appPage) appPage.style.display = 'block';

    updateAccountPanel();

    setTimeout(() => {
        if (typeof onWindowResize === 'function') onWindowResize();
    }, 100);
}

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authStatus').textContent = '';
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authStatus').textContent = '';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showLoginForm();
    showAuthPage();
}

function updateAuthUI() {
    const token = getToken();
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (token && user) showAppPage();
    else showAuthPage();
}

async function registerUser() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const passwordRepeat = document.getElementById('registerPasswordRepeat').value.trim();
    const authStatus = document.getElementById('authStatus');

    if (!username || !email || !password || !passwordRepeat) {
        authStatus.textContent = 'Заполните все поля';
        return;
    }

    if (password.length < 6) {
        authStatus.textContent = 'Пароль должен быть не меньше 6 символов';
        return;
    }

    if (password !== passwordRepeat) {
        authStatus.textContent = 'Пароли не совпадают';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                email,
                password
            })
        });

        const result = await response.json();

        if (response.status === 400) {
            authStatus.textContent = "Введите корректный email";
            return;
        }

        if (response.ok) {
            authStatus.textContent = 'Регистрация успешна. Войдите в аккаунт.';
            showLoginForm();
        } else {
            authStatus.textContent = result.message || 'Ошибка регистрации';
        }

    } catch (error) {
        console.error(error);
        authStatus.textContent = 'Не удалось подключиться к серверу';
    }
}

async function loginUser() {
    const username = document.getElementById('loginUsername').value.trim();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const authStatus = document.getElementById('authStatus');

    if (!username || !email || !password) {
        authStatus.textContent = 'Введите данные';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            login: username,
            email: email,
            password: password
        })
});
        const result = await response.json();

        if (response.ok && result.token) {
            setToken(result.token);

            const user = result.user || { username, email };
            localStorage.setItem('user', JSON.stringify(user));

            authStatus.textContent = '';
            showAppPage();
        } else {
            authStatus.textContent = result.message || 'Ошибка входа';
        }

    } catch (error) {
        console.error(error);
        authStatus.textContent = 'Не удалось подключиться к серверу';
    }
}

function updateAccountPanel() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    const accountName = document.getElementById('accountName');
    const profileUsername = document.getElementById('profileUsername');
    const profileEmail = document.getElementById('profileEmail');

    if (!user) return;

    if (accountName) accountName.textContent = user.username || 'Аккаунт';
    if (profileUsername) profileUsername.textContent = user.username || '—';
    if (profileEmail) profileEmail.textContent = user.email || '—';
}

function toggleAccountDropdown() {
    const dropdown = document.getElementById('accountDropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

function setupAuth() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const accountBtn = document.getElementById('accountBtn');
    const accountLogoutBtn = document.getElementById('accountLogoutBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');

    if (accountBtn) accountBtn.addEventListener('click', toggleAccountDropdown);
    if (accountLogoutBtn) accountLogoutBtn.addEventListener('click', logout);
    if (loginBtn) loginBtn.addEventListener('click', loginUser);
    if (registerBtn) registerBtn.addEventListener('click', registerUser);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (showRegisterBtn) showRegisterBtn.addEventListener('click', showRegisterForm);
    if (showLoginBtn) showLoginBtn.addEventListener('click', showLoginForm);

    updateAuthUI();
}

window.getToken = getToken;
window.setupAuth = setupAuth;