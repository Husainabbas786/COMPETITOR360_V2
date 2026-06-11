import { useEffect, useRef, useState } from 'react'

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// Count-up number. Animates from its previous value to the new one whenever
// `value` changes (e.g. the visa stepper / term selector moves). Dependency-free
// rAF tween — the project ships no animation library. Respects reduced-motion.
export default function AnimatedNumber({ value = 0, prefix = '', className = '' }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      fromRef.current = to
      setDisplay(to)
      return
    }

    const start = performance.now()
    const dur = 420
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
        setDisplay(to)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return (
    <span className={`num ${className}`}>
      {prefix}
      {fmt.format(Math.round(display))}
    </span>
  )
}
