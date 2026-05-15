# Mac-Pilot MCP — 개선 리스트 v2

> **목적**: `docs/EVALUATION.md` v2 기반 우선순위 개선 계획
> **현재 점수**: 53.9 ± 5/100 → **1차 목표**: 80+ (P1 완료)
> **2차 목표**: 88+ (P2 완료) — 90+는 launch + 시간 필요
> **작성일**: 2026-05-15
> **v2 변경**: code-reviewer critique 9개 반영. self-learning 진짜 구현으로 재정렬. recipes 우선순위 하향. Anthropic 대응 P1 추가.

---

## v1 → v2 우선순위 재배치 요약

| 작업 | v1 우선순위 | v2 우선순위 | 변경 이유 |
|------|------------|------------|----------|
| hasPipeChain → checkSecurity 연결 | (누락) | **P0-0 (최우선)** | dead code, 마케팅이 거짓말 됨 |
| 진짜 self-learning loop (에러 정규화 + 양방향 hint) | P1-4 (낮음) | **P1-A (최상위)** | 마케팅 카피 vs 실제 동작 격차, HN에서 까일 가능성 |
| builtin recipes 21→150 | P1-1 (최상위) | P1-B (중간) | 도구 표면 ↑ 효과는 있으나 self-learning 점수 직접 기여 X |
| `do shell script` 내부 재검사 | (누락) | **P0-7 (신규)** | 가장 큰 보안 우회 |
| Anthropic 대응 J 강화 | (없음) | **P2-NEW** | 위험 분석에서 가장 큰 위협 |
| MCP client 호환 매트릭스 | (누락) | **P1-NEW** | E 항목 누락 카테고리 |

---

## P0 — 즉시 수정 (1차 ralf 사이클, 약 8시간)

> 합산 점수 영향: **+10.2pt 추정 (53.9 → 64.1, ±3)**

### P0-0. hasPipeChain dead code 활성화 🔐 [최우선]
**카테고리**: A. 보안 / **+0.5×17% = +0.85pt**

- 위치: `src/security/sandbox.ts:107-126` `checkSecurity`
- 변경: shell action일 때 `hasPipeChain(command)` 호출, 의도하지 않은 파이프 체인 시 `blocked` 또는 confirm 요구
- 단, 정당한 파이프 (`ls | grep`) 차단하면 false positive 폭발 → **white-list 패턴 사용**:
  ```typescript
  // 차단 조건: 파이프 chain + sink가 sh/bash/eval/...
  const PIPE_SINK_BLOCK = /\|\s*(ba)?sh\b|\|\s*eval\b|\|\s*python\d?\b|\|\s*node\b/;
  if (hasPipeChain(cmd) && PIPE_SINK_BLOCK.test(cmd)) return 'blocked';
  ```
- 테스트: positive 5 (`curl|sh`, `wget|bash`, `... | eval`) + negative 5 (`ls|grep`, `cat|wc -l`)
- 코스트: 1h

### P0-1. `do shell script` 재귀 검사 🔐
**카테고리**: A. 보안 / **+1×17% = +1.7pt**

- 위치: `src/security/sandbox.ts:67-79` `classifyAppleScriptRisk`
- 변경: `do shell script "..."` 발견 시 추출한 shell 부분에 `classifyShellRisk` 재호출
  ```typescript
  const shellMatch = /do\s+shell\s+script\s+"([^"]+)"/i.exec(script);
  if (shellMatch) {
    const innerRisk = classifyShellRisk(shellMatch[1]);
    if (innerRisk === 'blocked') return 'blocked';
  }
  ```
- 테스트: AS 우회 시도 5 (positive) + 정상 AS+shell 3 (negative)
- 코스트: 1h

### P0-2. 감사 로그 민감정보 마스킹 🔐
**카테고리**: A. 보안 / **+0.5×17% = +0.85pt**

- 위치: `src/security/audit.ts`, `src/tools/run.ts:29`
- 변경:
  ```typescript
  const SENSITIVE_KEYS = /password|passwd|token|secret|api[_-]?key|authorization|bearer/i;
  function maskSensitive(obj: unknown): unknown { /* recursive walk */ }
  // run.ts: details: JSON.stringify(maskSensitive(args)).slice(0, 500)
  ```
- 테스트: 6 (적용/미적용/중첩/배열/null/edge)
- 코스트: 1h

### P0-3. Shell 체인 토큰 차단 🔐
**카테고리**: A. 보안 / **+0.5×17% = +0.85pt**

- 위치: `src/security/sandbox.ts`
- 변경: `hasUnsafeChain(cmd)` — 인용 외부의 `;`, `&&`, `||` 탐지 (P0-0 hasPipeChain과 유사 로직)
- 단, `;`는 일반 사용도 흔함 (`ls; date`) → 화이트리스트 또는 사용자 confirm 옵션
- 정책 결정: **기본은 차단하지 않되, ALLOWLIST_MODE=strict에서만 차단**
- 코스트: 1.5h

### P0-4. SQLite busy_timeout + transaction 🔒
**카테고리**: B. 신뢰성 / **+1.5×14% = +2.1pt**

(v1 P0-2와 동일)
- 위치: `src/db/database.ts:27`, `:264-272`
- 변경:
  ```typescript
  this.db.pragma('busy_timeout = 5000');
  this.db.pragma('synchronous = NORMAL');
  // updateRecipeStats를 transaction()으로 래핑
  ```
- 테스트: 동시성 시뮬 (concurrency-stats)
- 코스트: 1h

### P0-5. Process signal handler / graceful shutdown 🛑
**카테고리**: B. 신뢰성 / **+0.5×14% = +0.7pt**

(v1 P0-3과 동일)
- `src/index.ts`에 SIGTERM/SIGINT/uncaughtException 핸들러
- 코스트: 30m

### P0-6. DB 파일 권한 600/700 🔐
**카테고리**: A. 보안 / **+0.5×17% = +0.85pt**

(v1 P0-5와 동일)
- `~/.mac-pilot/` 디렉토리 700, `pilot.db` 600 강제
- 코스트: 30m

### P0-7. AppleScript escape strict mode 🔐
**카테고리**: A. 보안 / **+0.5×17% = +0.85pt**

(v1 P0-6와 동일)
- `escapeForShell` 강화: control char 거부, allowlist
- 코스트: 1.5h

**P0 합계 점수 영향**:
- A (보안): 6 → 9 (+3pt × 17% = **+5.1pt**)
- B (신뢰성): 6 → 8 (+2pt × 14% = **+2.8pt**)
- H (문서: SECURITY.md 부산물): 5 → 6 (+1pt × 8% = **+0.8pt**)
- G (테스트: security regression 추가): 6 → 7 (+1pt × 8% = **+0.8pt**)
- **총 +9.5pt, 신뢰구간 ±3 → 64.1±3 (52~67)**

**코스트**: 약 8시간

---

## P1 — 80+ 달성 핵심 (2차 ralf 사이클, 약 30-40시간)

> 합산 영향: **+17pt 추정 (64 → 81, ±5)**

### P1-A. 진짜 self-learning loop 구현 🧠 [최상위]
**카테고리**: C. 자기학습 / **+4×13% = +5.2pt**

리뷰어 지적 핵심: "self-learning"이 마케팅 카피일 뿐, 실제로는 에러 문자열 캐시. **HN에서 까일 가장 큰 risk**.

#### A. 에러 패턴 정규화
- 위치: `src/tools/run.ts:73-79` (실패 시 저장 로직)
- 변경: raw error → structured pattern
  ```typescript
  interface ErrorPattern {
    error_class: 'permission' | 'not_found' | 'invalid_param' | 'timeout' | 'unknown';
    retry_strategy?: string;     // "request_permission" | "use_jxa" | "use_ax_fallback"
    alternative_action?: string; // suggestion for next call
    raw_error: string;           // for reference
  }
  ```
- 분류 로직: regex 매칭 (`/access not allowed/i → permission`, `/object is not accessible/i → permission`, `/end of script/i → invalid_param`)
- 코스트: 3h

#### B. 성공 패턴 메타 추출
- 위치: `src/tools/run.ts:92-97` (성공 시 저장)
- 변경: `"Successful script hash: ABC"` → meaningful meta
  ```typescript
  {
    action_pattern: 'add_calendar_event',
    used_method: 'jxa',
    success_count: 5,
    avg_duration_ms: 230
  }
  ```
- 추출: AS/JXA script에서 `tell application "X"` 패턴 추출
- 코스트: 3h

#### C. 양방향 hint 주입
- 위치: `src/tools/run.ts` handler 진입부
- 변경: 호출 *전* `getAppKnowledge(appContext, reliability >= 0.7)`로 top-3 hint를 LLM result에 prepend (성공/실패 모두)
- 코스트: 2h

#### D. Promotion 메커니즘
- 위치: `src/db/database.ts` + `src/tools/run.ts`
- 변경: 동일 (action_pattern, app) 조합 N=3회 성공 시 자동 recipe 제안 (db에 `suggested_recipes` 테이블)
- 코스트: 2h

#### E. content hash dedup
- 위치: `src/db/database.ts:355-357`
- 변경: ON CONFLICT 키를 `(app_name, knowledge_type, content_hash)`로 변경 (content_hash는 normalized error pattern의 hash)
- 코스트: 1h

#### F. JSON-safe parameter substitution
- 위치: `src/tools/recipe-run.ts:95-111`
- 변경: regex replace → token 분리 후 typed substitution
- 코스트: 1.5h

**P1-A 합계: 12.5h, C 4 → 8 (+4pt), J 5 → 6 (+1pt × 6% = +0.6pt)**

---

### P1-B. Electron/Chromium AX fallback 🖥️
**카테고리**: F. macOS 깊이 / **+3×10% = +3.0pt**

(v1 P1-2와 유사)
- 새 파일: `src/engine/electron-fallback.ts`
- 자동 감지: bundle ID prefix (VSCode, Slack, Discord, Cursor)
- CDP via `chrome-remote-interface` 또는 자체 구현
- 폴백 체인: AX → CDP → "no fallback available, suggest mac_vision_click"
- 코스트: 8h

### P1-C. Builtin recipes 21 → 100+ 📚
**카테고리**: D. 도구 표면 + C 자기학습 / **+2×9% + 1×13% = +3.1pt**

(v1 P1-1을 축소: 150 → 100, lazy load 추가)
- 위치: `src/recipes/builtin.ts` 분리 → `src/recipes/builtin/*.json`
- 카테고리 축소:

| 카테고리 | 갯수 |
|----------|------|
| Finder | 15 |
| Safari | 15 |
| Mail | 10 |
| Notes | 10 |
| Messages | 8 |
| Calendar | 8 |
| Reminders | 6 |
| Shortcuts | 5 |
| System | 12 |
| Productivity | 8 |
| **합계** | **97** + 21 기존 = ~118 |

- **검증 단계 추가**: 각 recipe vitest 시뮬 (dry run + 예상 AS/JXA 비교) → 동작 안 하는 50% 사전 제거
- lazy import (npm 패키지 사이즈 영향 최소화)
- 코스트: 10h (생성) + 4h (검증) = 14h

### P1-D. MCP client 호환 매트릭스 🔌
**카테고리**: E. DX / **+1×9% = +0.9pt**

리뷰어 지적: Cursor/Claude Desktop/Windsurf 호환 검증 부재.

- 새 파일: `docs/MCP-COMPATIBILITY.md`
- 매트릭스: Claude Desktop, Cursor, Windsurf, Claude Code(CLI), Continue.dev
- 각 client별 설치 config + 실제 7개 도구 동작 검증 (수동, 결과 표 기록)
- README에 "Tested clients" 섹션 추가
- 코스트: 3h

### P1-E. npm publish + README quickstart + SECURITY.md 📦
**카테고리**: H. 문서/배포 / **+3×8% = +2.4pt**

- npm publish (사용자 액션 트리거 필요, 코드 외 부분)
- 5분 quickstart README 상단
- `SECURITY.md`: threat model, responsible disclosure
- `CONTRIBUTING.md`: recipe 기여 가이드
- `CHANGELOG.md`: keepachangelog
- `docs/INSTALL.md`: 5개 client 별 설치
- 코스트: 4h

### P1-F. 도메인 도구 4개 (mac_notes/messages/calendar/files) 🛠️
**카테고리**: D. 도구 표면 / **+2×9% = +1.8pt** (P1-C와 중첩 회피)

- recipe 기반 얇은 wrapper
- P1-C builtin recipes 채워진 후 작업
- 코스트: 4h

### P1-G. GitHub Actions CI matrix 🤖
**카테고리**: G. 테스트/CI / **+2×8% = +1.6pt**

- macOS-13/14/15 × Node 20/22
- coverage report
- security regression test job
- 코스트: 1.5h

### P1-H. tool description에 examples + limitations 추가 📝
**카테고리**: E. DX / **+1×9% = +0.9pt**

- 7개 도구 description에 `## Examples` 2-3, `## Limitations` 명시
- Anthropic best practice 준수
- 코스트: 2h

**P1 합계 점수 영향**:
| 카테고리 | 현재 → 목표 | 점수 영향 |
|----------|-------------|-----------|
| A 보안 | 9 (P0 유지) | — |
| B 신뢰성 | 8 → 9 | +1.4 |
| C 자기학습 | 4 → 8 | +5.2 |
| D 도구 표면 | 6 → 9 | +2.7 |
| E DX | 7 → 9 | +1.8 |
| F macOS | 6 → 9 | +3.0 |
| G 테스트 | 7 → 8 | +0.8 |
| H 문서 | 6 → 9 | +2.4 |
| J moat | 5 → 6 | +0.6 |
| **소계** | | **+17.9pt** |

→ 64.1 + 17.9 = **82.0±5 (P1 후)**

**코스트**: 약 35-40시간

---

## P2 — 1위 근접 (3차 사이클, 약 20시간)

> 합산 영향: +4-6pt (82 → 87)

### P2-1. Anthropic native 대응 전략 🛡️ [신규]
**카테고리**: J. moat / **+2×6% = +1.2pt**

리뷰어 지적: 가장 큰 위협이 가장 작은 대응.

- 새 문서: `docs/POSITIONING.md`
- 핵심 메시지: 
  - "privacy-first: all data stays local"
  - "recipe portability: export/import"
  - "sandbox option for enterprise"
  - "Anthropic native가 와도 우리는 cross-MCP-client + community recipes"
- README/npm description에 반영
- 코스트: 2h

### P2-2. Recipe marketplace 시드 🌐
**카테고리**: J. moat + D. 도구 표면 / **+1×6% + 0.5×9% = +1.05pt**

- `mac_recipe_export`, `mac_recipe_import` 도구
- `.mac-recipe.json` 포맷 표준화
- `recipes-community/` 디렉토리 + 5-10개 예시
- 코스트: 4h

### P2-3. mac_permissions 도구 + 권한 deep-link 🔑
**카테고리**: F. macOS / **+0.5×10% = +0.5pt**

- TCC 권한 상태 조회 (read-only)
- 부족 시 Privacy preferences deep-link 반환
- 코스트: 2h

### P2-4. Vision OCR fallback ⛓️
**카테고리**: F. macOS / **+0.5×10% = +0.5pt**

- macOS Vision framework via Swift CLI shim (선택적 dep)
- AX/CDP 실패 시 last resort
- 코스트: 6h

### P2-5. mac_clipboard 도구 분리 📋
**카테고리**: D. 도구 표면 / **+0.5×9% = +0.45pt**

- 현재 `mac_state` 묶임 → 별도 도구
- read/write/history (last 10)
- 코스트: 1.5h

### P2-6. Security regression test suite 🧪
**카테고리**: G. 테스트 / **+1×8% = +0.8pt**

- 알려진 bypass 시도 30+ negative test
- AppleScript 우회 / shell injection / param injection
- 코스트: 4h

### P2-7. Performance benchmark suite ⏱️
**카테고리**: G. 테스트 / **+0.5×8% = +0.4pt**

- cold start, recipe lookup, db query 측정
- 코스트: 2h

**P2 합계**: 약 22h, +4.9pt → **86.9±5**

---

## P3 — Launch & 외부 (사이클 외, 사용자 액션)

> 코드 외 작업. I (인기도) 항목 점수만 영향.

- **P3-1**. npm publish 실행 (P1-E 완료 후)
- **P3-2**. HN Show submission ("Show HN: Mac-Pilot — Sandbox-protected macOS automation MCP with persistent recipe DB")
  - **마케팅 카피 정정**: "self-learning" → "sandbox-protected + persistent recipe DB". 진짜 learning loop이 추가된 후에만 self-learning 카피 부활.
- **P3-3**. Awesome MCP servers PR
- **P3-4**. Anthropic Discord/Blog mention 시도
- **P3-5**. 3분 demo 비디오 (recipe DB 성장 시연)
- **P3-6**. SECURITY 블로그 포스트 (threat model + sandbox 설계)
- **P3-7**. 한국어 README 별도 추가 (lasjk7@gmail.com이 한국 사용자) — i18n 시작점

→ launch 성공 시 I: 1 → 4 (+3pt × 6% = +1.8pt) + J: 6 → 8 (+2pt × 6% = +1.2pt) = **+3.0pt → 90.0** 🏆

---

## 점수 누적 시뮬레이션 (v2 정정)

| 단계 | 누적 점수 | 등급 | 신뢰구간 |
|------|----------|------|----------|
| 현재 v0.3.1 | **53.9** | 🔴 미달 | ±5 |
| P0 완료 (v0.4.0) | **64.1** | 🟡 미달 | ±3 |
| P1 완료 (v0.5.0) | **82.0** | 🟢 합격선 | ±5 |
| P2 완료 (v0.6.0) | **86.9** | 🟢 1위 근접 | ±4 |
| Launch 후 + 6개월 | **90.0** | 🏆 1위 후보 | ±3 |

**v1 vs v2 비교**:
- v1 P1 완료: 85.15
- v2 P1 완료: 82.0
- 차이 원인: v1이 self-learning을 5→9로 낙관, v2는 4→8로 현실화

---

## ralf 자동 진행 계획 (v2)

### 1차 사이클 (P0) — 즉시 시작
- P0-0 ~ P0-7 (8개 작업, 약 8시간)
- 각 작업 후 build + 144 test 통과 확인
- 카테고리별 commit (security/, reliability/)
- 완료 후 점수 재채점 (자체 평가)

### 2차 사이클 (P1) — P0 통과 후
- P1-A (self-learning, 12.5h) — **본 에이전트 직접** (코드 깊이 필요)
- P1-B (Electron AX, 8h) — **sub-agent** (CDP 도메인 격리)
- P1-C (recipes 100+, 14h) — **sub-agent** (recipe-generator)
  - 각 recipe vitest 시뮬 검증 단계 추가
- P1-D ~ P1-H — 본 에이전트 또는 병렬 sub-agent

### 3차 사이클 (P2) — P1 통과 + 사용자 컨펌 후

**ralf 중단 조건**:
- P0/P1에서 build/test 실패 시 즉시 중단 + 보고
- 사용자 명시적 stop
- **점수 80+ 도달 시 자연 종료** (P2는 선택)

---

## 가장 큰 변경 (v1 → v2)

1. **self-learning을 실제로 구현** (P1-A): 마케팅 카피와 실제 동작 일치
2. **dead code 활성화** (P0-0): 마케팅에서 광고하는 기능을 실제 작동시킴
3. **`do shell script` 재귀 검사** (P0-1): 가장 큰 보안 우회
4. **Anthropic 대응** (P2-1): 위협 인지 + 포지셔닝 문서
5. **점수 신뢰구간 명시**: 재채점 시 wishful thinking 방지
6. **90+ 도달 불가 인정 → 80+ 1차 목표**: 현실적 ralf 종료 조건

---

## 다음 액션 (사용자 컨펌 후)

1. 평가지 v2 + 개선 리스트 v2 검토
2. P0 ralf 시작 (예상 8시간)
3. P0 완료 → 자체 재채점 → P1 시작
4. P1 완료 → 자체 재채점 → 점수 80+ 도달 시 ralf 종료, 사용자에게 P2/launch 결정 요청
