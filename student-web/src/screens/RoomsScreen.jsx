import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchFavorites, fetchRooms, removeFavorite, saveFavorite } from '../lib/api';
import CardSkeleton from '../components/CardSkeleton';

export default function RoomsScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
    refetchInterval: 30000
  });
  const favoritesQuery = useQuery({ queryKey: ['favorites'], queryFn: fetchFavorites });
  const favoriteSet = new Set((favoritesQuery.data || []).map((item) => String(item.id)));

  const addFavorite = useMutation({
    mutationFn: saveFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] })
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] })
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-3xl bg-white p-5 shadow-soft dark:bg-slate-900">
        <h1 className="text-xl font-bold">Explore Rooms</h1>
        <p className="mt-1 text-sm text-slate-500">Swipe-friendly card list optimized for touch.</p>
      </header>

      <div className="space-y-3">
        {(data || []).length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-soft dark:bg-slate-900">
            <p className="text-base font-semibold">No rooms available</p>
            <p className="mt-1 text-sm text-slate-500">Availability will appear when the allocation cycle publishes room data.</p>
          </div>
        ) : (
          (data || []).flatMap((dormitory) =>
            (dormitory.rooms || []).slice(0, 8).map((room) => (
              <motion.article
                key={`${dormitory.id}-${room.roomNumber}`}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                drag="x"
                dragConstraints={{ left: -10, right: 10 }}
                dragElastic={0.12}
                className="rounded-3xl bg-white p-4 shadow-soft transition dark:bg-slate-900"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{dormitory.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Room {room.roomNumber}</h2>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {room.availableBeds} beds left
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {room.roomType} · Floor {room.floor} · {room.pricePerMonth?.toLocaleString('vi-VN') || 0} VND/month
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const roomId = String(room.id || room._id || '');
                    if (!roomId) return;
                    if (favoriteSet.has(roomId)) {
                      removeFavoriteMutation.mutate(roomId);
                      return;
                    }
                    addFavorite.mutate(roomId);
                  }}
                  className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                    favoriteSet.has(String(room.id || room._id || ''))
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {favoriteSet.has(String(room.id || room._id || '')) ? 'Da luu' : 'Luu phong'}
                </button>
              </motion.article>
            ))
          )
        )}
      </div>
    </section>
  );
}
