// @ts-nocheck
"use client";
// Client-side permission hydration + gating. Permissions are cached in memory
// (and sessionStorage) so checks are instant and no repeated queries are made.
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const PermCtx = createContext({ perms: new Set(), loading: true, isSuper: false, can: () => false, refresh: () => {} });
const CACHE_KEY = "atl_perms_v1";

export function PermissionProvider({ children }) {
  const [perms, setPerms] = useState(() => {
    if (typeof window !== "undefined") { try { const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"); if (c) return new Set(c); } catch {} }
    return new Set();
  });
  const [loading, setLoading] = useState(true);
  const [isSuper, setIsSuper] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPerms(new Set()); setLoading(false); return; }
      const { data } = await supabase.rpc("my_permissions");
      const keys = (data || []).map((r) => r.key);
      const set = new Set(keys);
      setPerms(set);
      // super if they hold every permission (heuristic) — also confirm via roles
      const { data: superRole } = await supabase.from("user_roles").select("roles(is_super,status)").eq("user_id", user.id);
      setIsSuper((superRole || []).some((r) => r.roles?.is_super && r.roles?.status === "active"));
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(keys)); } catch {}
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const can = useCallback((perm) => {
    if (!perm) return true;
    if (isSuper) return true;
    if (Array.isArray(perm)) return perm.some((p) => perms.has(p));
    return perms.has(perm);
  }, [perms, isSuper]);

  const value = useMemo(() => ({ perms, loading, isSuper, can, refresh }), [perms, loading, isSuper, can, refresh]);
  return <PermCtx.Provider value={value}>{children}</PermCtx.Provider>;
}

export function usePermissions() { return useContext(PermCtx); }

// <Can permission="products.delete">…</Can>  (hides children when not permitted)
export function Can({ permission, fallback = null, children }) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(permission) ? children : fallback;
}
