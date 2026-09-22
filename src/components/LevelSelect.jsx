import { CHAPTERS, LEVELS } from '../game/levels.js'

/**
 * 단계 선택 화면.
 *
 * 10단계를 한 화면에 모두 보여 준다. 스크롤 없이 전체 진행도가 눈에 들어와야
 * "몇 단계 남았지?"를 확인하려고 화면을 뒤적일 일이 없다.
 *
 * 상태는 색뿐 아니라 아이콘으로도 구분한다. 잠긴 단계는 자물쇠, 클리어한 단계는
 * 체크 표시가 붙는다.
 */
export function LevelSelect({ progress, unlocked, onSelect, onBack }) {
  const chapters = [1, 2, 3]
  // 열려 있지만 아직 못 깬 가장 낮은 단계 = 지금 이어서 할 곳. 눈에 띄게 표시한다.
  const nextUp = LEVELS.find((level) => level.id <= unlocked && !progress.cleared.includes(level.id))?.id

  return (
    <section className="screen screen--select">
      <header className="screen-header">
        <button type="button" className="icon-button" onClick={onBack} aria-label="시작 화면으로">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <h1>단계 선택</h1>
        <p className="screen-header__meta">
          {progress.cleared.length} / {LEVELS.length} 클리어
        </p>
      </header>

      <div className="select-body">
        {chapters.map((chapter) => (
          <section key={chapter} className="chapter" data-chapter={chapter}>
            <h2 className="chapter__title">
              {CHAPTERS[chapter].name}
              <span>{CHAPTERS[chapter].range}</span>
            </h2>

            <ul className="level-grid">
              {LEVELS.filter((level) => level.chapter === chapter).map((level) => {
                const isUnlocked = level.id <= unlocked
                const isCleared = progress.cleared.includes(level.id)
                const best = progress.best[level.id]

                return (
                  <li key={level.id}>
                    <button
                      type="button"
                      className={`level-card${isCleared ? ' is-cleared' : ''}${
                        level.id === nextUp ? ' is-next' : ''
                      }`}
                      disabled={!isUnlocked}
                      onClick={() => onSelect(level.id)}
                      aria-label={
                        isUnlocked
                          ? `${level.id}단계 ${level.title}${isCleared ? `, 클리어, 최고 기록 ${best}이동` : ''}`
                          : `${level.id}단계, 잠김`
                      }
                    >
                      <span className="level-card__number">{level.id}</span>
                      <span className="level-card__title">{isUnlocked ? level.title : '???'}</span>

                      <span className="level-card__status" aria-hidden="true">
                        {!isUnlocked ? (
                          <svg viewBox="0 0 24 24" className="icon-lock">
                            <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                            <rect x="5" y="11" width="14" height="9" rx="2" />
                          </svg>
                        ) : isCleared ? (
                          // 클리어 표시는 뚜껑에 지져진 표식(.level-card.is-cleared::after)이
                          // 맡는다. 체크 아이콘까지 붙이면 같은 말을 두 번 하는 셈이다.
                          <em>최고 {best}</em>
                        ) : (
                          <em>최소 {level.par}</em>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
