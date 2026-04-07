(function () {
    function setLayoutReady() {
        var layout = document.querySelector('.auth-layout');
        if (!layout) return;
        requestAnimationFrame(function () {
            layout.classList.add('page-ready');
        });
    }

    function bindThemeToggle() {
        var toggle = document.querySelector('[data-theme-toggle]');
        if (!toggle) return;

        var storageKey = 'auth-theme-mode';
        var saved = localStorage.getItem(storageKey);
        if (saved === 'dark') {
            document.body.classList.add('auth-dark');
            var icon = toggle.querySelector('i');
            if (icon) {
                icon.className = 'fa-solid fa-sun';
            }
        }

        toggle.addEventListener('click', function () {
            document.body.classList.toggle('auth-dark');
            var dark = document.body.classList.contains('auth-dark');
            localStorage.setItem(storageKey, dark ? 'dark' : 'light');

            var icon = toggle.querySelector('i');
            if (icon) {
                icon.className = dark ? 'fa-solid fa-sun' : 'fa-regular fa-moon';
            }
        });
    }

    function bindPasswordToggles() {
        document.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = document.getElementById(btn.getAttribute('data-password-toggle'));
                if (!target) return;

                var icon = btn.querySelector('i');
                var show = target.type === 'password';
                target.type = show ? 'text' : 'password';
                if (icon) {
                    icon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
                }
            });
        });
    }

    function bindFloatingInputs() {
        document.querySelectorAll('.field-shell input').forEach(function (input) {
            var updateState = function () {
                if (input.value.trim() !== '') {
                    input.classList.add('has-value');
                } else {
                    input.classList.remove('has-value');
                }
            };

            input.addEventListener('input', updateState);
            input.addEventListener('blur', updateState);
            updateState();
        });
    }

    function setInlineError(group, message) {
        if (!group) return;
        var errorEl = group.querySelector('.field-error');
        group.classList.remove('valid', 'invalid');

        if (message) {
            group.classList.add('invalid');
            if (errorEl) errorEl.textContent = message;
            return;
        }

        var input = group.querySelector('input');
        if (input && input.value.trim()) {
            group.classList.add('valid');
        }
        if (errorEl) errorEl.textContent = '';
    }

    function validateEmailOrId(value) {
        var raw = value.trim();
        if (!raw) return 'Vui long nhap email hoac MSSV';

        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        var idRegex = /^[0-9A-Za-z._-]{5,20}$/;

        if (emailRegex.test(raw) || idRegex.test(raw)) return '';
        return 'Dinh dang chua hop le';
    }

    function bindLoginValidation() {
        var form = document.querySelector('[data-login-form]');
        if (!form) return;

        var idInput = form.querySelector('#username');
        var passwordInput = form.querySelector('#password');

        idInput.addEventListener('input', function () {
            setInlineError(idInput.closest('.input-group'), validateEmailOrId(idInput.value));
        });

        passwordInput.addEventListener('input', function () {
            var message = passwordInput.value.trim() ? '' : 'Vui long nhap mat khau';
            if (!message && passwordInput.value.length < 6) {
                message = 'Mat khau toi thieu 6 ky tu';
            }
            setInlineError(passwordInput.closest('.input-group'), message);
        });

        form.addEventListener('submit', function (event) {
            var errors = [
                validateEmailOrId(idInput.value),
                passwordInput.value.trim() ? '' : 'Vui long nhap mat khau'
            ];

            if (!errors[1] && passwordInput.value.length < 6) {
                errors[1] = 'Mat khau toi thieu 6 ky tu';
            }

            setInlineError(idInput.closest('.input-group'), errors[0]);
            setInlineError(passwordInput.closest('.input-group'), errors[1]);

            if (errors.some(function (m) { return m; })) {
                event.preventDefault();
                return;
            }

            var submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.classList.add('loading');
                submitButton.setAttribute('aria-busy', 'true');
            }
        });
    }

    function evaluatePassword(value) {
        var score = 0;
        if (value.length >= 8) score += 1;
        if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
        if (/\d/.test(value)) score += 1;
        if (/[^A-Za-z0-9]/.test(value)) score += 1;

        if (!value) {
            return { score: 0, label: 'Nhap mat khau de kiem tra do manh', color: '#d7ccc5' };
        }

        if (score <= 1) {
            return { score: score, label: 'Mat khau yeu', color: '#c63434' };
        }

        if (score <= 2) {
            return { score: score, label: 'Mat khau trung binh', color: '#e79a12' };
        }

        if (score === 3) {
            return { score: score, label: 'Mat khau kha tot', color: '#3f9a6d' };
        }

        return { score: score, label: 'Mat khau manh', color: '#18885c' };
    }

    function bindRegisterValidation() {
        var form = document.querySelector('[data-signup-form]');
        if (!form) return;

        var fullName = form.querySelector('#name');
        var emailOrId = form.querySelector('#identity');
        var username = form.querySelector('#username');
        var email = form.querySelector('#email');
        var studentId = form.querySelector('#studentId');
        var password = form.querySelector('#password');
        var confirmPassword = form.querySelector('#confirmPassword');
        var agree = form.querySelector('#agreeTerms');

        var meter = form.querySelector('[data-password-meter]');
        var feedback = form.querySelector('[data-password-feedback]');

        function syncIdentityFields() {
            var value = emailOrId.value.trim();
            var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

            username.value = value;
            email.value = isEmail ? value : '';
            studentId.value = isEmail ? '' : value;
        }

        function validateName() {
            var message = fullName.value.trim().length >= 2 ? '' : 'Nhap ho ten day du';
            setInlineError(fullName.closest('.input-group'), message);
            return !message;
        }

        function validateIdentity() {
            syncIdentityFields();
            var message = validateEmailOrId(emailOrId.value);
            setInlineError(emailOrId.closest('.input-group'), message);
            return !message;
        }

        function validatePassword() {
            var value = password.value;
            var message = '';
            if (!value.trim()) message = 'Vui long nhap mat khau';
            else if (value.length < 8) message = 'Mat khau toi thieu 8 ky tu';

            var result = evaluatePassword(value);
            meter.style.width = String(Math.max(10, result.score * 25)) + '%';
            meter.style.background = result.color;
            if (!value.trim()) meter.style.width = '0%';
            feedback.textContent = result.label;
            feedback.style.color = result.color;

            setInlineError(password.closest('.input-group'), message);
            return !message;
        }

        function validateConfirmPassword() {
            var message = '';
            if (!confirmPassword.value.trim()) {
                message = 'Vui long nhap lai mat khau';
            } else if (confirmPassword.value !== password.value) {
                message = 'Mat khau xac nhan khong khop';
            }

            setInlineError(confirmPassword.closest('.input-group'), message);
            return !message;
        }

        function validateTerms() {
            var group = agree.closest('.input-group');
            var errorEl = group.querySelector('.field-error');
            if (agree.checked) {
                if (errorEl) errorEl.textContent = '';
                return true;
            }
            if (errorEl) errorEl.textContent = 'Ban can dong y dieu khoan de tiep tuc';
            return false;
        }

        fullName.addEventListener('input', validateName);
        emailOrId.addEventListener('input', validateIdentity);
        password.addEventListener('input', function () {
            validatePassword();
            if (confirmPassword.value.trim()) {
                validateConfirmPassword();
            }
        });
        confirmPassword.addEventListener('input', validateConfirmPassword);
        agree.addEventListener('change', validateTerms);

        form.addEventListener('submit', function (event) {
            var valid = [validateName(), validateIdentity(), validatePassword(), validateConfirmPassword(), validateTerms()]
                .every(function (item) { return item; });

            if (!valid) {
                event.preventDefault();
                return;
            }

            var submitButton = form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.classList.add('loading');
                submitButton.setAttribute('aria-busy', 'true');
            }
        });
    }

    function bindSocialButtons() {
        document.querySelectorAll('.social-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                button.classList.add('loading');
                setTimeout(function () {
                    button.classList.remove('loading');
                    var existing = document.querySelector('[data-social-notice]');
                    if (existing) existing.remove();

                    var notice = document.createElement('p');
                    notice.setAttribute('data-social-notice', '1');
                    notice.className = 'field-hint';
                    notice.textContent = 'Tinh nang social login dang trong qua trinh phat trien.';

                    var container = button.closest('.auth-form');
                    if (container) {
                        container.appendChild(notice);
                    }
                }, 240);
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        setLayoutReady();
        bindThemeToggle();
        bindPasswordToggles();
        bindFloatingInputs();
        bindLoginValidation();
        bindRegisterValidation();
        bindSocialButtons();
    });
})();