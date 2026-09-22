/**
 * 레벨 검증 스크립트 — `npm run validate:levels`
 *
 * PRD 출시 체크리스트의 "1~10단계 전부 클리어 가능 검증"을 자동화한다.
 * 레벨마다 다음 네 가지를 확인한다.
 *   1) 구조: 상자/목표 개수 일치, 플레이어 존재, 바깥으로 새지 않는 벽, 도달 가능한 배치
 *   2) 해답 존재: solver.js의 다익스트라 탐색으로 최소 이동 수를 구한다
 *   3) 리플레이: 찾아낸 해답을 engine.js의 규칙으로 되돌려 실행해 실제로 클리어되는지 확인
 *      (탐색기와 게임 엔진이 서로를 교차 검증하게 만드는 장치다)
 *   4) levels.js의 par 값이 실제 최소 이동 수와 같은지 대조
 *
 * `--paths` 옵션을 주면 각 레벨의 최단 해답 시퀀스를 함께 출력한다.
 */
import process from 'node:process'
import {
  DIRECTION_KEYS,
  MOVE_RESULT,
  createInitialState,
  isSolved,
  move,
  parseLevel,
  step,
} from '../src/game/engine.js'
import { solve } from '../src/game/solver.js'
import { LEVELS } from '../src/game/levels.js'

/** 플레이어가 벽 밖으로 빠져나갈 수 있으면 레벨 데이터가 잘못된 것이다. */
function scanReachable(board) {
  const { width, height, walls } = board
  const seen = new Set([board.player])
  const queue = [board.player]
  let sealed = true

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]
    const r = Math.floor(current / width)
    const c = current % width
    if (r === 0 || c === 0 || r === height - 1 || c === width - 1) sealed = false

    for (const dir of DIRECTION_KEYS) {
      const next = step(current, dir, width, height)
      if (next < 0 || walls.has(next) || seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return { sealed, reachable: seen }
}

/** 탐색기가 내놓은 방향 시퀀스를 게임 엔진 규칙으로 그대로 재생한다. */
function replay(board, path) {
  let state = createInitialState(board)
  for (const [i, dir] of path.entries()) {
    const outcome = move(board, state, dir)
    if (outcome.result === MOVE_RESULT.BLOCKED) {
      return { ok: false, reason: `${i + 1}번째 수(${dir})가 규칙상 불가능합니다.` }
    }
    state = outcome.state
  }
  if (!isSolved(board, state)) return { ok: false, reason: '해답을 모두 실행했지만 클리어되지 않았습니다.' }
  if (state.moves !== path.length) return { ok: false, reason: '이동 수 집계가 어긋납니다.' }
  return { ok: true, state }
}

const rows = []
const problems = []

for (const level of LEVELS) {
  const label = `${String(level.id).padStart(2, ' ')}. ${level.title}`

  let board
  try {
    board = parseLevel(level.layout)
  } catch (error) {
    problems.push(`${label} — 구조 오류: ${error.message}`)
    continue
  }

  const { sealed, reachable } = scanReachable(board)
  if (!sealed) {
    problems.push(`${label} — 벽이 열려 있어 플레이어가 보드 밖으로 나갈 수 있습니다.`)
    continue
  }

  const unreachable = [...board.goals, ...board.boxes].filter((cell) => !reachable.has(cell))
  if (unreachable.length > 0) {
    problems.push(`${label} — 플레이어가 닿을 수 없는 상자/목표가 있습니다: ${unreachable.join(', ')}`)
    continue
  }

  const started = Date.now()
  const result = solve(board)
  const elapsed = Date.now() - started

  if (!result.solved) {
    problems.push(`${label} — 클리어 불가: ${result.reason}`)
    continue
  }

  const check = replay(board, result.path)
  if (!check.ok) {
    problems.push(`${label} — 리플레이 실패: ${check.reason}`)
    continue
  }

  const parMatches = level.par === result.moves
  if (!parMatches) problems.push(`${label} — levels.js의 par=${level.par}, 실제 최소 이동=${result.moves}`)

  rows.push({
    label,
    boxes: board.boxes.length,
    size: `${board.width}x${board.height}`,
    moves: result.moves,
    pushes: result.pushes,
    declared: level.par,
    parMatches,
    explored: result.explored,
    elapsed,
    path: result.path,
  })
}

const pad = (text, width) => {
  // 한글은 터미널에서 두 칸을 차지하므로 표시 폭을 따로 센다.
  const visual = [...String(text)].reduce((sum, ch) => sum + (/[\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7AF]/.test(ch) ? 2 : 1), 0)
  return String(text) + ' '.repeat(Math.max(1, width - visual))
}

console.log('\n레벨 검증 결과')
console.log('─'.repeat(72))
console.log(pad('단계', 26) + pad('상자', 6) + pad('크기', 8) + pad('최소이동', 10) + pad('밀기', 6) + pad('탐색', 10) + '시간')
console.log('─'.repeat(72))
for (const row of rows) {
  console.log(
    pad(row.label, 26) +
      pad(row.boxes, 6) +
      pad(row.size, 8) +
      pad(`${row.moves}${row.parMatches ? '' : ` (par ${row.declared} !!)`}`, 10) +
      pad(row.pushes, 6) +
      pad(row.explored.toLocaleString(), 10) +
      `${row.elapsed}ms`,
  )
}
console.log('─'.repeat(72))

if (process.argv.includes('--paths')) {
  const letters = { up: 'U', down: 'D', left: 'L', right: 'R' }
  console.log('\n최단 해답 시퀀스 (U/D/L/R)')
  for (const row of rows) {
    console.log(`  ${row.label}\n    ${row.path.map((d) => letters[d]).join('')}`)
  }
}

if (problems.length > 0) {
  console.error('\n문제 발견')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('\n모든 레벨이 클리어 가능하며 par 값이 일치합니다.')
