import { useEffect, useRef } from 'react'

/**
 * 클리어 결과 화면.
 *
 * 마지막 상자가 목표에 올라앉는 연출을 볼 시간을 준 뒤에 뜬다(GameScreen이 지연을 준다).
 * 이동 수와 개인 최고 기록, 그리고 검증 스크립트가 구한 이론상 최소 이동 수를 함께 보여
 * "더 줄일 수 있다"는 목표를 남긴다.
 */
export function ClearOverlay({ level, moves, best, isNewRecord, hasNext, onNext, onRetry, onSelect }) {
  const primaryRef = useRef(null)

  useEffect(() => {
    primaryRef.current?.focus()
  }, [])

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="clear-title">
      <div className="overlay__panel panel">
        <h2 className="overlay__title" id="clear-title">
          {level.title}
        </h2>
        <p className="overlay__sub">{level.id}단계 클리어</p>

        {/* 이번 판의 성적은 숫자 하나다. 견줄 값은 아래로 내린다. */}
        <p className="overlay__moves">
          {moves}
          <span>이동</span>
        </p>

        {isNewRecord ? (
          <p className="overlay__brand">
            <i className="brand-mark" aria-hidden="true" />
            최소 이동 기록 경신
          </p>
        ) : null}

        <dl className="facts">
          <div>
            <dt>내 최고 기록</dt>
            <dd>{best ?? moves}</dd>
          </div>
          <div>
            <dt>이론상 최소</dt>
            <dd>{level.par}</dd>
          </div>
        </dl>

        <div className="overlay__actions">
          {hasNext ? (
            <button type="button" className="button button--primary" ref={primaryRef} onClick={onNext}>
              다음 단계
            </button>
          ) : (
            <button type="button" className="button button--primary" ref={primaryRef} onClick={onSelect}>
              모든 단계 완료
            </button>
          )}
          <button type="button" className="button" onClick={onRetry}>
            다시 하기
          </button>
          <button type="button" className="button button--ghost" onClick={onSelect}>
            단계 선택
          </button>
        </div>
      </div>
    </div>
  )
}
