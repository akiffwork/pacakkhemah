"use client";

import ImageCarousel from "./ImageCarousel";
import type {
  GearItem,
  GearVariant,
  CartItem,
  LinkedVariantSelection,
  LinkedItemData,
} from "./types";

type ItemDetailModalProps = {
  // State from parent
  selectedItem: GearItem;
  selectedVariant: GearVariant | null;
  linkedVarSelections: Record<string, GearVariant | null>;
  cart: CartItem[];

  // Actions
  onClose: () => void;
  onShare: (item: GearItem) => void;
  onSelectVariant: (variant: GearVariant | null) => void;
  onSelectLinkedVariant: (itemId: string, variant: GearVariant | null) => void;

  // Helper functions (kept in parent so they stay in sync with cart/avail state)
  getAvailableStock: (itemId: string, variantId?: string) => number;
  getEffectiveInCart: (itemId: string, variantId?: string) => number;
  getLinkedItemsData: (item: GearItem) => LinkedItemData[];
  getCartKey: (item: CartItem) => string;
  updateCartQty: (key: string, delta: number) => void;
  addToCart: (
    item: GearItem,
    variant?: GearVariant,
    keepOpen?: boolean,
    linkedVars?: LinkedVariantSelection[]
  ) => void;
};

export default function ItemDetailModal({
  selectedItem,
  selectedVariant,
  linkedVarSelections,
  cart,
  onClose,
  onShare,
  onSelectVariant,
  onSelectLinkedVariant,
  getAvailableStock,
  getEffectiveInCart,
  getLinkedItemsData,
  getCartKey,
  updateCartQty,
  addToCart,
}: ItemDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-[#062c24]/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="relative">
          {(selectedItem.images?.length || 0) > 1 ? (
            <ImageCarousel images={selectedItem.images!} />
          ) : (
            <img src={selectedItem.images?.[0] || selectedItem.img || "/placeholder.jpg"} className="w-full aspect-square object-cover rounded-t-[2rem]" alt={selectedItem.name} />
          )}
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 shadow-lg z-20">
            <i className="fas fa-times"></i>
          </button>
          <button onClick={() => onShare(selectedItem)} className="absolute top-4 right-16 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-400 hover:text-[#062c24] shadow-lg z-20">
            <i className="fas fa-share-alt"></i>
          </button>
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-20">
            {selectedItem.type === "package" && <span className="bg-purple-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-lg"><i className="fas fa-box mr-1"></i>Package</span>}
            {selectedItem.setup?.available && <span className="bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-lg"><i className="fas fa-tools mr-1"></i>Setup Available</span>}
          </div>
        </div>
        <div className="p-6">
          <h3 className="text-lg font-black uppercase text-[#062c24] mb-1">{selectedItem.name}</h3>
          <p className="text-emerald-600 font-black text-xl mb-3">
            RM {selectedVariant ? selectedVariant.price : selectedItem.price}
            <span className="text-xs text-slate-400 font-bold">/night</span>
            {selectedVariant && (
              <span className="text-xs font-bold text-slate-400 ml-2">
                ({[selectedVariant.color?.label, selectedVariant.size].filter(Boolean).join(", ")})
              </span>
            )}
          </p>
          {selectedItem.desc && <p className="text-slate-500 text-sm mb-4 leading-relaxed">{selectedItem.desc}</p>}

          {/* Variant Selector */}
          {selectedItem.hasVariants && selectedItem.variants && selectedItem.variants.length > 0 && (() => {
            const colors = [...new Map(selectedItem.variants!.filter(v => v.color?.label).map(v => [v.color!.label, v.color!])).values()];
            const sizes = [...new Set(selectedItem.variants!.filter(v => v.size).map(v => v.size!))];
            const selectedColor = selectedVariant?.color?.label || null;
            const selectedSize = selectedVariant?.size || null;

            function pickVariant(color: string | null, size: string | null) {
              const match = selectedItem!.variants!.find(v =>
                (!color || v.color?.label === color) &&
                (!size || v.size === size)
              );
              onSelectVariant(match || null);
            }

            return (
              <div className="mb-4 space-y-3">
                {/* Color swatches */}
                {colors.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                      Colour {selectedColor && <span className="text-[#062c24] normal-case">— {selectedColor}</span>}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {colors.map(c => {
                        const isActive = selectedColor === c.label;
                        const variantForColor = selectedItem!.variants!.find(v => v.color?.label === c.label && (!selectedSize || v.size === selectedSize));
                        const outOfStock = variantForColor ? (getAvailableStock(selectedItem!.id, variantForColor.id) - getEffectiveInCart(selectedItem!.id, variantForColor.id)) <= 0 : false;
                        return (
                          <button
                            key={c.label}
                            onClick={() => pickVariant(c.label, selectedSize)}
                            className={`relative w-9 h-9 rounded-full border-2 transition-all ${
                              isActive ? "border-[#062c24] scale-110 shadow-md" : "border-slate-200 hover:border-slate-400"
                            } ${outOfStock ? "opacity-40" : ""}`}
                            style={{ backgroundColor: c.hex }}
                            title={c.label}
                          >
                            {isActive && <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] drop-shadow"><i className="fas fa-check"></i></span>}
                            {outOfStock && <span className="absolute inset-0 flex items-center justify-center"><span className="w-full h-0.5 bg-red-500 rotate-45 absolute"></span></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Size pills */}
                {sizes.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                      Size {selectedSize && <span className="text-[#062c24] normal-case">— {selectedSize}</span>}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {sizes.map(s => {
                        const isActive = selectedSize === s;
                        const variantForSize = selectedItem!.variants!.find(v => v.size === s && (!selectedColor || v.color?.label === selectedColor));
                        const outOfStock = variantForSize ? (getAvailableStock(selectedItem!.id, variantForSize.id) - getEffectiveInCart(selectedItem!.id, variantForSize.id)) <= 0 : false;
                        return (
                          <button
                            key={s}
                            onClick={() => pickVariant(selectedColor, s)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${
                              isActive ? "border-[#062c24] bg-[#062c24] text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"
                            } ${outOfStock ? "opacity-40 line-through" : ""}`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Stock indicator */}
                {selectedVariant && (
                  <p className="text-[10px] font-bold text-slate-400">
                    <i className="fas fa-box mr-1"></i>
                    {Math.max(0, getAvailableStock(selectedItem!.id, selectedVariant.id) - getEffectiveInCart(selectedItem!.id, selectedVariant.id))} available
                  </p>
                )}
              </div>
            );
          })()}
          {/* Specs Grid */}
          {selectedItem.specs && (selectedItem.specs.maxPax || selectedItem.specs.size || selectedItem.specs.puRating || selectedItem.specs.layers || selectedItem.specs.weight || selectedItem.specs.tentType) && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {selectedItem.specs.tentType ? (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center shrink-0"><i className="fas fa-campground text-[9px]"></i></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">Tent Type</p><p className="text-xs font-black text-[#062c24]">{selectedItem.specs.tentType}</p></div>
                </div>
              ) : null}
              {selectedItem.specs.maxPax ? (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0"><i className="fas fa-users text-[9px]"></i></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">Max Pax</p><p className="text-xs font-black text-[#062c24]">{selectedItem.specs.maxPax} person</p></div>
                </div>
              ) : null}
              {selectedItem.specs.size ? (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0"><i className="fas fa-ruler-combined text-[9px]"></i></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">Size</p><p className="text-xs font-black text-[#062c24]">{selectedItem.specs.size}</p></div>
                </div>
              ) : null}
              {selectedItem.specs.puRating ? (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0"><i className="fas fa-tint text-[9px]"></i></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">PU Rating</p><p className="text-xs font-black text-[#062c24]">{selectedItem.specs.puRating}</p></div>
                </div>
              ) : null}
              {selectedItem.specs.layers ? (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center shrink-0"><i className="fas fa-layer-group text-[9px]"></i></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">Layer</p><p className="text-xs font-black text-[#062c24]">{selectedItem.specs.layers}</p></div>
                </div>
              ) : null}
              {selectedItem.specs.weight ? (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2.5 col-span-2">
                  <div className="w-7 h-7 bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center shrink-0"><i className="fas fa-weight-hanging text-[9px]"></i></div>
                  <div><p className="text-[8px] font-bold text-slate-400 uppercase">Weight</p><p className="text-xs font-black text-[#062c24]">{selectedItem.specs.weight}</p></div>
                </div>
              ) : null}
            </div>
          )}
          {selectedItem.setup?.available && (
            <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-[9px] font-black text-blue-600 uppercase mb-1"><i className="fas fa-tools mr-1"></i>Setup Service Available</p>
              <p className="text-xs text-blue-700 font-bold">+RM {selectedItem.setup.fee}</p>
              {selectedItem.setup.description && <p className="text-[10px] text-blue-600 mt-1">{selectedItem.setup.description}</p>}
            </div>
          )}
          {selectedItem.pickupLocation && (
            <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2.5">
              <div className="w-7 h-7 bg-emerald-200 text-emerald-700 rounded-lg flex items-center justify-center shrink-0"><i className="fas fa-map-marker-alt text-[9px]"></i></div>
              <div>
                <p className="text-[8px] font-bold text-emerald-500 uppercase">Pickup Location</p>
                <p className="text-xs font-black text-emerald-800">{selectedItem.pickupLocation}</p>
              </div>
            </div>
          )}
          {(() => {
            const linkedItems = getLinkedItemsData(selectedItem);
            if (linkedItems.length === 0) return null;
            return (
              <div className="mb-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-[9px] font-black text-purple-600 uppercase mb-2"><i className="fas fa-link mr-1"></i>Package Includes:</p>
                <div className="space-y-3">
                  {linkedItems.map(({ item: linkedItem, qty, lockedVariantId, lockedVariantLabel, lockedVariantColor }) => {
                    const hasVars = linkedItem.hasVariants && linkedItem.variants && linkedItem.variants.length > 0;
                    const isLocked = !!lockedVariantId;
                    const lockedVariant = isLocked ? linkedItem.variants?.find(v => v.id === lockedVariantId) : null;

                    // Customer picker state (only used when NOT locked)
                    const selected = !isLocked ? (linkedVarSelections[linkedItem.id] || null) : null;
                    const colors = hasVars && !isLocked ? [...new Map(linkedItem.variants!.filter(v => v.color?.label).map(v => [v.color!.label, v.color!])).values()] : [];
                    const sizes = hasVars && !isLocked ? [...new Set(linkedItem.variants!.filter(v => v.size).map(v => v.size!))] : [];
                    const selectedColor = selected?.color?.label || null;
                    const selectedSize = selected?.size || null;

                    function pickLinkedVariant(color: string | null, size: string | null) {
                      const match = linkedItem.variants!.find(v =>
                        (!color || v.color?.label === color) && (!size || v.size === size)
                      );
                      onSelectLinkedVariant(linkedItem.id, match || null);
                    }

                    const displayPrice = lockedVariant?.price || selected?.price || linkedItem.price;

                    return (
                      <div key={linkedItem.id} className="bg-white rounded-lg p-2.5 border border-purple-100">
                        <div className="flex items-center gap-2 mb-1">
                          <img src={linkedItem.images?.[0] || linkedItem.img || "/placeholder.jpg"} className="w-9 h-9 rounded-lg object-cover shrink-0" alt={linkedItem.name} loading="lazy" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-purple-700 truncate">{linkedItem.name}</p>
                            <p className="text-[9px] text-purple-500">Qty: {qty} • RM {displayPrice}/night</p>
                          </div>
                          {/* Status badge */}
                          {isLocked && (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded shrink-0">
                              {lockedVariantColor && <span className="w-2.5 h-2.5 rounded-full border border-teal-200 shrink-0" style={{ backgroundColor: lockedVariantColor }}></span>}
                              {lockedVariantLabel}
                            </span>
                          )}
                          {hasVars && !isLocked && selected && (
                            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">✓</span>
                          )}
                          {hasVars && !isLocked && !selected && (
                            <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">Pick</span>
                          )}
                        </div>
                        {/* Customer variant picker — only when NOT locked by vendor */}
                        {hasVars && !isLocked && (
                          <div className="mt-2 space-y-2 pl-11">
                            {colors.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap">
                                {colors.map(c => {
                                  const isActive = selectedColor === c.label;
                                  return (
                                    <button key={c.label} onClick={() => pickLinkedVariant(c.label, selectedSize)}
                                      className={`w-6 h-6 rounded-full border-2 transition-all ${isActive ? "border-purple-600 scale-110 shadow" : "border-slate-200"}`}
                                      style={{ backgroundColor: c.hex }} title={c.label}
                                    >
                                      {isActive && <span className="flex items-center justify-center text-white text-[7px] drop-shadow"><i className="fas fa-check"></i></span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {sizes.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {sizes.map(s => (
                                  <button key={s} onClick={() => pickLinkedVariant(selectedColor, s)}
                                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border transition-all ${
                                      selectedSize === s ? "border-purple-600 bg-purple-600 text-white" : "border-slate-200 text-slate-500"
                                    }`}>
                                    {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {selectedItem.inc && selectedItem.inc.length > 0 && (
            <div className="mb-6 p-3 bg-slate-50 rounded-xl">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Also Includes:</p>
              <div className="flex flex-wrap gap-1.5">{selectedItem.inc.map(inc => (<span key={inc} className="bg-white border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase">{inc}</span>))}</div>
            </div>
          )}
          {(() => {
            const hasVars = selectedItem.hasVariants && selectedItem.variants && selectedItem.variants.length > 0;
            const needsVariant = hasVars && !selectedVariant;

            // Check if package linked items need variant selections
            const linkedItems = getLinkedItemsData(selectedItem);
            // Only items with variants AND no vendor-locked variant need customer picks
            const unlockedItemsWithVars = linkedItems.filter(({ item: li, lockedVariantId }) => !lockedVariantId && li.hasVariants && li.variants && li.variants.length > 0);
            const allUnlockedPicked = unlockedItemsWithVars.every(({ item: li }) => linkedVarSelections[li.id]);
            const needsLinkedVars = unlockedItemsWithVars.length > 0 && !allUnlockedPicked;
            const unPickedCount = unlockedItemsWithVars.filter(({ item: li }) => !linkedVarSelections[li.id]).length;

            const vid = selectedVariant?.id;
            const cartKey = vid ? `${selectedItem.id}__${vid}` : selectedItem.id;

            const displayQty = cart.find(i => getCartKey(i) === cartKey)?.qty || 0;
            const effectiveVariantInCart = vid ? getEffectiveInCart(selectedItem.id, vid) : getEffectiveInCart(selectedItem.id);
            const totalItemInCart = getEffectiveInCart(selectedItem.id);
            const variantAvail = vid ? getAvailableStock(selectedItem.id, vid) : getAvailableStock(selectedItem.id);
            const totalAvail = getAvailableStock(selectedItem.id);
            const canAdd = !needsVariant && !needsLinkedVars && (effectiveVariantInCart < variantAvail) && (totalItemInCart < totalAvail);

            // Build linkedVariants for cart — merge vendor-locked + customer-picked
            const linkedVarsForCart: LinkedVariantSelection[] = [];
            for (const { item: li, lockedVariantId, lockedVariantLabel, lockedVariantColor } of linkedItems) {
              if (lockedVariantId && lockedVariantLabel) {
                // Vendor-locked
                linkedVarsForCart.push({ itemId: li.id, variantId: lockedVariantId, variantLabel: lockedVariantLabel, variantColor: lockedVariantColor });
              } else if (linkedVarSelections[li.id]) {
                // Customer-picked
                const v = linkedVarSelections[li.id]!;
                linkedVarsForCart.push({ itemId: li.id, variantId: v.id, variantLabel: [v.color?.label, v.size].filter(Boolean).join(", "), variantColor: v.color?.hex });
              }
            }

            const btnLabel = needsVariant ? "Select a Variant"
              : needsLinkedVars ? `Select variant for ${unPickedCount} item(s)`
              : canAdd ? "Add to Cart" : variantAvail === 0 ? "Sold Out" : "Max Added";

            return displayQty > 0 && !needsVariant && !needsLinkedVars ? (
              <div className="flex items-center gap-2">
                <button onClick={() => updateCartQty(cartKey, -1)}
                  className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-lg font-black transition-colors">
                  {displayQty === 1 ? <i className="fas fa-trash text-sm"></i> : "−"}
                </button>
                <span className="flex-1 text-center text-lg font-black text-[#062c24]">{displayQty}</span>
                <button onClick={() => canAdd && addToCart(selectedItem, selectedVariant || undefined, true, linkedVarsForCart.length > 0 ? linkedVarsForCart : undefined)} disabled={!canAdd}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black transition-colors ${canAdd ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}>
                  +
                </button>
              </div>
            ) : (
              <button onClick={() => canAdd && addToCart(selectedItem, selectedVariant || undefined, true, linkedVarsForCart.length > 0 ? linkedVarsForCart : undefined)} disabled={!canAdd}
                className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${canAdd ? "bg-[#062c24] text-white hover:bg-emerald-800 active:scale-95" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                {btnLabel}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}