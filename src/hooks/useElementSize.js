import { useLayoutEffect, useRef, useState } from 'react'

/**
 * 요소의 실제 크기를 재서 돌려준다.
 *
 * 퍼즐 격자는 화면에 딱 맞게 줄었다 늘었다 해야 하는데, CSS의 aspect-ratio와
 * max-height를 같이 쓰면 브라우저마다 결과가 갈린다. 칸 크기를 직접 계산해
 * px로 내려 주는 편이 결과가 확실하고, 스프라이트 배치도 같은 단위를 쓸 수 있다.
 */
export function useElementSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined

    const measure = () => {
      const rect = element.getBoundingClientRect()
      setSize((previous) =>
        Math.abs(previous.width - rect.width) < 0.5 && Math.abs(previous.height - rect.height) < 0.5
          ? previous
          : { width: rect.width, height: rect.height },
      )
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}
