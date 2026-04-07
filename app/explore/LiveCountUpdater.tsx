"use client";

import { useEffect, useState } from "react";

export function LiveCountUpdater({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // Fetch and update count every 30 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/explore/stats');
        const data = await response.json();
        if (data.totalActive !== undefined) {
          setCount(data.totalActive);
        }
      } catch (err) {
        console.error('Failed to fetch live count:', err);
        // silently fail, keep showing previous count
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return <>{count.toLocaleString()} active bids</>;
}
