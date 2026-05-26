import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { fetchNotifications, markNotificationRead } from '../lib/api';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState('');
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000)
  });

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData(['notifications']);

      queryClient.setQueryData(['notifications'], (current = []) =>
        current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
      );

      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['notifications'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onSuccess: () => {
      setSuccessMessage('Notification marked as read');
      window.setTimeout(() => setSuccessMessage(''), 1800);
    }
  });

  return (
    <section className="space-y-4">
      <header className="rounded-3xl bg-white p-5 shadow-soft dark:bg-slate-900">
        <h1 className="text-xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">Assignment, cycle and review updates in one stream.</p>
      </header>

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {successMessage}
        </div>
      ) : null}

      <div className="space-y-3">
        {notificationsQuery.isLoading ? (
          <div className="rounded-3xl bg-white p-5 text-sm text-slate-500 shadow-soft dark:bg-slate-900">Loading notifications…</div>
        ) : (notificationsQuery.data || []).length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-soft dark:bg-slate-900">
            <p className="text-base font-semibold">No notifications yet</p>
            <p className="mt-1 text-sm text-slate-500">When allocation or review changes happen, they will appear here.</p>
          </div>
        ) : (
          (notificationsQuery.data || []).map((notification) => (
            <motion.button
              key={notification.id}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => readMutation.mutate(notification.id)}
              className="w-full rounded-3xl bg-white p-4 text-left shadow-soft transition dark:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                  <BellRing size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {new Date(notification.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                {!notification.isRead ? <span className="mt-2 h-2.5 w-2.5 rounded-full bg-coral" /> : null}
              </div>
            </motion.button>
          ))
        )}
      </div>
    </section>
  );
}
