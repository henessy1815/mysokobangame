/**
 * 진행 상황 저장소.
 *
 * 지하철에서 앱이 갑자기 닫혀도 풀던 판이 그대로 남아 있어야 한다는 게
 * 이 게임의 핵심 요구사항이라, 클리어 기록뿐 아니라 "진행 중이던 한 판"까지
 * 통째로 localStorage에 넣는다.
 *
 * 시크릿 모드나 저장소 차단 환경에서는 읽기/쓰기가 모두 예외를 던질 수 있다.
 * 그때도 게임은 정상적으로 돌아가야 하므로 실패는 조용히 삼키고 기본값을 쓴다.
 */
import { TOTAL_LEVELS } from './levels.js'

const STORAGE_KEY = 'sokoban-cave:v1'

export const DEFAULT_SETTINGS = {
  // 대중교통에서 켜자마자 소리가 나면 곤란하므로 둘 다 기본 끔.
  sound: false,
  haptics: false,
}

export function createEmptyProgress() {
  return {
    version: 1,
    cleared: [],
    best: {},
    settings: { ...DEFAULT_SETTINGS },
    current: null,
  }
}

function readRaw() {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** 저장된 값은 사용자가 손댈 수도, 예전 버전일 수도 있으므로 형태를 일일이 확인한다. */
export function loadProgress() {
  const raw = readRaw()
  if (!raw) return createEmptyProgress()

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createEmptyProgress()
  }
  if (!parsed || typeof parsed !== 'object') return createEmptyProgress()

  const progress = createEmptyProgress()

  if (Array.isArray(parsed.cleared)) {
    progress.cleared = [...new Set(parsed.cleared)].filter(
      (id) => Number.isInteger(id) && id >= 1 && id <= TOTAL_LEVELS,
    )
  }
  if (parsed.best && typeof parsed.best === 'object') {
    for (const [id, moves] of Object.entries(parsed.best)) {
      const level = Number(id)
      if (Number.isInteger(level) && level >= 1 && level <= TOTAL_LEVELS && Number.isFinite(moves)) {
        progress.best[level] = moves
      }
    }
  }
  if (parsed.settings && typeof parsed.settings === 'object') {
    progress.settings = {
      sound: parsed.settings.sound === true,
      haptics: parsed.settings.haptics === true,
    }
  }
  if (isValidSnapshot(parsed.current)) {
    progress.current = parsed.current
  }
  return progress
}

function isValidSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false
  if (!Number.isInteger(snapshot.levelId)) return false
  if (snapshot.levelId < 1 || snapshot.levelId > TOTAL_LEVELS) return false
  if (!Number.isInteger(snapshot.player)) return false
  if (!Array.isArray(snapshot.boxes) || !snapshot.boxes.every(Number.isInteger)) return false
  if (!Array.isArray(snapshot.history)) return false
  // 사과는 나중에 들어온 기능이라 없을 수도 있다. 있다면 형태만 확인한다.
  if (snapshot.apples != null) {
    if (!Array.isArray(snapshot.apples) || !snapshot.apples.every(Number.isInteger)) return false
  }
  return true
}

/**
 * 저장된 판이 지금의 레벨 데이터와 아귀가 맞는지 확인한다.
 * 업데이트로 레벨 레이아웃이 바뀌면 옛 스냅샷은 버려야 한다.
 */
export function snapshotMatchesBoard(snapshot, board) {
  if (!snapshot) return false
  const cells = board.width * board.height
  if (snapshot.boxes.length !== board.boxes.length) return false
  if (snapshot.player < 0 || snapshot.player >= cells) return false
  if (board.walls.has(snapshot.player)) return false
  const onFloor = (index) => index >= 0 && index < cells && !board.walls.has(index)
  if (snapshot.apples && !snapshot.apples.every(onFloor)) return false
  return snapshot.boxes.every(onFloor)
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // 저장에 실패해도 플레이 자체는 계속되어야 한다.
  }
}

export function clearProgress() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 무시
  }
}

/** 클리어한 최대 단계 + 1까지 열린다. 아무것도 못 깼으면 1단계만. */
export function unlockedLevelCount(progress) {
  const highest = progress.cleared.reduce((max, id) => Math.max(max, id), 0)
  return Math.min(TOTAL_LEVELS, highest + 1)
}
