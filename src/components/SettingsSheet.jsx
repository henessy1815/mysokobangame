import { useEffect, useRef, useState } from 'react'

/**
 * 설정 시트.
 *
 * 소리와 진동은 기본이 꺼짐이다. 버스·지하철에서 켜자마자 소리가 나는 쪽이
 * 잘못이라고 보고, 원하는 사람만 켜도록 했다.
 *
 * 기록 초기화는 되돌릴 수 없으므로 한 번 더 확인을 받는다.
 */
export function SettingsSheet({ settings, onChange, onResetProgress, onClose }) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="overlay__panel panel">
        <h2 className="overlay__title" id="settings-title">
          설정
        </h2>

        <ul className="settings-list">
          <li>
            <Toggle
              label="효과음"
              description="상자를 밀거나 표식에 올릴 때 짧은 소리가 납니다."
              checked={settings.sound}
              onChange={(sound) => onChange({ ...settings, sound })}
            />
          </li>
          <li>
            <Toggle
              label="진동"
              description="지원하는 기기에서만 동작합니다."
              checked={settings.haptics}
              onChange={(haptics) => onChange({ ...settings, haptics })}
            />
          </li>
        </ul>

        <div className="settings-danger">
          {confirmingReset ? (
            <>
              <p>클리어 기록과 최고 기록이 모두 지워집니다. 되돌릴 수 없습니다.</p>
              <div className="settings-danger__actions">
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    onResetProgress()
                    setConfirmingReset(false)
                  }}
                >
                  정말 초기화
                </button>
                <button type="button" className="button button--ghost" onClick={() => setConfirmingReset(false)}>
                  취소
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="button button--ghost" onClick={() => setConfirmingReset(true)}>
              진행 기록 초기화
            </button>
          )}
        </div>

        <div className="overlay__actions">
          <button type="button" className="button button--primary" ref={closeRef} onClick={onClose}>
            닫기
          </button>
        </div>

        <p className="settings-keys">
          키보드: 방향키 · WASD 이동 / Z 되돌리기 / R 다시하기 / Esc 나가기
        </p>
      </div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  )
}
