"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type SocialNetwork = {
  id: string;
  name: string;
  logo_url: string | null;
  url: string;
  display_order: number;
};

export function SocialFollowSection() {
  const [items, setItems] = useState<SocialNetwork[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sb = createClient();
    (async () => {
      const { data } = await sb
        .from("social_networks")
        .select("id, name, logo_url, url, display_order")
        .eq("is_active", true)
        .order("display_order");
      setItems((data || []) as SocialNetwork[]);
      setLoaded(true);
    })();
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="w-full">
      <div className="max-w-[1240px] mx-auto px-4">
        <div className="rounded-[20px] bg-gradient-to-br from-[#f4f7fd] to-white border border-[#eaeef4] px-6 py-10 sm:px-10 sm:py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#16181d]">
            FOLLOW ATLANTA <span className="text-[#2f6bff]">SNEAKERS</span>
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#6b7280]">
            Stay connected with us
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-2 w-[84px] sm:w-[96px]"
              >
                <span className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border border-[#eaeef4] shadow-sm overflow-hidden transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-md group-hover:border-[#2f6bff]/40">
                  {item.logo_url ? (
                    <Image
                      src={item.logo_url}
                      alt={item.name}
                      width={32}
                      height={32}
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <span className="text-[11px] font-semibold text-[#8a929c]">
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium text-[#16181d] truncate max-w-full">
                  {item.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
