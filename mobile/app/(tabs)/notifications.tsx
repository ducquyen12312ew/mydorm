import React from 'react';
import { SafeLayout } from '../../src/components/SafeLayout';
import { WebScreen } from '../../src/components/WebScreen';

// Tab Thông báo — render trang thông báo (notifications.ejs) qua WebView.
export default function NotificationsTab() {
  return (
    <SafeLayout edges={['top']}>
      <WebScreen path="/notifications" />
    </SafeLayout>
  );
}
