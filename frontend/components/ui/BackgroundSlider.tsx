'use client'

import { useState, useEffect } from 'react'

interface BackgroundSliderProps {
  images: string[]
  duration?: number
  transitionDuration?: number
}

export function BackgroundSlider({
  images,
  duration = 6000,
  transitionDuration = 1500
}: BackgroundSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }, duration)

    return () => clearInterval(interval)
  }, [images.length, duration])

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden -z-10">
      {images.map((img, index) => (
        <div
          key={img}
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: index === currentIndex ? 1 : 0,
            transition: `opacity ${transitionDuration}ms ease-in-out`,
            zIndex: index === currentIndex ? 1 : 0
          }}
        >
          <div
            className="w-full h-full bg-cover bg-center animate-ken-burns"
            style={{
              backgroundImage: `url('${img}')`,

              animationDelay: `${index * 2}s`
            }}
          >

            <div className="absolute inset-0 bg-black/70" />
          </div>
        </div>
      ))}
    </div>
  )
}
