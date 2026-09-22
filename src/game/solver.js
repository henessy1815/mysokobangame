/**
 * 소코반 최적해 탐색기.
 *
 * 앱 번들에는 들어가지 않는다(런타임 코드가 import하지 않음). 레벨 검증
 * 스크립트가 "이 레벨이 정말 풀리는가 / 최소 몇 수인가"를 확인하는 데 쓴다.
 *
 * 이동 한 칸 단위로 너비 우선 탐색을 하면 상태가 순식간에 수천만 개로 불어난다.
 * 대신 "밀기"만 간선으로 삼는 그래프에서 A*를 돌린다.
 *   - 정점: (상자 배치, 플레이어 위치)
 *   - 간선: 상자 하나를 한 칸 미는 행위
 *   - 가중치: 밀기 직전 칸까지 걸어가는 최단 거리 + 밀기 1수
 * 밀기 사이의 걸음은 상자 배치를 바꾸지 않으므로 언제나 최단 경로로 바꿔칠 수 있다.
 * 따라서 이 그래프의 최단 경로가 곧 실제 최소 이동 수(move-optimal)와 일치한다.
 *
 * 가지치기는 세 가지를 쓴다.
 *   - 사장 칸: 어떤 목표로도 밀어 보낼 수 없는 칸. 그쪽으로 미는 수는 버린다.
 *   - 2x2 교착: 방금 민 상자가 벽/상자와 2x2 덩어리를 이루면 되돌릴 수 없다.
 *   - 휴리스틱: 상자별 최소 밀기 거리의 합. 실제 비용을 넘지 않아 A*의 최적성이 유지된다.
 */
import { DIRECTION_KEYS, step } from './engine.js'

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }

/**
 * 목표 칸에서 상자를 거꾸로 당기며 너비 우선 탐색을 해, 각 칸에서 그 목표까지
 * 필요한 최소 밀기 수를 구한다. 다른 상자는 무시하므로 언제나 실제 비용 이하다.
 */
function pullDistances(board, goal) {
  const { width, height, walls } = board
  const dist = new Int32Array(width * height).fill(-1)
  dist[goal] = 0
  const queue = [goal]

  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head]
    for (const dir of DIRECTION_KEYS) {
      // cell로 오기 직전의 상자 자리와, 그때 플레이어가 서 있어야 하는 칸
      const previous = step(cell, OPPOSITE[dir], width, height)
      if (previous < 0 || walls.has(previous) || dist[previous] !== -1) continue
      const standing = step(previous, OPPOSITE[dir], width, height)
      if (standing < 0 || walls.has(standing)) continue
      dist[previous] = dist[cell] + 1
      queue.push(previous)
    }
  }
  return dist
}

/** 목표별 거리표와, 어떤 목표에도 닿을 수 없는 사장 칸 집합을 미리 계산한다. */
function analyze(board) {
  const tables = [...board.goals].map((goal) => pullDistances(board, goal))
  const dead = new Set()
  for (const cell of board.floors) {
    if (tables.every((table) => table[cell] === -1)) dead.add(cell)
  }
  return { tables, dead }
}

/** 상자마다 가장 가까운 목표까지의 밀기 거리 합. 실제 이동 수의 하한이다. */
function heuristic(tables, boxes) {
  let total = 0
  for (const box of boxes) {
    let best = Infinity
    for (const table of tables) {
      const distance = table[box]
      if (distance >= 0 && distance < best) best = distance
    }
    if (best === Infinity) return Infinity
    total += best
  }
  return total
}

/** 플레이어가 상자를 통과하지 않고 갈 수 있는 칸까지의 걸음 수. 못 가면 -1. */
function walkDistances(board, boxSet, from) {
  const { width, height, walls } = board
  const dist = new Int32Array(width * height).fill(-1)
  dist[from] = 0
  const queue = [from]

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]
    for (const dir of DIRECTION_KEYS) {
      const next = step(current, dir, width, height)
      if (next < 0 || dist[next] !== -1) continue
      if (walls.has(next) || boxSet.has(next)) continue
      dist[next] = dist[current] + 1
      queue.push(next)
    }
  }
  return dist
}

/**
 * 방금 민 상자가 벽이나 다른 상자와 함께 2x2 덩어리를 이루는지 본다.
 * 그런 덩어리는 어느 칸도 다시 움직일 수 없으므로, 그 안에 목표 밖 상자가
 * 하나라도 있으면 그 가지는 영원히 풀리지 않는다.
 */
function formsFrozenSquare(board, boxSet, cell) {
  const { width, height, walls, goals } = board
  const occupied = (index) => index >= 0 && (walls.has(index) || boxSet.has(index))
  const quadrants = [
    ['up', 'left'],
    ['up', 'right'],
    ['down', 'left'],
    ['down', 'right'],
  ]

  for (const [vertical, horizontal] of quadrants) {
    const side = step(cell, vertical, width, height)
    const other = step(cell, horizontal, width, height)
    if (!occupied(side) || !occupied(other)) continue
    const diagonal = step(side, horizontal, width, height)
    if (!occupied(diagonal)) continue

    const corners = [cell, side, other, diagonal]
    if (corners.some((index) => boxSet.has(index) && !goals.has(index))) return true
  }
  return false
}

class MinHeap {
  constructor() {
    this.items = []
  }

  get size() {
    return this.items.length
  }

  push(priority, value) {
    const items = this.items
    items.push({ priority, value })
    let index = items.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (items[parent].priority <= items[index].priority) break
      const swap = items[parent]
      items[parent] = items[index]
      items[index] = swap
      index = parent
    }
  }

  pop() {
    const items = this.items
    const top = items[0]
    const last = items.pop()
    if (items.length > 0) {
      items[0] = last
      let index = 0
      for (;;) {
        const left = index * 2 + 1
        const right = left + 1
        let smallest = index
        if (left < items.length && items[left].priority < items[smallest].priority) smallest = left
        if (right < items.length && items[right].priority < items[smallest].priority) smallest = right
        if (smallest === index) break
        const swap = items[smallest]
        items[smallest] = items[index]
        items[index] = swap
        index = smallest
      }
    }
    return top
  }
}

function keyOf(player, boxes) {
  return player + '|' + boxes.join(',')
}

/**
 * @returns {{ solved: boolean, moves?: number, pushes?: number, path?: string[], explored: number, reason?: string }}
 */
export function solve(board, options = {}) {
  const stateLimit = options.stateLimit ?? 3_000_000
  const { width, height, walls, goals } = board
  const { tables, dead } = analyze(board)

  const startBoxes = [...board.boxes].sort((a, b) => a - b)
  const allOnGoal = (boxes) => boxes.every((box) => goals.has(box))
  if (allOnGoal(startBoxes)) return { solved: true, moves: 0, pushes: 0, path: [], explored: 0 }

  if (startBoxes.some((box) => dead.has(box))) {
    return { solved: false, explored: 0, reason: '어떤 목표로도 보낼 수 없는 자리에 상자가 놓여 있습니다.' }
  }

  const startKey = keyOf(board.player, startBoxes)
  const best = new Map([[startKey, 0]])
  const parents = new Map([[startKey, null]])
  const heap = new MinHeap()
  heap.push(heuristic(tables, startBoxes), {
    player: board.player,
    boxes: startBoxes,
    key: startKey,
    cost: 0,
  })
  let explored = 0

  while (heap.size > 0) {
    const { value } = heap.pop()
    if (value.cost > (best.get(value.key) ?? Infinity)) continue

    explored += 1
    if (explored > stateLimit) {
      return { solved: false, explored, reason: '탐색 한도(' + stateLimit.toLocaleString() + ' 상태) 초과' }
    }

    const boxSet = new Set(value.boxes)
    const dist = walkDistances(board, boxSet, value.player)

    for (const box of value.boxes) {
      for (const dir of DIRECTION_KEYS) {
        const target = step(box, dir, width, height)
        if (target < 0 || walls.has(target) || boxSet.has(target) || dead.has(target)) continue

        const standing = step(box, OPPOSITE[dir], width, height)
        if (standing < 0 || walls.has(standing) || boxSet.has(standing)) continue

        const walk = dist[standing]
        if (walk < 0) continue

        const boxes = value.boxes.filter((other) => other !== box)
        boxes.push(target)
        boxes.sort((a, b) => a - b)

        if (formsFrozenSquare(board, new Set(boxes), target)) continue

        const key = keyOf(box, boxes)
        const nextCost = value.cost + walk + 1
        if (nextCost >= (best.get(key) ?? Infinity)) continue

        best.set(key, nextCost)
        parents.set(key, { fromKey: value.key, fromPlayer: value.player, standing, dir, boxOrigin: box })

        if (allOnGoal(boxes)) {
          return {
            solved: true,
            moves: nextCost,
            pushes: chainOf(parents, key).length,
            path: reconstruct(board, parents, key),
            explored,
          }
        }

        const estimate = heuristic(tables, boxes)
        if (estimate === Infinity) continue
        heap.push(nextCost + estimate, { player: box, boxes, key, cost: nextCost })
      }
    }
  }

  return { solved: false, explored, reason: '해답 없음 (전체 탐색 완료)' }
}

function chainOf(parents, key) {
  const chain = []
  let cursor = key
  while (parents.get(cursor)) {
    chain.unshift(parents.get(cursor))
    cursor = parents.get(cursor).fromKey
  }
  return chain
}

/** 밀기 목록을 실제 방향 시퀀스로 되살린다. 밀기 사이의 걸음은 다시 BFS로 복원한다. */
function reconstruct(board, parents, key) {
  const chain = chainOf(parents, key)
  const boxes = new Set(board.boxes)
  const path = []

  for (const link of chain) {
    path.push(...walkPath(board, boxes, link.fromPlayer, link.standing), link.dir)
    boxes.delete(link.boxOrigin)
    boxes.add(step(link.boxOrigin, link.dir, board.width, board.height))
  }
  return path
}

function walkPath(board, boxSet, from, to) {
  if (from === to) return []
  const { width, height, walls } = board
  const previous = new Map([[from, null]])
  const queue = [from]

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]
    if (current === to) break
    for (const dir of DIRECTION_KEYS) {
      const next = step(current, dir, width, height)
      if (next < 0 || previous.has(next)) continue
      if (walls.has(next) || boxSet.has(next)) continue
      previous.set(next, { from: current, dir })
      queue.push(next)
    }
  }

  const steps = []
  let cursor = to
  while (previous.get(cursor)) {
    const link = previous.get(cursor)
    steps.unshift(link.dir)
    cursor = link.from
  }
  return steps
}
