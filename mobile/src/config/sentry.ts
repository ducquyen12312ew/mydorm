import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = (Constants.expoConfig?.extra as any)?.sentryDsn as string | undefined;
const ENV = (Constants.expoConfig?.extra as any)?.appEnv as string ?? 'development';

export function initSentry() {
    if (!DSN) {
        console.warn('[Sentry] sentryDsn not set in app.json extra — crash reporting disabled');
        return;
    }

    Sentry.init({
        dsn: DSN,
        environment: ENV,
        debug: ENV === 'development',

        // Capture 100% of transactions in dev, 20% in production
        tracesSampleRate: ENV === 'production' ? 0.2 : 1.0,

        // Attach JS bundle info for source map symbolication
        enableNativeFramesTracking: true,

        // Capture unhandled promise rejections
        enableAutoSessionTracking: true,
        sessionTrackingIntervalMillis: 30000,

        // Redact sensitive fields from payloads before they leave the device
        beforeSend(event) {
            if (event.request?.data) {
                const data = event.request.data as Record<string, unknown>;
                delete data.password;
                delete data.refreshToken;
                delete data.accessToken;
            }
            return event;
        },
    });
}

export { Sentry };
