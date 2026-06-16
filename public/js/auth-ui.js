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
            input.addEventListener('change', updateState);

            // Detect browser autofill via CSS animation trick
            input.addEventListener('animationstart', function (e) {
                if (e.animationName === 'onAutoFillStart') {
                    input.classList.add('has-value');
                } else if (e.animationName === 'onAutoFillCancel') {
                    updateState();
                }
            });

            updateState();

            // Fallback: poll once after short delay to catch late autofill
            setTimeout(updateState, 600);
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
        if (!raw) return 'Vui lòng nhập email hoặc MSSV';

        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        var idRegex = /^[0-9A-Za-z._-]{5,20}$/;

        if (emailRegex.test(raw) || idRegex.test(raw)) return '';
        return 'Định dạng chưa hợp lệ';
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
            var message = passwordInput.value.trim() ? '' : 'Vui lòng nhập mật khẩu';
            if (!message && passwordInput.value.length < 6) {
                message = 'Mật khẩu tối thiểu 6 ký tự';
            }
            setInlineError(passwordInput.closest('.input-group'), message);
        });

        form.addEventListener('submit', function (event) {
            var errors = [
                validateEmailOrId(idInput.value),
                passwordInput.value.trim() ? '' : 'Vui lòng nhập mật khẩu'
            ];

            if (!errors[1] && passwordInput.value.length < 6) {
                errors[1] = 'Mật khẩu tối thiểu 6 ký tự';
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
            return { score: 0, label: 'Nhập mật khẩu để kiểm tra độ mạnh', color: '#d7ccc5' };
        }

        if (score <= 1) {
            return { score: score, label: 'Mật khẩu yếu', color: '#c63434' };
        }

        if (score <= 2) {
            return { score: score, label: 'Mật khẩu trung bình', color: '#e79a12' };
        }

        if (score === 3) {
            return { score: score, label: 'Mật khẩu khá tốt', color: '#3f9a6d' };
        }

        return { score: score, label: 'Mật khẩu mạnh', color: '#18885c' };
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
            var message = fullName.value.trim().length >= 2 ? '' : 'Nhập họ tên đầy đủ';
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
            if (!value.trim()) message = 'Vui lòng nhập mật khẩu';
            else if (value.length < 8) message = 'Mật khẩu tối thiểu 8 ký tự';

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
                message = 'Vui lòng nhập lại mật khẩu';
            } else if (confirmPassword.value !== password.value) {
                message = 'Mật khẩu xác nhận không khớp';
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
            if (errorEl) errorEl.textContent = 'Bạn cần đồng ý điều khoản để tiếp tục';
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

    function bindMicrosoftModal() {
        var msBtn = document.querySelector('[data-ms-login]');
        var modal = document.getElementById('msModal');
        var cancelBtn = document.getElementById('msCancelBtn');
        var nextBtn = document.getElementById('msNextBtn');
        var emailInput = document.getElementById('msEmailInput');
        var errorEl = document.getElementById('msError');

        if (!msBtn || !modal) return;

        function openModal() {
            modal.removeAttribute('hidden');
            if (emailInput) emailInput.focus();
        }

        function closeModal() {
            modal.setAttribute('hidden', '');
            if (emailInput) emailInput.value = '';
            if (errorEl) errorEl.setAttribute('hidden', '');
        }

        function showError(msg) {
            if (!errorEl) return;
            errorEl.textContent = msg;
            errorEl.removeAttribute('hidden');
        }

        msBtn.addEventListener('click', openModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
        });

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                var email = emailInput ? emailInput.value.trim() : '';
                if (!email) {
                    showError('Vui lòng nhập địa chỉ email.');
                    return;
                }
                if (!email.toLowerCase().endsWith('@sis.hust.edu.vn')) {
                    showError('Chỉ chấp nhận email @sis.hust.edu.vn. Ví dụ: quyen.pd225916@sis.hust.edu.vn');
                    return;
                }
                window.location.href = '/auth/microsoft?hint=' + encodeURIComponent(email);
            });
        }

        if (emailInput) {
            emailInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') nextBtn && nextBtn.click();
            });
        }
    }

    function bindSocialButtons() {
        // Legacy no-op — real OAuth buttons are <a> tags or handled by bindMicrosoftModal
    }

    document.addEventListener('DOMContentLoaded', function () {
        setLayoutReady();
        bindThemeToggle();
        bindPasswordToggles();
        bindFloatingInputs();
        bindLoginValidation();
        bindRegisterValidation();
        bindSocialButtons();
        bindMicrosoftModal();
    });
})();