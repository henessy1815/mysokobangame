/**
 * 보드 위 스프라이트.
 *
 * 전부 인라인 SVG다. 내려받을 이미지가 없어 오프라인에서도 바로 뜨고,
 * 색은 CSS 변수로 받으므로 동굴 깊이(챕터)에 따라 색조를 바꿀 수 있다.
 *
 * 접근성 요구사항에 따라 상태를 색으로만 구분하지 않는다.
 *   - 목표 지점: 고리 모양 + 안쪽 마름모
 *   - 목표에 올라간 상자: 판자 무늬가 X에서 마름모로 바뀌고 테두리가 밝아진다
 */

export function GoalSprite() {
  return (
    <svg className="sprite sprite--goal" viewBox="0 0 32 32" aria-hidden="true">
      <circle className="goal-halo" cx="16" cy="16" r="11" />
      <circle className="goal-ring" cx="16" cy="16" r="8.5" />
      <path className="goal-mark" d="M16 10.5 21.5 16 16 21.5 10.5 16Z" />
    </svg>
  )
}

export function BoxSprite({ onGoal }) {
  return (
    <svg
      className={`sprite sprite--box${onGoal ? ' is-on-goal' : ''}`}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <rect className="box-body" x="3" y="3" width="26" height="26" rx="3" />
      <rect className="box-face" x="5.5" y="5.5" width="21" height="21" rx="2" />

      {onGoal ? (
        <path className="box-mark" d="M16 8.5 23.5 16 16 23.5 8.5 16Z" />
      ) : (
        <g className="box-planks">
          <path d="M6.5 6.5 25.5 25.5" />
          <path d="M25.5 6.5 6.5 25.5" />
        </g>
      )}

      <g className="box-bands">
        <rect x="3" y="7.5" width="26" height="2.6" rx="1.3" />
        <rect x="3" y="21.9" width="26" height="2.6" rx="1.3" />
      </g>
      <rect className="box-edge" x="3.75" y="3.75" width="24.5" height="24.5" rx="2.5" />
    </svg>
  )
}

/**
 * 상자가 목표에 막 얹힌 순간 한 번만 터지는 빛 파문.
 *
 * 고리 두 개를 시간차로 퍼뜨려 물결처럼 보이게 했다. 하나만 쓰면 그냥 원이
 * 커지는 것으로 보이지만, 시차를 두면 "퍼져 나간다"는 방향감이 생긴다.
 */
export function GoalBurstSprite() {
  return (
    <svg className="sprite sprite--burst" viewBox="0 0 32 32" aria-hidden="true">
      <circle className="burst-flash" cx="16" cy="16" r="12" />
      <circle className="burst-ring" cx="16" cy="16" r="10" />
      <circle className="burst-ring burst-ring--late" cx="16" cy="16" r="10" />
    </svg>
  )
}

/**
 * 사과. 이동 중에 가끔 떨어지는 수집 아이템이다.
 * 목표 지점(고리 + 마름모)과 헷갈리지 않도록 잎과 꼭지를 붙여 실루엣을 다르게 뒀다.
 */
export function AppleSprite() {
  return (
    <svg className="sprite sprite--apple" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse className="apple-shadow" cx="16" cy="27.6" rx="6.2" ry="1.8" />
      <path
        className="apple-body"
        d="M16 10.4c2.2-1.8 5.6-1.8 7.4.6 2.1 2.8 1.4 8-1.2 11.6-1.5 2-3.2 3.2-4.6 3.2-.7 0-1.1-.3-1.6-.3s-.9.3-1.6.3c-1.4 0-3.1-1.2-4.6-3.2-2.6-3.6-3.3-8.8-1.2-11.6 1.8-2.4 5.2-2.4 7.4-.6Z"
      />
      <path className="apple-shine" d="M12.4 13.2c1-1.2 2.3-1.7 3.2-1.4-.9.5-1.9 1.3-2.6 2.5-.6 1.1-.9 2.2-.8 3-.8-.7-.8-2.9.2-4.1Z" />
      <path className="apple-stem" d="M16 10.6c-.2-2 .2-3.8.9-4.9" />
      <path className="apple-leaf" d="M17 7.4c1.6-1.9 4-2 5-1.4.3 1.2-.8 3.3-2.8 3.8-1.3.3-2.2-.7-2.2-2.4Z" />
    </svg>
  )
}

export function PlayerSprite({ facing = 'down' }) {
  const facingLeft = facing === 'left'
  const facingBack = facing === 'up'

  return (
    <svg
      className="sprite sprite--player"
      viewBox="0 0 32 32"
      aria-hidden="true"
      data-facing={facing}
    >
      <g transform={facingLeft ? 'translate(32 0) scale(-1 1)' : undefined}>
        <ellipse className="player-shadow" cx="16" cy="28.2" rx="8" ry="2.4" />

        {/* 망토를 두른 몸통 */}
        <path className="player-body" d="M16 14c4.6 0 7.4 3.4 8 12.4H8C8.6 17.4 11.4 14 16 14Z" />
        <path className="player-strap" d="M12.6 17.6h6.8l-.7 8.8h-5.4Z" />

        {/* 머리와 탐험가 헬멧 */}
        <circle className="player-head" cx="16" cy="11.2" r="5.4" />
        <path className="player-helmet" d="M9.6 11.2a6.4 6.4 0 0 1 12.8 0Z" />
        <rect className="player-brim" x="8.4" y="10.4" width="15.2" height="2.2" rx="1.1" />

        {facingBack ? (
          <path className="player-hair" d="M11.6 12.6h8.8v2.6h-8.8Z" />
        ) : (
          <g className="player-face">
            <circle cx="13.7" cy="12.4" r="0.95" />
            <circle cx="18.3" cy="12.4" r="0.95" />
          </g>
        )}

        {/* 헬멧 램프 — 플레이어 주변을 밝히는 횃불빛의 근원 */}
        <circle className="player-lamp" cx="16" cy="8.4" r="1.9" />
      </g>
    </svg>
  )
}
