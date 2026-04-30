# WEDPLANING — 허니문 지중해 크루즈 가이드 PWA 작업 지침

## 언어
- 응답·문서: 한글
- 코드(변수명, 주석, 커밋): 영어

## 프로젝트 특성
- 1쌍(부부) 사용 모바일 PWA
- 순수 HTML/CSS/JavaScript — 빌드 시스템 없음
- 테스트 코드 없음 — 작성하지 않는다
- 추가 README 작성 금지 — 기존 [README.md](README.md), [CLAUDE.md](CLAUDE.md), [travel-guide/README.md](travel-guide/README.md) 만 유지

## 데이터 / 자산 소스
| 파일 | 용도 |
|------|------|
| [travel-guide/js/data.js](travel-guide/js/data.js) | 일정·체크리스트·팁 SoT (Single Source of Truth) |
| [travel-guide/js/config.js](travel-guide/js/config.js) | Google Maps + Firebase 키 |
| [여행/](여행/) | 원본 일정 자료 (KakaoTalk·Gemini·MSC 앱 캡처) |
| [travel-guide/icons/](travel-guide/icons/) | PWA 아이콘 (`generate-icons.py`로 생성) |

## 인프라
| 시스템 | 값 |
|---|---|
| GitHub | https://github.com/Haksung96/WEDPLANING (Public) |
| Live | https://mellifluous-genie-58fe8c.netlify.app/ |
| Firebase | `wedplaning-50226` (Firestore) |
| Google Maps | API Key in [config.js](travel-guide/js/config.js) (HTTP referrer 제한) |

## 코드 작성 방침

### 1. 코딩 전에 생각하기
- 가정을 명시적으로 밝히고, 불확실하면 질문
- 여러 해석이 가능하면 조용히 선택하지 말고 선택지를 제시
- 더 간단한 접근이 있으면 제안
- 혼란스러운 요소는 넘어가지 말고 명확히 짚기

### 2. 단순성 우선
- 요청된 것 이상의 기능을 추가하지 않음
- 한 번만 쓰이는 코드에 추상화를 만들지 않음
- 불필요한 "유연성"이나 "설정 가능성"을 넣지 않음
- 발생할 수 없는 시나리오에 대한 에러 핸들링을 하지 않음
- 50줄이면 될 것을 200줄로 만들지 않음

### 3. 외과적 변경
- 관련 없는 코드, 주석, 포맷을 개선하지 않음
- 동작하는 코드를 리팩토링하지 않음
- 기존 스타일을 따름
- 내 변경으로 생긴 미사용 코드만 정리 (기존 dead code는 건드리지 않음)
- 모든 변경된 줄은 사용자의 요청에 직접 연결되어야 함

### 4. 목표 기반 실행
- 모호한 태스크를 측정 가능한 목표와 검증 단계로 변환
- 다단계 작업에는 각 단계별 체크포인트가 있는 구조화된 계획 수립

## 기술 스택 (변경 시 사용자 승인 필수)
- **금지**: React/Vue/Angular/Svelte, Webpack/Vite/Rollup, TypeScript 빌드, npm 의존성
- **허용**: 순수 HTML/CSS/ES2020+ JS, CDN 단일 스크립트 임포트 (Firebase SDK 등)

## Windows 한글 환경 필수 규칙

### 인코딩
- **bat 파일**: 반드시 CP949(ANSI) 인코딩으로 저장. UTF-8 금지 (cmd.exe가 UTF-8 배치 파일을 정상 파싱하지 못함)
- **bat 파일 내 특수문자 금지**: `✔ ╔ ═ ╗ ║ ╚ ╝ ▶ ─` 등 유니코드 전용 문자 사용 금지. `[OK]`, `====`, `*`, `----` 등 ASCII 대체 사용
- **bat 파일의 `chcp`**: `chcp 949 > nul` 사용 (65001 금지)
- **HTML/JS/Python/JSON**: UTF-8 사용 (표준)
- **Write/Edit 도구의 한계**: 이 도구들은 항상 UTF-8로 저장됨. bat 파일처럼 CP949가 필요한 경우, Python 스크립트(`open(path, 'w', encoding='cp949')`)를 작성하여 변환해야 함

### 파일 작성 시 체크리스트
- [ ] bat 파일을 Write/Edit로 만들었다면 → Python으로 CP949 변환 실행했는가?
- [ ] bat 파일에 유니코드 특수문자가 없는가?
- [ ] 임시 스크립트(_fix_*.py 등)를 작업 후 삭제했는가?

## 모바일 PWA 작성 규칙
- 모든 터치 타깃 최소 44×44 px (Apple HIG)
- 모든 `<input>` 폰트 16px 이상 (iOS 자동 줌 차단)
- `100dvh` 사용 (`100vh` 금지 — iOS Safari URL 바)
- 모든 fixed 요소에 `env(safe-area-inset-*)` 적용
- 한글 텍스트 컨테이너에 `word-break: keep-all`
- 새 JS 모듈 추가 시 [travel-guide/sw.js](travel-guide/sw.js) APP_SHELL + [travel-guide/index.html](travel-guide/index.html) `<script>` 둘 다 갱신

## 작업 방식
- 요청된 것만 변경 (외과적 변경)
- 메이저 작업 완료 시 git 커밋 (`feat:` / `fix:` / `refactor:` / `chore:` / `docs:`)
- 일정 변경 시 [travel-guide/js/data.js](travel-guide/js/data.js) 만 수정 — 다른 곳 하드코딩 금지

## 에이전트 사용 규칙

### 사용하는 에이전트 (필요 시 수동 호출)
| 에이전트 | 용도 | 호출 시점 |
|----------|------|-----------|
| typescript-reviewer | JS 코드 품질·보안·성능 리뷰 | 메이저 변경 완료 후 |
| build-error-resolver | 빌드/런타임 에러 해결 | 앱 실행 실패 시 |
| security-reviewer | 보안 취약점 탐지 | 커밋 전 민감 코드 변경 시 |
| refactor-cleaner | 불필요 코드 정리 | 대규모 리팩토링 시 |

### 사용하지 않는 에이전트
- planner, architect, tdd-guide, code-reviewer, e2e-runner, doc-updater
- 모든 비-JS 언어 에이전트 (Python, Go, Rust, Java, Kotlin, C++, Swift, PHP, Perl)
- chief-of-staff, loop-operator, harness-optimizer, database-reviewer, docs-lookup

### 자동 호출 금지
에이전트를 자동으로 호출하지 않는다. 사용자가 명시적으로 요청하거나 아래 검토 워크플로우에서만 호출한다.

## 글로벌 rules 적용 범위
- **적용**: coding-style, git-workflow, security, performance, typescript/
- **미적용**: testing, hooks, agents, development-workflow, patterns
- **미적용**: 비-JS 언어 rules (python, golang, swift, php, java, kotlin, cpp, perl)

## 최종 검토 워크플로우
메이저 기능 완료 후 커밋 전에 아래 검토를 수행한다:

1. **변경 범위 확인** — `git diff`로 변경된 파일·라인 확인
2. **JS 문법 검증** — `node --check` 모든 변경 JS 파일
3. **JavaScript 코드 리뷰** — typescript-reviewer 에이전트 호출 (메이저 변경 시)
   - 보안 (XSS, eval, 안전하지 않은 innerHTML)
   - 에러 핸들링 (catch 안 된 promise, 빈 catch)
   - 코드 품질 (네이밍, 불필요 복잡성)
4. **실행 검증** — `python -m http.server` 또는 `시작하기.bat` 정상 기동 확인
5. **라이브 자산 점검** — Netlify 라이브 URL의 모든 자산 200 OK
6. **문제 없으면 커밋 + push**
