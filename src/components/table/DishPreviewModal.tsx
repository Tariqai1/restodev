import React from "react";
import { MenuItem, RestaurantFeatures, CartItem } from "./TableTypes";
import { getFoodEmoji, getSpiciness } from "./tableUtils";

type Props = {
  dish: MenuItem | null;
  onClose: () => void;
  features: RestaurantFeatures;
  cartItem?: CartItem;
  onAddToCart: (dishId: string, e?: React.MouseEvent<any> | React.TouchEvent<any>) => void;
  onRemoveFromCart: (dishId: string) => void;
  onSetNotes?: (dishId: string, notes: string) => void;
};

export default function DishPreviewModal({
  dish,
  onClose,
  features,
  cartItem,
  onAddToCart,
  onRemoveFromCart,
  onSetNotes,
}: Props) {
  if (!dish) return null;

  const spice = getSpiciness(dish.name, dish.description);
  const qtyInCart = cartItem?.qty || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden bg-white shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Image Container */}
        <div className="relative w-full h-56 bg-stone-900 flex-shrink-0">
          {dish.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dish.photo_url}
              alt={dish.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl bg-amber-50">
              {getFoodEmoji(dish.name, dish.is_veg)}
            </div>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center font-bold text-sm cursor-pointer shadow-md hover:bg-black/80 transition-colors"
            title="Close preview"
          >
            ✕
          </button>

          {/* Dietary Pill */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold">
            <span className={dish.is_veg ? "veg-indicator" : "nonveg-indicator"} />
            <span>{dish.is_veg ? "Vegetarian" : "Non-Veg"}</span>
          </div>
        </div>

        {/* Dish Info Content */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-heading text-xl font-bold text-stone-900">
                  {dish.name}
                </h3>

                {spice === "spicy" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-0.5">
                    <span>🌶️🌶️</span>
                    <span>Hot & Spicy</span>
                  </span>
                )}
                {spice === "mild" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-0.5">
                    <span>🟢</span>
                    <span>Mild & Gentle</span>
                  </span>
                )}
                {spice === "medium" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5">
                    <span>🌶️</span>
                    <span>Medium Spice</span>
                  </span>
                )}

                {dish.is_bestseller && (
                  <span className="shimmer-badge text-[10px] font-black px-2.5 py-0.5 rounded-full text-stone-900 uppercase tracking-wider shadow-xs inline-flex items-center gap-0.5">
                    <span>★</span>
                    <span>Chef's Bestseller</span>
                  </span>
                )}
              </div>
              <div className="font-receipt text-lg font-extrabold text-stone-900 pt-1">
                ₹{dish.price}
                <span className="text-xs font-normal text-stone-500 ml-1">+ 5% GST</span>
              </div>
            </div>
          </div>

          {dish.description && (
            <p className="text-xs leading-relaxed text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
              {dish.description}
            </p>
          )}
        </div>

        {/* Modal Bottom CTA */}
        <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between gap-3">
          {qtyInCart === 0 ? (
            <button
              type="button"
              onClick={(e) => onAddToCart(dish.id, e)}
              className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: "var(--rust)",
                color: "var(--rust-text)",
              }}
            >
              <span>+ ADD TO ORDER</span>
              <span>·</span>
              <span>₹{dish.price}</span>
            </button>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Quantity in cart:</span>
              <div
                className="flex items-center rounded-xl border shadow-xs overflow-hidden bg-white"
                style={{ borderColor: "var(--rust)" }}
              >
                <button
                  type="button"
                  onClick={() => onRemoveFromCart(dish.id)}
                  className="w-9 h-9 flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-stone-100 transition-colors"
                  style={{ color: "var(--rust)" }}
                >
                  -
                </button>
                <span className="font-receipt text-sm font-black px-3 min-w-[24px] text-center text-stone-900">
                  {qtyInCart}
                </span>
                <button
                  type="button"
                  onClick={(e) => onAddToCart(dish.id, e)}
                  className="w-9 h-9 flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-stone-100 transition-colors"
                  style={{ color: "var(--rust)" }}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
