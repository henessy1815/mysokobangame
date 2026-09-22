import { TOTAL_LEVELS } from '../game/levels.js'

/**
 * 시작 화면.
 *
 * 진행 중이던 판이 있으면 "이어하기"를 가장 크게 띄운다. 이 게임의 전형적인
 * 사용 상황은 "지하철에서 하던 걸 다시 켜는 것"이라, 첫 화면에서 한 번만
 * 누르면 그 판으로 돌아갈 수 있어야 한다.
 */
export function TitleScreen({ progress, resumeLevel, onResume, onSelect, onSettings }) {
  const clearedCount = progress.cleared.length

  return (
    <section className="screen screen--title">
      <div className="title-art" aria-hidden="true">
        <div className="title-art__glow" />
        <svg viewBox="0 0 120 80">
          <path className="title-art__cave" d="M0 80V34c14-10 22 4 34-6s18-18 30-18 20 12 30 20 26 6 26 6v44Z" />
          <rect className="title-art__crate" x="46" y="52" width="28" height="28" rx="3" />
          <path className="title-art__crate-mark" d="M60 58l8 8-8 8-8-8Z" />
        </svg>
      </div>

      <div className="title-body">
        <h1 className="title-name">소코반</h1>
        <p className="title-tagline">
          동굴의 궤짝을 밀어 빛나는 표식 위로. 전 {TOTAL_LEVELS}단계.
        </p>

        <div className="title-actions">
          {resumeLevel ? (
            <button type="button" className="button button--primary" onClick={onResume}>
              이어하기
              <span className="button__note">{resumeLevel}단계</span>
            </button>
          ) : null}

          <button
            type="button"
            className={`button${resumeLevel ? '' : ' button--primary'}`}
            onClick={onSelect}
          >
            단계 선택
            <span className="button__note">
              {clearedCount} / {TOTAL_LEVELS} 클리어
            </span>
          </button>

          <button type="button" className="button button--ghost" onClick={onSettings}>
            설정
          </button>
        </div>
      </div>
    </section>
  )
}
