import { useCallback, useEffect, useRef, useState } from 'react'
import { GameScreen } from './components/GameScreen.jsx'
import { LevelSelect } from './components/LevelSelect.jsx'
import { SettingsSheet } from './components/SettingsSheet.jsx'
import { TitleScreen } from './components/TitleScreen.jsx'
import { fetchAppleTotal, getPlayerId, saveAppleTotal } from './game/apples.js'
import { parseLevel } from './game/engine.js'
import { TOTAL_LEVELS, getLevel } from './game/levels.js'
import {
  clearProgress,
  createEmptyProgress,
  loadProgress,
  saveProgress,
  snapshotMatchesBoard,
  unlockedLevelCount,
} from './game/storage.js'

const SAVE_DEBOUNCE = 250
// 사과 총합은 네트워크를 타므로 localStorage보다 넉넉히 모았다 보낸다.
const APPLE_SAVE_DEBOUNCE = 600

export default function App() {
  const [progress, setProgress] = useState(loadProgress)
  const [screen, setScreen] = useState('title')
  const [session, setSession] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const progressRef = useRef(progress)
  progressRef.current = progress

  /*
    주운 사과의 총합.

    판 안의 `applesCollected`는 그 판에서 주운 개수라 단계를 넘기거나 다시
    시작하면 0으로 돌아간다. 그래서 "지금까지 모은 사과"는 따로 들고 있다가
    Supabase의 public.item.apple 한 행에 남긴다. 로그인이 없으므로 행을 고르는
    키는 브라우저마다 만들어 둔 player_id를 쓴다.
  */
  const playerIdRef = useRef(null)
  if (playerIdRef.current === null) playerIdRef.current = getPlayerId()

  const [appleTotal, setAppleTotal] = useState(0)
  // 서버 값을 받기 전에는 저장하지 않는다. 0을 먼저 밀어 넣으면 기록이 날아간다.
  const [applesReady, setApplesReady] = useState(false)

  const appleTotalRef = useRef(appleTotal)
  appleTotalRef.current = appleTotal
  const applesReadyRef = useRef(applesReady)
  applesReadyRef.current = applesReady

  useEffect(() => {
    let alive = true
    fetchAppleTotal(playerIdRef.current).then((remote) => {
      // null은 불러오기 실패. 그때는 저장도 막아 둔 채 화면 안에서만 센다.
      if (!alive || remote == null) return
      // 불러오는 동안 주운 사과가 있을 수 있어 더한다.
      setAppleTotal((pending) => pending + remote)
      setApplesReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!applesReady) return undefined
    const timer = window.setTimeout(
      () => saveAppleTotal(playerIdRef.current, appleTotal),
      APPLE_SAVE_DEBOUNCE,
    )
    return () => window.clearTimeout(timer)
  }, [appleTotal, applesReady])

  // 한 수마다 localStorage에 쓰면 입력이 밀리므로 잠깐 모았다 쓴다.
  useEffect(() => {
    const timer = window.setTimeout(() => saveProgress(progress), SAVE_DEBOUNCE)
    return () => window.clearTimeout(timer)
  }, [progress])

  // 앱이 백그라운드로 내려가거나 탭이 닫힐 때는 모아 둔 것을 즉시 쏟아 낸다.
  // 지하철에서 앱을 그냥 덮어 버리는 상황이 기본값에 가깝기 때문이다.
  useEffect(() => {
    const flush = () => {
      saveProgress(progressRef.current)
      if (applesReadyRef.current) saveAppleTotal(playerIdRef.current, appleTotalRef.current)
    }
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden'
      document.body.classList.toggle('is-hidden', hidden)
      if (hidden) flush()
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const unlocked = unlockedLevelCount(progress)

  /** 저장된 판이 지금 시작하려는 단계의 것이고 아직 유효하면 이어서 시작한다. */
  const startLevel = useCallback((levelId) => {
    const level = getLevel(levelId)
    if (!level) return

    const saved = progressRef.current.current
    let snapshot = null
    if (saved && saved.levelId === levelId) {
      const board = parseLevel(level.layout)
      if (snapshotMatchesBoard(saved, board)) snapshot = saved
    }

    setSession({ levelId, snapshot })
    setScreen('game')
  }, [])

  const handleSnapshot = useCallback((snapshot) => {
    setProgress((previous) => ({ ...previous, current: snapshot }))
  }, [])

  const handleCleared = useCallback((levelId, moves) => {
    setProgress((previous) => {
      const cleared = previous.cleared.includes(levelId)
        ? previous.cleared
        : [...previous.cleared, levelId].sort((a, b) => a - b)

      const previousBest = previous.best[levelId]
      const best =
        previousBest == null || moves < previousBest
          ? { ...previous.best, [levelId]: moves }
          : previous.best

      // 깬 판은 더 이상 "진행 중"이 아니다. 이어하기가 클리어된 판을 열지 않게 비운다.
      return { ...previous, cleared, best, current: null }
    })
  }, [])

  // 사과를 주우면 +1, 되돌리기로 무르면 -1. 총합은 여기서만 움직인다.
  const handleAppleDelta = useCallback((delta) => {
    setAppleTotal((previous) => Math.max(0, previous + delta))
  }, [])

  const handleSettingsChange = useCallback((settings) => {
    setProgress((previous) => ({ ...previous, settings }))
  }, [])

  const handleResetProgress = useCallback(() => {
    clearProgress()
    setProgress(createEmptyProgress())
    // 모아 둔 사과도 진행의 일부이므로 함께 비우고 서버에도 바로 반영한다.
    setAppleTotal(0)
    if (applesReadyRef.current) saveAppleTotal(playerIdRef.current, 0)
    setSession(null)
    setScreen('title')
    setShowSettings(false)
  }, [])

  const activeLevel = session ? getLevel(session.levelId) : null
  const resumeLevel = progress.current?.levelId ?? null

  return (
    <div className="app" data-chapter={activeLevel?.chapter ?? 1}>
      {screen === 'title' ? (
        <TitleScreen
          progress={progress}
          resumeLevel={resumeLevel}
          onResume={() => startLevel(resumeLevel)}
          onSelect={() => setScreen('select')}
          onSettings={() => setShowSettings(true)}
        />
      ) : null}

      {screen === 'select' ? (
        <LevelSelect
          progress={progress}
          unlocked={unlocked}
          onSelect={startLevel}
          onBack={() => setScreen('title')}
        />
      ) : null}

      {screen === 'game' && activeLevel ? (
        <GameScreen
          key={activeLevel.id}
          level={activeLevel}
          snapshot={session.snapshot}
          settings={progress.settings}
          appleTotal={appleTotal}
          best={progress.best[activeLevel.id] ?? null}
          hasNext={activeLevel.id < TOTAL_LEVELS}
          onSnapshot={handleSnapshot}
          onCleared={handleCleared}
          onAppleDelta={handleAppleDelta}
          onNext={() => startLevel(activeLevel.id + 1)}
          onExit={() => setScreen('select')}
        />
      ) : null}

      {showSettings ? (
        <SettingsSheet
          settings={progress.settings}
          onChange={handleSettingsChange}
          onResetProgress={handleResetProgress}
          onClose={() => setShowSettings(false)}
        />
      ) : null}
    </div>
  )
}
