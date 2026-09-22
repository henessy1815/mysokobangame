import { useEffect, useRef } from 'react'

const DIRECTION_KEYS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right',
}

/**
 * 데스크톱 키보드 조작. 방향키/WASD로 이동, Z로 되돌리기, R로 재시작, Esc로 나가기.
 *
 * 입력 폼이 떠 있을 때는 가로채지 않는다. 설정 화면의 토글을 스페이스로
 * 조작하는 것 같은 평범한 동작을 게임이 뺏어 가면 안 되기 때문이다.
 */
export function useKeyboardControls(handlers, enabled = true) {
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    if (!enabled) return undefined

    function onKeyDown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      const direction = DIRECTION_KEYS[event.key]
      if (direction) {
        event.preventDefault()
        latest.current.onDirection?.(direction)
        return
      }

      switch (event.key) {
        case 'z':
        case 'Z':
          event.preventDefault()
          latest.current.onUndo?.()
          break
        case 'r':
        case 'R':
          event.preventDefault()
          latest.current.onRestart?.()
          break
        case 'Escape':
          latest.current.onBack?.()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
