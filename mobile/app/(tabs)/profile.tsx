import React from 'react';
import { SafeLayout } from '../../src/components/SafeLayout';
import { WebScreen } from '../../src/components/WebScreen';

// Tab Hồ sơ — render trang hồ sơ sinh viên (auth-routes /profile → student/profile.ejs) qua WebView.
export default function ProfileTab() {
  return (
    <SafeLayout edges={['top']}>
      <WebScreen path="/profile" />
    </SafeLayout>
  );
}
