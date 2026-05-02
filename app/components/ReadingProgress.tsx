'use client'
import { useEffect, useRef } from 'react'

export default function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    let ticking = false
    const update = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0
      bar.style.width = `${progress * 100}%`
      bar.style.opacity = progress >= 0.99 ? '0' : '1'
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed top-16 left-0 right-0 h-[3px] z-50 pointer-events-none">
      <div
        ref={barRef}
        className="h-full w-0 bg-brand transition-opacity duration-400"
      />
    </div>
  )
}
