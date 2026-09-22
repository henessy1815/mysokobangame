import { useCallback, useMemo, useReducer } from 'react'
import {
  MOVE_RESULT,
  countBoxesOnGoal,
  createInitialState,
  isSolved,
  move,
  parseLevel,
  undo,
} from '../game/engine.js'

/**
 * 한 판의 게임 상태를 들고 있는 훅.
 *
 * 화면에 보여 줄 값(상자 위치, 이동 수)과 별개로 `event`를 함께 내보낸다.
 * "방금 상자를 밀었다", "벽에 막혔다" 같은 순간적인 사건은 상태가 아니라
 * 알림에 가까워서, 단조 증가하는 id를 붙여 두면 효과음·흔들림 같은 일회성
 * 피드백을 useEffect에서 중복 없이 한 번씩만 실행할 수 있다.
 */
function makeReducer(board) {
  return function reducer(state, action) {
    switch (action.type) {
      case 'move': {
        // 클리어 연출이 도는 동안 들어온 입력은 버린다.
        if (state.solved) return state

        const outcome = move(board, state.game, action.dir, { rng: action.rng ?? Math.random })
        if (outcome.result === MOVE_RESULT.BLOCKED) {
          return {
            ...state,
            facing: action.dir,
            event: { id: state.event.id + 1, type: 'blocked', dir: action.dir },
          }
        }

        const pushed = outcome.result === MOVE_RESULT.PUSHED
        const landedOnGoal = pushed && board.goals.has(outcome.state.boxes[outcome.movedBoxIndex])
        const solved = isSolved(board, outcome.state)

        return {
          game: outcome.state,
          facing: action.dir,
          solved,
          event: {
            id: state.event.id + 1,
            type: pushed ? 'push' : 'step',
            dir: action.dir,
            landedOnGoal,
            // 어느 상자가 들어갔는지. 그 칸에만 착지 연출을 띄우려면 ID가 필요하다.
            landedBoxId: landedOnGoal ? outcome.movedBoxIndex : -1,
            pickedApple: outcome.pickedApple >= 0,
            droppedApple: outcome.spawnedApple >= 0,
            solved,
          },
        }
      }

      case 'undo': {
        if (state.solved || state.game.history.length === 0) return state
        return {
          game: undo(board, state.game),
          facing: state.facing,
          solved: false,
          event: { id: state.event.id + 1, type: 'undo' },
        }
      }

      case 'restart': {
        return {
          game: createInitialState(board),
          facing: 'down',
          solved: false,
          event: { id: state.event.id + 1, type: 'restart' },
        }
      }

      default:
        return state
    }
  }
}

function init({ board, snapshot }) {
  const game = snapshot
    ? {
        player: snapshot.player,
        boxes: [...snapshot.boxes],
        apples: Array.isArray(snapshot.apples) ? [...snapshot.apples] : [],
        applesCollected: snapshot.applesCollected ?? 0,
        moves: snapshot.moves ?? 0,
        pushes: snapshot.pushes ?? 0,
        history: Array.isArray(snapshot.history) ? snapshot.history : [],
      }
    : createInitialState(board)

  return {
    game,
    facing: 'down',
    solved: isSolved(board, game),
    event: { id: 0, type: 'init' },
  }
}

export function useSokoban(level, snapshot) {
  const board = useMemo(() => parseLevel(level.layout), [level.layout])
  const reducer = useMemo(() => makeReducer(board), [board])
  const [state, dispatch] = useReducer(reducer, { board, snapshot }, init)

  const moveTo = useCallback((dir) => dispatch({ type: 'move', dir }), [])
  const undoMove = useCallback(() => dispatch({ type: 'undo' }), [])
  const restart = useCallback(() => dispatch({ type: 'restart' }), [])

  const boxesOnGoal = useMemo(() => countBoxesOnGoal(board, state.game), [board, state.game])

  return {
    board,
    game: state.game,
    facing: state.facing,
    solved: state.solved,
    event: state.event,
    boxesOnGoal,
    apples: state.game.apples,
    applesCollected: state.game.applesCollected,
    canUndo: state.game.history.length > 0 && !state.solved,
    moveTo,
    undoMove,
    restart,
  }
}

/** localStorage에 넣을 수 있는 형태로 현재 판을 뽑아낸다. */
export function toSnapshot(levelId, game) {
  return {
    levelId,
    player: game.player,
    boxes: game.boxes,
    apples: game.apples,
    applesCollected: game.applesCollected,
    moves: game.moves,
    pushes: game.pushes,
    history: game.history,
  }
}
