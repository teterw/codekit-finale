'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DirectMessagesPage from '@/components/DirectMessagesPage';

export default function Page() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('userId');
    if (!id) {
      router.replace('/');
      return;
    }
    setUserId(Number(id));
  }, [router]);

  if (!userId) return null;
  return <DirectMessagesPage userId={userId} />;
}
