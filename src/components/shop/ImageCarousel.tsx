"use client";

import { useState } from "react";

type ImageCarouselProps = {
  images: string[];
};

export default function ImageCarousel({ images }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const goTo = (index: number) => {
    if (index < 0) setCurrent(images.length - 1);
    else if (index >= images.length) setCurrent(0);
    else setCurrent(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) goTo(current + 1);
    if (touchStart - touchEnd < -75) goTo(current - 1);
  };

  return (
    <div className="relative aspect-square rounded-t-[2rem] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}>
      {/* Images */}
      <div className="flex transition-transform duration-300 ease-out h-full"
        style={{ transform: `translateX(-${current * 100}%)` }}>
        {images.map((img, i) => (
          <img key={i} src={img} className="w-full h-full object-cover flex-shrink-0" alt={`Image ${i + 1}`} loading="lazy" />
        ))}
      </div>
      
      {/* Arrow buttons */}
      {images.length > 1 && (
        <>
          <button onClick={() => goTo(current - 1)} 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-600 hover:bg-white shadow-lg z-10">
            <i className="fas fa-chevron-left text-xs"></i>
          </button>
          <button onClick={() => goTo(current + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-600 hover:bg-white shadow-lg z-10">
            <i className="fas fa-chevron-right text-xs"></i>
          </button>
        </>
      )}
      
      {/* Dots indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-4" : "bg-white/50 hover:bg-white/70"}`} />
          ))}
        </div>
      )}
      
      {/* Image counter */}
      <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[9px] font-bold px-2 py-1 rounded-full z-10">
        {current + 1} / {images.length}
      </div>
    </div>
  );
}