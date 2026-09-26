import React from "react";
import { Category, MenuItem } from "./TableTypes";
import { triggerHaptic, getCategoryIcon } from "./tableUtils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  items: MenuItem[];
  selectedCat: string;
  onSelectCategory: (catId: string) => void;
};

export default function TableCategorySheet({
  isOpen,
  onClose,
  categories,
  items,
  selectedCat,
  onSelectCategory,
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-xs bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[75vh] p-5 rounded-t-3xl flex flex-col justify-between overflow-y-auto shadow-2xl border-t-2 animate-slide-up bg-white"
        style={{ borderColor: "var(--hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-3" />

          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-heading text-xl font-bold text-stone-900">
                Menu Categories
              </h3>
              <p className="text-xs text-stone-500">
                {categories.length} categories · {items.length} total dishes
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-stone-200"
            >
              ✕
            </button>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-2 gap-2.5 my-4">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                onSelectCategory("all");
                onClose();
              }}
              className={`p-3 rounded-2xl border flex items-center justify-between text-left cursor-pointer transition-all active:scale-95 ${
                selectedCat === "all"
                  ? "bg-amber-100 border-amber-500 text-amber-900 font-bold shadow-xs"
                  : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🍽️</span>
                <span className="text-xs">All Dishes</span>
              </div>
              <span className="font-mono text-xs opacity-75">({items.length})</span>
            </button>

            {categories.map((cat) => {
              const count = items.filter((i) => i.category_id === cat.id).length;
              const icon = getCategoryIcon(cat.name);
              const isSelected = selectedCat === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    onSelectCategory(cat.id);
                    onClose();
                  }}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-left cursor-pointer transition-all active:scale-95 ${
                    isSelected
                      ? "bg-amber-100 border-amber-500 text-amber-900 font-bold shadow-xs"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-1">
                    <span className="text-xl flex-shrink-0">{icon}</span>
                    <span className="text-xs truncate">{cat.name}</span>
                  </div>
                  <span className="font-mono text-xs opacity-75 flex-shrink-0">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 cursor-pointer hover:bg-stone-50"
        >
          Close Menu
        </button>
      </div>
    </div>
  );
}
