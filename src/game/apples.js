/**
 * 사과 누적 개수의 원격 저장소.
 *
 * 판 안에서 주운 사과는 `game.applesCollected`가 세지만, 그건 "이번 판"의 값이라
 * 새로고침하거나 다른 단계로 넘어가면 0으로 돌아간다. 여기서 다루는 값은 그와
 * 달리 계정 하나(= 브라우저 하나)가 지금까지 주운 사과의 총합이며, Supabase의
 * public.item 테이블 apple 컬럼에 한 행으로 보관한다.
 *
 * 로그인이 없는 게임이라 행을 구분할 키가 필요해서, 브라우저마다 UUID를 하나
 * 만들어 localStorage에 남기고 그것을 player_id로 쓴다.
 *
 * 네트워크와 저장소는 언제든 실패할 수 있다. 사과는 게임 진행을 막는 값이
 * 아니므로 실패는 콘솔 경고로만 남기고 게임은 그대로 굴러가게 둔다.
 */
import { createClient } from '@supabase/supabase-js'

const PLAYER_KEY = 'sokoban-cave:player-id'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** 환경 변수가 없으면 null. 이 경우 사과는 저장되지 않고 판 안에서만 센다. */
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null

if (!supabase) {
  console.warn('[apples] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 가 없어 사과 저장을 건너뜁니다.')
}

function randomId() {
  // 구형 브라우저나 http 환경에서는 crypto.randomUUID가 없을 수 있다.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 이 브라우저를 가리키는 고정 ID. 시크릿 모드처럼 저장이 막히면 매번 새로 생긴다. */
export function getPlayerId() {
  try {
    const saved = window.localStorage.getItem(PLAYER_KEY)
    if (saved) return saved
    const created = randomId()
    window.localStorage.setItem(PLAYER_KEY, created)
    return created
  } catch {
    return randomId()
  }
}

/**
 * 저장된 누적 사과 수를 읽어 온다.
 * 아직 행이 없으면(첫 실행) 0을 돌려주고, 읽기에 실패하면 null을 돌려준다.
 * 0과 null을 구분하는 이유: 읽기 실패를 0으로 착각해 덮어쓰면 기록이 날아간다.
 */
export async function fetchAppleTotal(playerId) {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('item')
    .select('apple')
    .eq('player_id', playerId)
    .maybeSingle()

  if (error) {
    console.warn('[apples] 불러오기 실패:', error.message)
    return null
  }
  return data?.apple ?? 0
}

/** 누적 사과 수를 기록한다. 행이 없으면 만들고, 있으면 갱신한다. */
export async function saveAppleTotal(playerId, apple) {
  if (!supabase) return false

  const { error } = await supabase
    .from('item')
    .upsert({ player_id: playerId, apple }, { onConflict: 'player_id' })

  if (error) {
    console.warn('[apples] 저장 실패:', error.message)
    return false
  }
  return true
}
