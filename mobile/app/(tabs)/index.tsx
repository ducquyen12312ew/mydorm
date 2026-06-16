import React from 'react';
import { SafeLayout } from '../../src/components/SafeLayout';
import { WebScreen } from '../../src/components/WebScreen';

// Tab Tổng quan — render trang chủ sinh viên (student/home.ejs) qua WebView.
// Socket realtime + local push được xử lý ở (tabs)/_layout.tsx (useStudentSocket).
export default function DashboardTab() {
  return (
    <SafeLayout edges={['top']}>
      <WebScreen path="/" />
    </SafeLayout>
  );
}
