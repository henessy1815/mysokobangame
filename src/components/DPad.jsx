import { useCallback, useEffect, useRef } from 'react'

const BUTTONS = [
  { dir: 'up', label: '위로', area: 'up', path: 'M12 6 19 15H5Z' },
  { dir: 'left', label: '왼쪽으로', area: 'left', path: 'M6 12 15 5V19Z' },
  { dir: 'right', label: '오른쪽으로', area: 'right', path: 'M18 12 9 19V5Z' },
  { dir: 'down', label: '아래로', area: 'down', path: 'M12 18 5 9H19Z' },
]

const REPEAT_DELAY = 320
const REPEAT_INTERVAL = 110

/**
 * 화면 하단 방향 버튼.
 *
 * 한 손 조작을 전제로 아래쪽 가운데에 크게 배치한다. 길게 누르면 같은 방향으로
 * 연달아 움직이는데, 긴 통로를 지날 때 같은 버튼을 열 번씩 두드리지 않아도 된다.
 */
export function DPad({ onDirection, disabled }) {
  const timers = useRef({ delay: 0, interval: 0 })

  const stop = useCallback(() => {
    window.clearTimeout(timers.current.delay)
    window.clearInterval(timers.current.interval)
    timers.current = { delay: 0, interval: 0 }
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(
    (event, dir) => {
      if (disabled) return
      // 버튼을 누르는 동안 화면이 스크롤되거나 텍스트가 선택되지 않게 한다.
      event.preventDefault()
      event.currentTarget.setPointerCapture?.(event.pointerId)

      onDirection(dir)
      stop()
      timers.current.delay = window.setTimeout(() => {
        timers.current.interval = window.setInterval(() => onDirection(dir), REPEAT_INTERVAL)
      }, REPEAT_DELAY)
    },
    [disabled, onDirection, stop],
  )

  return (
    <div className="dpad" role="group" aria-label="방향 조작">
      {BUTTONS.map(({ dir, label, area, path }) => (
        <button
          key={dir}
          type="button"
          className="dpad__button"
          style={{ gridArea: area }}
          aria-label={label}
          disabled={disabled}
          onPointerDown={(event) => start(event, dir)}
          onPointerUp={stop}
          onPointerCancel={stop}
          onPointerLeave={stop}
          onContextMenu={(event) => event.preventDefault()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={path} />
          </svg>
        </button>
      ))}
      <div className="dpad__hub" aria-hidden="true" />
    </div>
  )
}
