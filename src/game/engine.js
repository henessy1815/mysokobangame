/**
 * 소코반 규칙 엔진.
 *
 * 순수 함수만 모아 둔 모듈이다. React에 의존하지 않으므로 Node에서 그대로
 * 불러와 레벨 검증 스크립트(scripts/validate-levels.mjs)에서도 재사용한다.
 *
 * 좌표는 `index = row * width + col` 형태의 정수 하나로 다룬다.
 * 비교/집합 연산이 값 비교 한 번으로 끝나기 때문에 탐색 성능과 코드 양 모두에서 유리하다.
 */

/** XSB 표준 문자 정의 */
export const TILE = {
  WALL: '#',
  FLOOR: ' ',
  GOAL: '.',
  BOX: '$',
  BOX_ON_GOAL: '*',
  PLAYER: '@',
  PLAYER_ON_GOAL: '+',
}

export const DIRECTIONS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
}

export const DIRECTION_KEYS = ['up', 'down', 'left', 'right']

/**
 * XSB 문자열을 게임 보드로 변환한다.
 * 줄마다 길이가 달라도 되도록 가장 긴 줄 기준으로 폭을 맞추고 모자란 칸은 벽으로 채운다.
 */
export function parseLevel(layout) {
  const rows = layout.split('\n').filter((line) => line.length > 0)
  const height = rows.length
  const width = Math.max(...rows.map((line) => line.length))

  const walls = new Set()
  const goals = new Set()
  const floors = new Set()
  const boxes = []
  let player = -1

  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const char = rows[r][c] ?? TILE.WALL
      const index = r * width + c

      if (char === TILE.WALL) {
        walls.add(index)
        continue
      }
      floors.add(index)

      if (char === TILE.GOAL || char === TILE.BOX_ON_GOAL || char === TILE.PLAYER_ON_GOAL) {
        goals.add(index)
      }
      if (char === TILE.BOX || char === TILE.BOX_ON_GOAL) {
        boxes.push(index)
      }
      if (char === TILE.PLAYER || char === TILE.PLAYER_ON_GOAL) {
        player = index
      }
    }
  }

  if (player < 0) throw new Error('레벨에 플레이어(@)가 없습니다.')
  if (boxes.length === 0) throw new Error('레벨에 상자($)가 없습니다.')
  if (boxes.length !== goals.size) {
    throw new Error(`상자(${boxes.length})와 목표 지점(${goals.size}) 개수가 다릅니다.`)
  }

  return { width, height, walls, goals, floors, boxes, player }
}

export const toRow = (index, width) => Math.floor(index / width)
export const toCol = (index, width) => index % width

/** 방향으로 한 칸 이동한 인덱스. 보드 밖으로 나가면 -1. */
export function step(index, dir, width, height) {
  const { dr, dc } = DIRECTIONS[dir]
  const r = Math.floor(index / width) + dr
  const c = (index % width) + dc
  if (r < 0 || c < 0 || r >= height || c >= width) return -1
  return r * width + c
}

/**
 * 게임 시작 상태. `boxes`의 배열 순서는 상자의 고유 ID 역할을 하며
 * 밀려도 순서가 유지된다. React가 같은 key로 같은 DOM을 재사용해야
 * transform 트랜지션이 끊기지 않기 때문이다.
 */
export function createInitialState(board) {
  return {
    player: board.player,
    boxes: [...board.boxes],
    apples: [],
    applesCollected: 0,
    moves: 0,
    pushes: 0,
    history: [],
  }
}

/** 한 번 이동할 때마다 사과가 떨어질 확률. */
export const APPLE_DROP_CHANCE = 0.1

/**
 * 사과가 떨어질 만한 빈 칸을 하나 고른다. 없으면 -1.
 *
 * 플레이어가 방금 선 칸은 제외한다. 떨어지자마자 주워지면 "떨어졌다"는 연출을
 * 볼 새가 없고, 되돌리기 기록도 한 수에 줍기와 떨어뜨리기가 겹쳐 지저분해진다.
 * 상자가 있는 칸과 목표 지점도 비운다. 상자 밑에 깔린 사과는 보이지 않고,
 * 목표 지점 위에 얹히면 퍼즐의 핵심 표시를 사과가 가려 버리기 때문이다.
 */
export function findAppleSpot(board, state, rng) {
  const candidates = []
  for (const index of board.floors) {
    if (index === state.player) continue
    if (board.goals.has(index)) continue
    if (state.boxes.includes(index)) continue
    if (state.apples.includes(index)) continue
    candidates.push(index)
  }
  if (candidates.length === 0) return -1
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))]
}

/** 되돌리기 기록 상한. 너무 길어지면 localStorage 용량만 먹는다. */
export const MAX_HISTORY = 400

export const MOVE_RESULT = {
  MOVED: 'moved',
  PUSHED: 'pushed',
  BLOCKED: 'blocked',
}

/**
 * 한 칸 이동을 시도한다. 상태는 절대 변형하지 않고 새 객체를 돌려준다.
 *
 * `rng`를 넘기면 사과 규칙이 함께 돈다. 기본값이 없는 이유는 이 모듈을
 * 레벨 검증 스크립트와 해답 탐색이 그대로 가져다 쓰기 때문이다. 그쪽은
 * 같은 입력이면 같은 결과가 나와야 하므로 난수가 끼어들면 안 된다.
 *
 * @param {() => number} [options.rng] 0 이상 1 미만 난수. 넘기면 사과가 떨어진다.
 * @returns {{ state, result, movedBoxIndex, pickedApple, spawnedApple }} 사과 값은 칸 번호이며 없으면 -1.
 */
export function move(board, state, dir, options = {}) {
  const { width, height, walls } = board
  const { rng } = options
  const target = step(state.player, dir, width, height)

  if (target < 0 || walls.has(target)) {
    return { state, result: MOVE_RESULT.BLOCKED, movedBoxIndex: -1, pickedApple: -1, spawnedApple: -1 }
  }

  const boxIndex = state.boxes.indexOf(target)
  let boxes = state.boxes
  let pushes = state.pushes

  if (boxIndex >= 0) {
    // 상자 밀기: 상자 너머 칸이 비어 있어야 한다(벽도 다른 상자도 안 된다).
    const beyond = step(target, dir, width, height)
    if (beyond < 0 || walls.has(beyond) || state.boxes.includes(beyond)) {
      return { state, result: MOVE_RESULT.BLOCKED, movedBoxIndex: -1, pickedApple: -1, spawnedApple: -1 }
    }
    boxes = [...state.boxes]
    boxes[boxIndex] = beyond
    pushes += 1
  }

  // 도착 칸에 사과가 있으면 줍는다.
  const apples = state.apples ?? []
  const pickedApple = apples.includes(target) ? target : -1
  let nextApples = pickedApple >= 0 ? apples.filter((apple) => apple !== target) : apples

  // 이동이 성사된 뒤에만 사과가 떨어진다. 벽에 막힌 수는 이동으로 치지 않는다.
  let spawnedApple = -1
  if (rng && rng() < APPLE_DROP_CHANCE) {
    spawnedApple = findAppleSpot(board, { player: target, boxes, apples: nextApples }, rng)
    if (spawnedApple >= 0) nextApples = [...nextApples, spawnedApple]
  }

  return {
    state: {
      ...state,
      player: target,
      boxes,
      apples: nextApples,
      applesCollected: (state.applesCollected ?? 0) + (pickedApple >= 0 ? 1 : 0),
      moves: state.moves + 1,
      pushes,
      history: pushHistory(state.history, {
        dir,
        boxIndex,
        picked: pickedApple,
        spawned: spawnedApple,
      }),
    },
    result: boxIndex >= 0 ? MOVE_RESULT.PUSHED : MOVE_RESULT.MOVED,
    movedBoxIndex: boxIndex,
    pickedApple,
    spawnedApple,
  }
}

function pushHistory(history, entry) {
  const next = [...history, entry]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

/**
 * 직전 한 수를 취소한다. 기록이 없으면 원본 상태를 그대로 돌려준다.
 * 이동 수는 늘리지 않고 되돌린다. 되돌리기를 눌렀는데 카운터가 올라가면
 * 플레이어가 손해 본 것처럼 느끼고, 결국 재시작을 택하게 되기 때문이다.
 */
export function undo(board, state) {
  if (state.history.length === 0) return state

  const { width, height } = board
  const entry = state.history[state.history.length - 1]
  const previousPlayer = step(state.player, OPPOSITE[entry.dir], width, height)

  const boxes = [...state.boxes]
  if (entry.boxIndex >= 0) {
    // 밀었던 상자를 플레이어가 서 있는 칸(= 밀기 직전 상자 위치)으로 되돌린다.
    boxes[entry.boxIndex] = state.player
  }

  // 사과도 그 수 이전으로 돌린다. 떨어진 것은 거두고, 주웠던 것은 제자리에.
  let apples = state.apples ?? []
  if (entry.spawned >= 0) apples = apples.filter((apple) => apple !== entry.spawned)
  if (entry.picked >= 0) apples = [...apples, entry.picked]

  return {
    player: previousPlayer,
    boxes,
    apples,
    applesCollected: Math.max(0, (state.applesCollected ?? 0) - (entry.picked >= 0 ? 1 : 0)),
    moves: Math.max(0, state.moves - 1),
    pushes: entry.boxIndex >= 0 ? Math.max(0, state.pushes - 1) : state.pushes,
    history: state.history.slice(0, -1),
  }
}

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }

/** 모든 상자가 목표 지점 위에 있으면 클리어. */
export function isSolved(board, state) {
  return state.boxes.every((box) => board.goals.has(box))
}

export function countBoxesOnGoal(board, state) {
  return state.boxes.reduce((sum, box) => sum + (board.goals.has(box) ? 1 : 0), 0)
}
