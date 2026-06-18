/**
 * login.js — Page de connexion
 */
document.getElementById('year').textContent = new Date().getFullYear();

/* Logo */
(function() {
  const logo = DB.getLogo();
  if (logo) {
    document.getElementById('logoImg').src = logo;
    document.getElementById('logoImg').style.display = 'block';
    document.getElementById('logoPlaceholder').style.display = 'none';
  }
  const co = DB.getCompany();
  if (co.name) document.getElementById('companyNameDisplay').textContent = co.name;
})();

document.getElementById('logoInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    DB.saveLogo(e.target.result);
    document.getElementById('logoImg').src = e.target.result;
    document.getElementById('logoImg').style.display = 'block';
    document.getElementById('logoPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

/* Connexion */
document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('loginError');

  if (!username || !password) { showError(errEl, 'Veuillez renseigner tous les champs.'); return; }

  const user = DB.findUser(username, password);
  if (!user) { showError(errEl, 'Identifiant ou mot de passe incorrect.'); return; }

  DB.setSession(user);
  window.location.href = user.role === 'admin' ? 'pages/admin.html' : 'pages/employee.html';
});

function showError(el, msg) {
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function togglePassword() {
  const input = document.getElementById('password');
  const icon  = document.getElementById('eyeIcon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    input.type = 'password';
    icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}
