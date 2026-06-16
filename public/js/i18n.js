/* eDorm i18n engine — lightweight client-side translations */
(function () {
    'use strict';

    var SUPPORTED = ['vi', 'en', 'zh', 'ko', 'ru', 'th', 'lo', 'km'];
    var DEFAULT = 'vi';
    var _lang = DEFAULT;
    var _dict = {};
    var _loading = null;

    function _get(key) {
        var parts = key.split('.');
        var val = _dict;
        for (var i = 0; i < parts.length; i++) {
            if (val == null || typeof val !== 'object') return null;
            val = val[parts[i]];
        }
        return (typeof val === 'string') ? val : null;
    }

    function t(key, fallback) {
        var v = _get(key);
        return v !== null ? v : (fallback !== undefined ? fallback : key);
    }

    function _apply() {
        if (_lang === DEFAULT) {
            document.documentElement.lang = 'vi';
            _updateSwitcherState();
            return;
        }
        /* text content */
        var els = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < els.length; i++) {
            var key = els[i].getAttribute('data-i18n');
            var val = t(key);
            if (val !== key) els[i].textContent = val;
        }
        /* html content */
        var hels = document.querySelectorAll('[data-i18n-html]');
        for (var j = 0; j < hels.length; j++) {
            var hkey = hels[j].getAttribute('data-i18n-html');
            var hval = t(hkey);
            if (hval !== hkey) hels[j].innerHTML = hval;
        }
        /* placeholder */
        var pels = document.querySelectorAll('[data-i18n-placeholder]');
        for (var k = 0; k < pels.length; k++) {
            var pkey = pels[k].getAttribute('data-i18n-placeholder');
            var pval = t(pkey);
            if (pval !== pkey) pels[k].placeholder = pval;
        }
        /* title attr */
        var tels = document.querySelectorAll('[data-i18n-title]');
        for (var m = 0; m < tels.length; m++) {
            var tkey = tels[m].getAttribute('data-i18n-title');
            var tval = t(tkey);
            if (tval !== tkey) tels[m].title = tval;
        }
        document.documentElement.lang = _lang;
        _updateSwitcherState();
    }

    function _updateSwitcherState() {
        var opts = document.querySelectorAll('[data-lang-opt]');
        for (var i = 0; i < opts.length; i++) {
            var isActive = opts[i].getAttribute('data-lang-opt') === _lang;
            opts[i].classList.toggle('i18n-active', isActive);
        }
    }

    function _loadDict(lang, cb) {
        if (lang === DEFAULT) {
            _dict = {};
            _lang = DEFAULT;
            cb && cb();
            return;
        }
        if (_loading === lang) return;
        _loading = lang;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/locales/' + lang + '.json', true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            _loading = null;
            if (xhr.status === 200) {
                try { _dict = JSON.parse(xhr.responseText); } catch (e) { _dict = {}; }
                _lang = lang;
            } else {
                _dict = {};
                _lang = DEFAULT;
                localStorage.setItem('edorm_lang', DEFAULT);
            }
            cb && cb();
        };
        xhr.send();
    }

    function setLanguage(lang, persist) {
        if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT;
        localStorage.setItem('edorm_lang', lang);
        _loadDict(lang, function () {
            _apply();
            /* save to DB (non-blocking, ignore errors) */
            if (persist !== false) {
                try {
                    var xhr2 = new XMLHttpRequest();
                    xhr2.open('POST', '/api/user/language', true);
                    xhr2.setRequestHeader('Content-Type', 'application/json');
                    xhr2.send(JSON.stringify({ language: lang }));
                } catch (e) {}
            }
        });
    }

    function getLang() { return _lang; }

    function init() {
        var saved = localStorage.getItem('edorm_lang') || DEFAULT;
        /* attach click handlers for switcher buttons */
        document.addEventListener('click', function (e) {
            var el = e.target.closest('[data-lang-opt]');
            if (el) {
                e.preventDefault();
                e.stopPropagation();
                setLanguage(el.getAttribute('data-lang-opt'));
            }
        });
        if (saved === DEFAULT) {
            _lang = DEFAULT;
            _updateSwitcherState();
        } else {
            _loadDict(saved, _apply);
        }
    }

    /* expose */
    window.i18n = { t: t, setLanguage: setLanguage, getLang: getLang, apply: _apply };
    window.t = t;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
