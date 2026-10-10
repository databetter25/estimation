# 추정량 과녁 실험실

점추정 이론(MME·MLE·UMVUE·CRLB)과 좋은 추정량의 조건(불편성·효율성·일치성·MSE)을 브라우저 시뮬레이션과 과녁 그림으로 배우는 정적 교육 사이트. 요구사항은 [PRD.md](PRD.md)에 있다.

**사이트: https://databetter25.github.io/estimation/**

## 실행

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # 엔진 단위 테스트 (이론값 대조)
npm run build      # dist/ 에 정적 사이트 생성
```

Node 22.12 이상이 필요하다.

## 구조

```
src/
├─ lib/engine/        시뮬레이션 엔진 (DOM 없음, Web Worker에서 실행)
│  ├─ rng.ts            시드 고정 난수 xoshiro128** + Marsaglia 극좌표 정규난수
│  ├─ distributions.ts  정규, 균등, t, 오염 정규, 코시
│  ├─ estimators.ts     추정량 10종, 분위수(R type 7)
│  ├─ simulate.ts       B회 반복 (공통 난수)
│  ├─ stats.ts          Bias/Var/MSE, MC 표준오차, 과녁 유형 판정, KDE
│  ├─ theory.ts         이론값, CRLB
│  ├─ worker.ts / client.ts
│  └─ engine.test.ts
├─ lib/ui/            차트(캔버스·SVG)와 페이지 인터랙션
├─ data/              장 목록, 추정량 메타데이터(KaTeX), 실험실 설정
├─ components/        Lab, ShootDemo, Consistency, FlowDiagram, Question, TryIt
├─ layouts/           Base(내비·테마·푸터), Chapter(개념 페이지)
└─ pages/             홈 + 0~7장 + 사이트 정보 (MDX + KaTeX)
```

새 추정량을 추가하려면 `estimators.ts`에 계산 함수, `data/estimators.ts`에 메타데이터, `data/labs.ts`의 실험실 목록에 id를 넣는다. 이론식이 있으면 `theory.ts`와 테스트에도 추가한다.

## 배포 (GitHub Pages)

1. GitHub 저장소를 만들고 이 폴더를 `main` 브랜치로 푸시한다.
2. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 바꾼다.
3. 푸시할 때마다 `.github/workflows/deploy.yml`이 테스트 → 빌드 → 배포를 실행한다. 주소는 `https://<계정>.github.io/<저장소 이름>/`.

워크플로가 `SITE`, `BASE_PATH` 환경변수를 저장소 이름에 맞춰 넣어 준다. 로컬에서 같은 경로로 확인하려면:

```bash
BASE_PATH=/저장소이름 npm run build && npm run preview
```

(Windows Git Bash에서는 앞에 `MSYS_NO_PATHCONV=1`을 붙인다.)

## 라이선스

- 콘텐츠: CC BY-NC-SA 4.0
- 코드: MIT
