"use client";

import { useState, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";

const categories = [
  { label: "Sneakers", count: 124 },
  { label: "Running", count: 89 },
  { label: "Basketball", count: 56 },
  { label: "Lifestyle", count: 201 },
  { label: "Skateboarding", count: 34 },
  { label: "Training", count: 67 },
];

const brands = [
  { label: "Nike", count: 156 },
  { label: "Adidas", count: 134 },
  { label: "Jordan", count: 89 },
  { label: "New Balance", count: 67 },
  { label: "Puma", count: 45 },
  { label: "Converse", count: 38 },
];

const sizes = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13"];

const colors = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#ffffff" },
  { name: "Red", hex: "#ef4444" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Green", hex: "#16a34a" },
  { name: "Yellow", hex: "#f59e0b" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Gray", hex: "#6b7280" },
];

type FilterSection = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function FilterAccordion({ title, children, defaultOpen = true }: FilterSection) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#eef0f3] py-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left cursor-pointer"
      >
        <span className="text-[14px] font-bold text-[#16181d]">{title}</span>
        <ChevronDown className={cn("w-[18px] h-[18px] text-[#9aa3ad] transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function FilterContent({
  selectedCategories,
  setSelectedCategories,
  selectedBrands,
  setSelectedBrands,
  selectedSizes,
  setSelectedSizes,
  selectedColors,
  setSelectedColors,
  priceRange,
  setPriceRange,
}: {
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  selectedBrands: string[];
  setSelectedBrands: (v: string[]) => void;
  selectedSizes: string[];
  setSelectedSizes: (v: string[]) => void;
  selectedColors: string[];
  setSelectedColors: (v: string[]) => void;
  priceRange: [number, number];
  setPriceRange: (v: [number, number]) => void;
}) {
  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  return (
    <>
      <FilterAccordion title="Category">
        <div className="space-y-2.5">
          {categories.map((c) => (
            <label key={c.label} className="flex items-center gap-[10px] cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedCategories.includes(c.label)}
                onChange={() => setSelectedCategories(toggleArray(selectedCategories, c.label))}
                className="w-[20px] h-[20px] rounded-[6px] border-[1.5px] border-[#e4e7eb] accent-[#2563eb] cursor-pointer"
              />
              <span className="text-[13px] text-[#5b6472] group-hover:text-[#16181d] transition-colors flex-1">{c.label}</span>
              <span className="text-[12px] text-[#9aa3ad]">{c.count}</span>
            </label>
          ))}
        </div>
      </FilterAccordion>

      <FilterAccordion title="Brand">
        <div className="space-y-2.5">
          {brands.map((b) => (
            <label key={b.label} className="flex items-center gap-[10px] cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedBrands.includes(b.label)}
                onChange={() => setSelectedBrands(toggleArray(selectedBrands, b.label))}
                className="w-[20px] h-[20px] rounded-[6px] border-[1.5px] border-[#e4e7eb] accent-[#2563eb] cursor-pointer"
              />
              <span className="text-[13px] text-[#5b6472] group-hover:text-[#16181d] transition-colors flex-1">{b.label}</span>
              <span className="text-[12px] text-[#9aa3ad]">{b.count}</span>
            </label>
          ))}
        </div>
      </FilterAccordion>

      <FilterAccordion title="Price Range">
        <div className="space-y-3">
          <input
            type="range"
            min={0}
            max={500}
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="w-full h-[5px] rounded-full appearance-none bg-[#eef0f3] accent-[#2563eb] cursor-pointer"
          />
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-[8px] border border-[#e4e7eb] px-3 py-2 text-[13px] text-[#16181d]">
              ${priceRange[0]}
            </div>
            <span className="text-[12px] text-[#9aa3ad]">to</span>
            <div className="flex-1 rounded-[8px] border border-[#e4e7eb] px-3 py-2 text-[13px] text-[#16181d]">
              ${priceRange[1]}
            </div>
          </div>
        </div>
      </FilterAccordion>

      <FilterAccordion title="Size">
        <div className="grid grid-cols-4 gap-[6px]">
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedSizes(toggleArray(selectedSizes, s))}
              className={cn(
                "h-[38px] rounded-[8px] border text-[13px] font-semibold transition-all duration-150 cursor-pointer",
                selectedSizes.includes(s)
                  ? "border-[#2563eb] bg-[#2563eb] text-white"
                  : "border-[#e4e7eb] text-[#5b6472] hover:border-[#2563eb] hover:text-[#2563eb]"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </FilterAccordion>

      <FilterAccordion title="Color">
        <div className="flex flex-wrap gap-[8px]">
          {colors.map((c) => (
            <button
              key={c.name}
              type="button"
              title={c.name}
              onClick={() => setSelectedColors(toggleArray(selectedColors, c.name))}
              className={cn(
                "w-[30px] h-[30px] rounded-full border-2 transition-all duration-150 cursor-pointer",
                selectedColors.includes(c.name)
                  ? "border-[#2563eb] scale-110"
                  : "border-[#e4e7eb] hover:scale-105"
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </FilterAccordion>
    </>
  );
}

export type ActiveFilters = {
  brands: string[];
  categories: string[];
  sizes: string[];
  colors: string[];
  priceRange: [number, number];
};

type FiltersSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  onFiltersChange?: (filters: ActiveFilters) => void;
};

export function FiltersSidebar({ mobileOpen, onMobileClose, onFiltersChange }: FiltersSidebarProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);

  const activeCount = selectedCategories.length + selectedBrands.length + selectedSizes.length + selectedColors.length;

  const clearAll = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setPriceRange([0, 500]);
  };

  useEffect(() => {
    onFiltersChange?.({
      brands: selectedBrands,
      categories: selectedCategories,
      sizes: selectedSizes,
      colors: selectedColors,
      priceRange,
    });
  }, [selectedBrands, selectedCategories, selectedSizes, selectedColors, priceRange, onFiltersChange]);

  const filterProps = {
    selectedCategories, setSelectedCategories,
    selectedBrands, setSelectedBrands,
    selectedSizes, setSelectedSizes,
    selectedColors, setSelectedColors,
    priceRange, setPriceRange,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0">
        <div className="bg-white border border-[#eef0f3] rounded-[16px] p-5 sticky top-[140px]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[16px] font-extrabold text-[#16181d]">Filters</h3>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-[12px] text-[#2563eb] font-semibold cursor-pointer hover:underline">
                Clear all ({activeCount})
              </button>
            )}
          </div>
          <FilterContent {...filterProps} />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer open={mobileOpen} onClose={onMobileClose} side="left" title="Filters">
        <div className="flex items-center justify-between mb-2">
          {activeCount > 0 && (
            <button onClick={clearAll} className="text-[12px] text-[#2563eb] font-semibold cursor-pointer hover:underline">
              Clear all ({activeCount})
            </button>
          )}
        </div>
        <FilterContent {...filterProps} />
        <div className="sticky bottom-0 pt-4 pb-2 bg-white border-t border-[#eef0f3] mt-4">
          <button
            onClick={onMobileClose}
            className="w-full h-[48px] bg-[#2563eb] text-white font-bold text-[14px] rounded-[13px] cursor-pointer hover:brightness-105 active:scale-[.98] transition-all duration-150"
          >
            Show Results
          </button>
        </div>
      </Drawer>
    </>
  );
}
