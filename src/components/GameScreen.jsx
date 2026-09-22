import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Board } from './Board.jsx'
import { ClearOverlay } from './ClearOverlay.jsx'
import { DPad } from './DPad.jsx'
import { AppleSprite } from './Sprites.jsx'
import { createFeedback } from '../game/audio.js'
import { useElementSize } from '../hooks/useElementSize.js'
import { useKeyboardControls } from '../hooks/useKeyboardControls.js'
import { useSokoban, toSnapshot } from '../hooks/useSokoban.js'
import { useSwipe } from '../hooks/useSwipe.js'

/** 마지막 상자가 목표에 얹히는 연출을 볼 시간. 이만큼 뒤에 결과 화면이 뜬다. */
const CLEAR_DELAY = 700
const MIN_CELL = 16
const MAX_CELL = 84

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function GameScreen({
  level,
  snapshot,
  settings,
  appleTotal,
  best,
  hasNext,
  onSnapshot,
  onCleared,
  onAppleDelta,
  onNext,
  onExit,
}) {
  const {
    board,
    game,
    facing,
    solved,
    event,
    boxesOnGoal,
    applesCollected,
    canUndo,
    moveTo,
    undoMove,
    restart,
  } = useSokoban(level, snapshot)

  const [areaRef, areaSize] = useElementSize()
  const boardRef = useRef(null)
  const [result, setResult] = useState(null)
  const [showHint, setShowHint] = useState(level.id <= 2)

  const feedback = useMemo(() => createFeedback(settings), [settings])

  // 격자를 화면에 맞춘다. 정수 픽셀로 떨어뜨려야 타일 경계가 흐려지지 않는다.
  const cell = useMemo(() => {
    if (!areaSize.width || !areaSize.height) return 0
    const fitted = Math.min(areaSize.width / board.width, areaSize.height / board.height)
    return Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(fitted)))
  }, [areaSize, board.width, board.height])

  // 한 수 둘 때마다 상위로 넘겨 저장한다. 앱이 갑자기 닫혀도 판이 남아야 한다.
  useEffect(() => {
    onSnapshot(toSnapshot(level.id, game))
  }, [game, level.id, onSnapshot])

  /*
    사과 총합은 상위(App)가 들고 Supabase에 저장한다. 이 화면은 "방금 하나
    늘었다 / 되돌리기로 무르고 하나 줄었다"는 변화량만 올려 보낸다.

    기준값을 판이 시작될 때의 값으로 잡아 두는 게 중요하다. 이어하기로 들어온
    판의 사과는 주울 때 이미 총합에 들어갔으므로, 화면이 다시 켜졌다고 해서
    또 더하면 안 된다.
  */
  const lastApplesRef = useRef(applesCollected)
  useEffect(() => {
    const delta = applesCollected - lastApplesRef.current
    lastApplesRef.current = applesCollected
    if (delta !== 0) onAppleDelta(delta)
  }, [applesCollected, onAppleDelta])

  // 소리·진동·흔들림 같은 일회성 피드백. event.id가 바뀔 때만 한 번씩 돈다.
  useEffect(() => {
    switch (event.type) {
      case 'step':
        feedback.step()
        break
      case 'push':
        feedback.push()
        if (event.landedOnGoal) feedback.goal()
        break
      case 'blocked':
        feedback.blocked()
        shakeBoard(boardRef.current, event.dir)
        break
      case 'undo':
        feedback.undo()
        break
      default:
        break
    }

    // 사과는 걸어가다 줍든 상자를 밀다 줍든 똑같이 울려야 해서 이동 종류와 따로 본다.
    if (event.pickedApple) feedback.apple()
    else if (event.droppedApple) feedback.appleDrop()
  }, [event, feedback])

  // 클리어 처리. 진행 저장은 즉시 하고, 결과 화면만 연출만큼 늦춘다.
  //
  // 타이머 핸들을 ref에 두는 이유: onCleared로 상위 진행 상황이 갱신되면 best prop이
  // 따라 바뀌면서 이 이펙트가 다시 도는데, 정리 함수에서 타이머를 없애 버리면 결과
  // 화면이 영영 뜨지 않는다. 정리는 화면을 떠날 때 한 번만 한다.
  const clearedRef = useRef(false)
  const clearTimerRef = useRef(0)
  useEffect(() => () => window.clearTimeout(clearTimerRef.current), [])

  useEffect(() => {
    if (!solved || clearedRef.current) return
    clearedRef.current = true

    const moves = game.moves
    const isNewRecord = best == null || moves < best
    feedback.clear()
    onCleared(level.id, moves)

    clearTimerRef.current = window.setTimeout(() => setResult({ moves, isNewRecord }), CLEAR_DELAY)
  }, [solved, game.moves, best, feedback, level.id, onCleared])

  const handleRestart = useCallback(() => {
    // 재시작은 판만 되돌리는 것이지 모아 둔 사과를 빼앗는 게 아니다.
    // 기준값을 함께 0으로 맞춰 총합이 깎이지 않게 한다.
    lastApplesRef.current = 0
    window.clearTimeout(clearTimerRef.current)
    clearedRef.current = false
    setResult(null)
    restart()
  }, [restart])

  const swipeHandlers = useSwipe(moveTo, { enabled: !result })

  useKeyboardControls(
    { onDirection: moveTo, onUndo: undoMove, onRestart: handleRestart, onBack: onExit },
    !result,
  )

  return (
    <section className="screen screen--game" data-chapter={level.chapter}>
      <header className="game-header">
        <button type="button" className="icon-button" onClick={onExit} aria-label="단계 선택으로">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>

        {/* 단계 번호는 자간 벌린 라벨이 아니라 나무판에 찍힌 낙인으로 붙인다. */}
        <div className="level-brand" aria-hidden="true">
          {level.id}
        </div>

        <div className="game-header__title">
          <h1>
            <span className="sr-only">{level.id}단계 </span>
            {level.title}
          </h1>
        </div>

        <button
          type="button"
          className={`icon-button${showHint ? ' is-active' : ''}`}
          onClick={() => setShowHint((open) => !open)}
          aria-pressed={showHint}
          aria-label="힌트 보기"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.5 18h5M10 21h4M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1-1 1.7h-5.2c-.1-.7-.4-1.2-1-1.7A6 6 0 0 1 12 3Z" />
          </svg>
        </button>
      </header>

      {/*
        계기판. 판 중에 계속 변하는 값만 판 위에 올린다.
        상자 진행은 숫자를 나눠 읽는 대신 궤짝 표식과 같은 마름모로 세게 한다.
      */}
      <div className="game-plate">
        <p className="game-plate__moves">
          {game.moves}
          <span>이동</span>
        </p>

        <span
          className={`game-plate__apple${event.pickedApple ? ' is-bumped' : ''}`}
          key={`apples-${appleTotal}`}
        >
          <span aria-hidden="true">
            <AppleSprite />
          </span>
          {appleTotal}
          <span className="sr-only">개 모은 사과</span>
        </span>

        <span
          className="game-plate__pips"
          role="img"
          aria-label={`상자 ${game.boxes.length}개 중 ${boxesOnGoal}개 올림`}
        >
          {game.boxes.map((_, index) => (
            <i key={index} className={index < boxesOnGoal ? 'is-set' : undefined} />
          ))}
        </span>
      </div>

      {/* 판 중에 바뀌지 않는 값이라 계기판 밖에 둔다. */}
      <p className="game-best">최고 기록 {best ?? '—'}</p>

      {showHint ? <p className="game-hint">{level.hint}</p> : null}

      <div className="board-area" ref={areaRef} {...swipeHandlers}>
        {cell > 0 ? (
          <Board
            board={board}
            game={game}
            event={event}
            facing={facing}
            cell={cell}
            solved={solved}
            boardRef={boardRef}
          />
        ) : null}
      </div>

      <footer className="game-controls">
        <button
          type="button"
          className="button button--control"
          onClick={undoMove}
          disabled={!canUndo}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 7 4 12l5 5M4 12h9a6 6 0 0 1 0 12h-1" />
          </svg>
          되돌리기
        </button>

        <DPad onDirection={moveTo} disabled={Boolean(result)} />

        <button type="button" className="button button--control" onClick={handleRestart}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" />
          </svg>
          다시하기
        </button>
      </footer>

      {result ? (
        <ClearOverlay
          level={level}
          moves={result.moves}
          best={best}
          isNewRecord={result.isNewRecord}
          hasNext={hasNext}
          onNext={onNext}
          onRetry={handleRestart}
          onSelect={onExit}
        />
      ) : null}
    </section>
  )
}

/** 벽에 막혔을 때 격자를 그 방향으로 살짝 밀었다 놓는다. */
function shakeBoard(element, direction) {
  if (!element?.animate || prefersReducedMotion()) return

  const axis = direction === 'left' || direction === 'right' ? 'X' : 'Y'
  const sign = direction === 'right' || direction === 'down' ? 1 : -1

  element.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: `translate${axis}(${sign * 6}px)` },
      { transform: `translate${axis}(${sign * -3}px)` },
      { transform: 'translate(0, 0)' },
    ],
    { duration: 170, easing: 'ease-out' },
  )
}
