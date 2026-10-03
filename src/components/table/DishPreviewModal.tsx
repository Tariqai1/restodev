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
  const [currentImgIdx, setCurrentImgIdx] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);

  // 100% Lock body scroll when preview modal is open
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  if (!dish) return null;

  const spice = getSpiciness(dish.name, dish.description);
  const qtyInCart = cartItem?.qty || 0;

  const gallery = (dish.images && dish.images.length > 0)
    ? dish.images
    : (dish.photo_url ? [dish.photo_url] : []);
  const currentImg = gallery[currentImgIdx] || dish.photo_url;
  const hasMultiple = gallery.length > 1;

  // Touch Swipe Gesture Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current !== null && touchStartY.current !== null) {
      const diffX = touchStartX.current - e.touches[0].clientX;
      const diffY = touchStartY.current - e.touches[0].clientY;
      if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal gesture in progress
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
      if (diffX > 0) {
        // Swiped Left -> Next image
        setCurrentImgIdx((prev) => (prev < gallery.length - 1 ? prev + 1 : 0));
      } else {
        // Swiped Right -> Previous image
        setCurrentImgIdx((prev) => (prev > 0 ? prev - 1 : gallery.length - 1));
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overscroll-contain select-none"
      onClick={onClose}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden bg-white shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Image Container with Touch Swipe Gesture */}
        <div
          className="relative w-full h-56 sm:h-64 bg-stone-900 flex-shrink-0 select-none overflow-hidden touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {currentImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentImg}
              alt={dish.name}
              className="w-full h-full object-cover transition-all duration-300 pointer-events-none"
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
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center font-bold text-sm cursor-pointer shadow-md hover:bg-black/90 transition-transform active:scale-90 z-20"
            title="Close preview"
          >
            ✕
          </button>

          {/* Dietary Pill */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xs text-white text-[11px] font-bold z-10">
            <span className={dish.is_veg ? "veg-indicator" : "nonveg-indicator"} />
            <span>{dish.is_veg ? "Vegetarian" : "Non-Veg"}</span>
          </div>

          {/* Carousel Controls (Tap buttons + Visual indicators) */}
          {hasMultiple && (
            <>
              {/* Prev Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImgIdx((prev) => (prev > 0 ? prev - 1 : gallery.length - 1));
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/75 hover:bg-black/95 text-white flex items-center justify-center text-xs cursor-pointer shadow-lg active:scale-90 z-20 border border-white/20"
                aria-label="Previous photo"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>

              {/* Next Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImgIdx((prev) => (prev < gallery.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/75 hover:bg-black/95 text-white flex items-center justify-center text-xs cursor-pointer shadow-lg active:scale-90 z-20 border border-white/20"
                aria-label="Next photo"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>

              {/* Counter Badge */}
              <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-xs text-[10px] font-mono text-white font-bold z-10 flex items-center gap-1 shadow-sm">
                <i className="fa-solid fa-camera text-[9px]" />
                <span>{currentImgIdx + 1} / {gallery.length}</span>
              </div>

              {/* Dot Indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                {gallery.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImgIdx(idx);
                    }}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentImgIdx ? "w-5 bg-white shadow-sm" : "w-1.5 bg-white/50 hover:bg-white/80"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
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
