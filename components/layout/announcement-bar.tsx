"use client";

import { useState, useEffect } from "react";
import { Truck, Zap, Gift } from "lucide-react";

const messages = [
  { icon: Truck, text: "FREE SHIPPING ON ORDERS OVER $100", iconColor: "#7fb0ff" },
  { icon: Zap, text: "FLASH DEALS EVERY DAY — DON'T MISS OUT", iconColor: "#ff9b3d" },
  { icon: Gift, text: "NEW MEMBERS GET $10 OFF — CODE: WELCOME10", iconColor: "#5fd08a" },
];

export function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % messages.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const { icon: Icon, text, iconColor } = messages[index];

  return (
    <div className="bg-[#0a0b0d] text-[#e9ecf1]">
      <div className="max-w-[1240px] mx-auto flex items-center justify-center gap-[7px] h-[40px] px-4 text-[12.5px] font-semibold tracking-[.03em] transition-opacity duration-300">
        <Icon className="shrink-0" style={{ color: iconColor, width: 15, height: 15 }} />
        <span className="whitespace-nowrap">{text}</span>
      </div>
    </div>
  );
}
