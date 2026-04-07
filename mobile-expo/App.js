import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getWebAppUrl } from './src/config';

const AUTO_REFRESH_MS = 15000;

export default function App() {
  const webViewRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const targetUrl = useMemo(() => getWebAppUrl(), []);

  const reload = useCallback(() => {
    setHasError(false);
    webViewRef.current?.reload();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
    setTimeout(() => setRefreshing(false), 700);
  }, [reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        reload();
      }
    });

    return () => sub.remove();
  }, [reload]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (appStateRef.current === 'active') {
        reload();
      }
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
  }, [reload]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1f3a" />
      {hasError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Cannot connect to server</Text>
          <Text style={styles.errorText}>{targetUrl}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload} activeOpacity={0.85}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: targetUrl }}
          style={styles.webview}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          startInLoadingState
          onLoadStart={() => {
            setLoading(true);
            setHasError(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
          renderLoading={() => (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#1f6feb" />
            </View>
          )}
          pullToRefreshEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1f6feb" />
          }
        />
      )}
      {loading && !hasError ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#1f6feb" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b1f3a'
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  loadingOverlay: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 30,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)'
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc'
  },
  errorTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center'
  },
  errorText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 18,
    textAlign: 'center'
  },
  retryBtn: {
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  }
});
