import { memo, useMemo } from 'react'
import { countBoxesOnGoal, toCol, toRow } from '../game/engine.js'
import { AppleSprite, BoxSprite, GoalBurstSprite, GoalSprite, PlayerSprite } from './Sprites.jsx'

/**
 * 퍼즐 격자.
 *
 * 바닥·벽·목표는 한 번 그리면 끝이라 CSS 그리드에 정적으로 깔고, 움직이는
 * 플레이어와 상자만 그 위에 절대 위치로 띄운다. 이렇게 나눠 두면 이동이
 * transform 트랜지션 하나로 끝나서 매 수마다 격자를 다시 그릴 필요가 없다.
 *
 * 상자의 React key는 배열 인덱스, 즉 상자의 고유 ID다. 밀려도 같은 DOM 노드가
 * 유지되어야 transform이 이어지며 부드럽게 움직인다.
 */

/** 타일마다 조금씩 다른 결을 주기 위한 결정적 난수. 매번 같은 값이 나와야 깜빡이지 않는다. */
function textureSeed(index) {
  const mixed = Math.imul(index + 1, 2654435761) >>> 0
  return (mixed % 1000) / 1000
}

const TileLayer = memo(function TileLayer({ board }) {
  const tiles = useMemo(() => {
    const result = []
    for (let index = 0; index < board.width * board.height; index += 1) {
      const isWall = board.walls.has(index)
      const isGoal = board.goals.has(index)
      const seed = textureSeed(index)

      result.push(
        <div
          key={index}
          className={`tile ${isWall ? 'tile--wall' : 'tile--floor'}`}
          style={{ '--seed': seed, '--tilt': `${(seed * 24 - 12).toFixed(1)}deg` }}
        >
          {isGoal ? <GoalSprite /> : null}
        </div>,
      )
    }
    return result
  }, [board])

  return (
    <div
      className="board__tiles"
      style={{ gridTemplateColumns: `repeat(${board.width}, var(--cell))` }}
    >
      {tiles}
    </div>
  )
})

function Entity({ className, index, width, children }) {
  return (
    <div
      className={`entity ${className}`}
      style={{ '--r': toRow(index, width), '--c': toCol(index, width) }}
    >
      {children}
    </div>
  )
}

export function Board({ board, game, event, facing, cell, solved, boardRef, handlers = {} }) {
  const { width } = board
  const apples = game.apples ?? []

  // 방금 목표에 들어간 상자의 ID. 그런 일이 없었으면 -1.
  // "목표 위에 있다"는 상태와 달리 "방금 들어갔다"는 한순간의 사건이라 event로 받는다.
  const landedBoxId = event?.landedBoxId ?? -1

  return (
    <div
      ref={boardRef}
      className={`board${solved ? ' is-solved' : ''}`}
      style={{
        '--cell': `${cell}px`,
        width: `${cell * board.width}px`,
        height: `${cell * board.height}px`,
      }}
      role="application"
      aria-label={`퍼즐 격자. 목표에 올린 상자 ${countBoxesOnGoal(board, game)}개 / 전체 ${game.boxes.length}개. 바닥에 떨어진 사과 ${apples.length}개`}
      {...handlers}
    >
      <TileLayer board={board} />

      {apples.map((position) => (
        <Entity key={`apple-${position}`} className="entity--apple" index={position} width={width}>
          <AppleSprite />
        </Entity>
      ))}

      {game.boxes.map((position, id) => (
        <Entity key={`box-${id}`} className="entity--box" index={position} width={width}>
          <BoxSprite onGoal={board.goals.has(position)} />
        </Entity>
      ))}

      {/*
        key에 event.id를 넣는 것이 핵심이다. 한 수 둘 때마다 id가 올라가므로 React가
        이 파문을 매번 새 DOM으로 만들고, 그래야 CSS 애니메이션이 처음부터 다시 재생된다.
        (같은 DOM을 재사용하면 애니메이션은 두 번째부터 돌지 않는다.)
      */}
      {landedBoxId >= 0 ? (
        <Entity
          key={`burst-${event.id}`}
          className="entity--burst"
          index={game.boxes[landedBoxId]}
          width={width}
        >
          <GoalBurstSprite />
        </Entity>
      ) : null}

      <Entity className="entity--player" index={game.player} width={width}>
        <PlayerSprite facing={facing} />
      </Entity>

      <div className="board__vignette" aria-hidden="true" />

      <Entity className="entity--torch" index={game.player} width={width}>
        <div className="torch__glow" aria-hidden="true" />
      </Entity>
    </div>
  )
}
