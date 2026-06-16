/**
 * WebScreen.tsx
 *
 * Component WebView dùng chung cho tất cả màn hình.
 * Render trang EJS từ server, inject CSS ẩn desktop navbar, và xác thực
 * request bằng JWT của mobile (server đọc qua middleware mobileWebViewAuth).
 *
 * Cơ chế auth:
 *  - Lần load đầu (top-level navigation): gửi `Authorization: Bearer <token>`
 *    qua `source.headers` → server xác thực ngay, KHÔNG bị redirect /login.
 *  - Sau khi load: inject cookie `mobile_token` + override fetch/XHR để các
 *    request con (link tap, AJAX) cũng mang token.
 *
 * Token lấy từ TokenStore (SecureStore) — authStore KHÔNG giữ accessToken.
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { TokenStore } from '../api/client';
import { apiConfig } from '../config';
import { Colors } from '../constants/colors';

// ── CSS inject vào mỗi trang web để thích nghi mobile ──────────────────────
const MOBILE_CSS_OVERRIDE = `
  /* Ẩn hoàn toàn header/navbar desktop */
  .header,
  header.header,
  nav.header,
  .nav-container,
  .nav-links,
  .menu-toggle,
  .pwa-install-banner,
  .pwa-update-toast,
  .pwa-ios-guide,
  .pwa-offline-bar {
    display: none !important;
  }

  /* Xóa padding-top dành cho fixed header */
  body, .student-shell-page, main {
    padding-top: 0 !important;
    margin-top: 0 !important;
  }

  /* Safe area bottom — tránh bottom tab bar che content */
  body {
    padding-bottom: env(safe-area-inset-bottom, 80px) !important;
    margin-bottom: 80px !important;
  }

  .hero { margin-top: 0 !important; }

  /* Ẩn floating buttons thừa */
  .back-to-top, .floating-btn, #backToTop { display: none !important; }

  html { scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
  a, button { min-height: 44px; min-width: 44px; }

  /* Trang cụ thể */
  .filter-sidebar { display: none !important; }
  .notifications-container { padding: 12px !important; }
  .desktop-only { display: none !important; }

  @media (max-width: 430px) {
    .hero-title { font-size: 1.6rem !important; }
    .section-title { font-size: 1.3rem !important; }
    .dorm-slider-container { padding: 0 !important; }
  }
`;

// ── JS inject CSS override — bền vững: chạy ngay + DOMContentLoaded + retry ──
// (onLoadEnd đơn lẻ có thể bị bỏ lỡ khi điều hướng giữa các tab.)
const HIDE_SELECTORS = [
  '.header',
  'header.header',
  'nav.header',
  '.menu-toggle',
  '.nav-container',
  '.nav-links',
  '.pwa-install-banner',
  '.pwa-update-toast',
  '.pwa-ios-guide',
  '.pwa-offline-bar',
  '.back-to-top',
  '.floating-btn',
  '#backToTop',
];

const CSS_INJECTION_JS = `
  (function() {
    var CSS = ${JSON.stringify(MOBILE_CSS_OVERRIDE)};
    var SELS = ${JSON.stringify(HIDE_SELECTORS)};
    function injectStyle() {
      if (!document.head) return false;
      if (!document.getElementById('mobile-override')) {
        var style = document.createElement('style');
        style.id = 'mobile-override';
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      return true;
    }
    // Inline style 'display:none !important' luôn thắng mọi rule stylesheet —
    // bảo đảm ẩn navbar desktop kể cả khi CSS file của trang load sau.
    function hideEls() {
      try {
        for (var i = 0; i < SELS.length; i++) {
          var els = document.querySelectorAll(SELS[i]);
          for (var j = 0; j < els.length; j++) {
            els[j].style.setProperty('display', 'none', 'important');
          }
        }
      } catch (e) {}
    }
    function run() { injectStyle(); hideEls(); }
    run();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    }
    var n = 0;
    var iv = setInterval(function() { run(); if (++n >= 8) clearInterval(iv); }, 200);
  })();
  true;
`;

// ── JS inject token vào cookie + fetch/XHR cho các request con ─────────────
function buildTokenInjectionJS(token: string): string {
  const safe = JSON.stringify(token);
  return `
    (function() {
      try {
        document.cookie = 'mobile_token=' + ${safe} + '; path=/; SameSite=Lax';
        var origFetch = window.fetch;
        window.fetch = function(url, opts) {
          opts = opts || {};
          opts.headers = opts.headers || {};
          try { opts.headers['Authorization'] = 'Bearer ' + ${safe}; } catch (e) {}
          return origFetch(url, opts);
        };
        var origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function() {
          try { this.setRequestHeader('Authorization', 'Bearer ' + ${safe}); } catch (e) {}
          return origSend.apply(this, arguments);
        };
      } catch (e) {}
    })();
    true;
  `;
}

// Script chạy TRƯỚC nội dung trang: token (nếu có) + CSS injector bền vững.
function buildBeforeContentJS(token: string | null): string {
  return `${token ? buildTokenInjectionJS(token) : ''}\n${CSS_INJECTION_JS}`;
}

interface WebScreenProps {
  /** Path sau base URL, ví dụ: '/', '/room-status', '/notifications' */
  path: string;
  /** Callback khi navigate sang URL khác trong WebView */
  onNavigate?: (url: string) => void;
}

export function WebScreen({ path, onNavigate }: WebScreenProps) {
  const webViewRef = useRef<WebView>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const url = `${apiConfig.baseUrl}${path}`;

  // Lấy token từ SecureStore một lần khi mount.
  useEffect(() => {
    let mounted = true;
    TokenStore.getAccess()
      .then((t) => {
        if (!mounted) return;
        setToken(t);
        setTokenReady(true);
      })
      .catch(() => mounted && setTokenReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    setError(false);
    webViewRef.current?.injectJavaScript(CSS_INJECTION_JS);
    if (token) {
      webViewRef.current?.injectJavaScript(buildTokenInjectionJS(token));
    }
  }, [token]);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'NAVIGATE' && onNavigate) onNavigate(data.url);
      } catch (_) {}
    },
    [onNavigate]
  );

  // Nếu server redirect /login (token chưa kịp inject ở subnav) → re-inject.
  const handleNavChange = useCallback(
    (nav: WebViewNavigation) => {
      if ((nav.url.includes('/login') || nav.url.includes('/signup')) && token) {
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(buildTokenInjectionJS(token));
        }, 300);
      }
      return true;
    },
    [token]
  );

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>📡</Text>
        <Text style={styles.errorTitle}>Không thể kết nối</Text>
        <Text style={styles.errorSub}>
          Kiểm tra server đang chạy tại{'\n'}
          {apiConfig.baseUrl}
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setError(false);
            setLoading(true);
            webViewRef.current?.reload();
          }}
        >
          <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Chờ token được nạp xong rồi mới load WebView (để header auth lần đầu đúng).
  if (!tokenReady) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={
          token
            ? { uri: url, headers: { Authorization: `Bearer ${token}` } }
            : { uri: url }
        }
        style={styles.webview}
        // QUAN TRỌNG: token (cookie + fetch/XHR override) + CSS injector chạy
        // TRƯỚC khi script trang chạy → fetch dữ liệu có token, header bị ẩn ngay.
        injectedJavaScriptBeforeContentLoaded={buildBeforeContentJS(token)}
        onLoadEnd={handleLoadEnd}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        onShouldStartLoadWithRequest={handleNavChange}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        userAgent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 eDormApp/1.0"
        setSupportMultipleWindows={false}
        scrollEnabled
        bounces
        overScrollMode="always"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  errorSub: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
