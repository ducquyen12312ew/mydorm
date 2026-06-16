import React from 'react';
import { SafeLayout } from '../../src/components/SafeLayout';
import { WebScreen } from '../../src/components/WebScreen';

// Tab Phòng ở — render trang trạng thái phòng (room-status.ejs) qua WebView.
export default function RoomsTab() {
  return (
    <SafeLayout edges={['top']}>
      <WebScreen path="/room-status" />
    </SafeLayout>
  );
}
