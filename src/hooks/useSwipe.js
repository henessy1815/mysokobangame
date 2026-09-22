import { useMemo, useRef } from 'react'

/**
 * 스와이프로 방향 입력을 받는다.
 *
 * 흔들리는 버스·지하철에서 쓰는 게임이라 판정을 넉넉하게 잡았다.
 *   - 가로·세로 중 더 많이 움직인 축을 그대로 방향으로 삼는다(비스듬해도 통과).
 *   - 임계치를 넘으면 즉시 한 칸 입력하고 기준점을 그 자리로 옮긴다.
 *     손가락을 떼지 않고 계속 끌면 연달아 이동하므로 한 손으로도 조작하기 쉽다.
 *   - 손가락을 뗄 때가 아니라 끄는 도중에 반응하므로 체감 지연이 없다.
 */
export function useSwipe(onDirection, { threshold = 24, enabled = true } = {}) {
  const origin = useRef(null)
  const callback = useRef(onDirection)
  callback.current = onDirection

  return useMemo(() => {
    if (!enabled) return {}

    return {
      onPointerDown(event) {
        if (!event.isPrimary) return
        origin.current = { x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture?.(event.pointerId)
      },

      onPointerMove(event) {
        const start = origin.current
        if (!start) return

        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return

        const direction =
          Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'

        callback.current(direction)
        origin.current = { x: event.clientX, y: event.clientY }
      },

      onPointerUp(event) {
        origin.current = null
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      },

      onPointerCancel() {
        origin.current = null
      },
    }
  }, [enabled, threshold])
}
