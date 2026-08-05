import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../contexts/store";
import { subscriptionService } from "../services/SubscriptionService";
import { isAdmin } from "../utils/roles";
import { subscriptionAllowsAppAccess } from "../utils/subscriptions";

export function useSubscription() {
  const user = useAuthStore((s) => s.user);
  const admin = isAdmin(user);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(Boolean(user?.id && !admin));

  const refresh = useCallback(async () => {
    if (!user?.id || admin) {
      setSubscription(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const sub = await subscriptionService.getForUser(user.id);
      setSubscription(sub);
      return sub;
    } finally {
      setLoading(false);
    }
  }, [user?.id, admin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const allowsAccess = admin || subscriptionAllowsAppAccess(user, subscription);

  return {
    subscription,
    loading,
    allowsAccess,
    isAdmin: admin,
    refresh,
  };
}
