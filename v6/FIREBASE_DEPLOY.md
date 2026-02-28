# Firebase 보안 규칙 배포 가이드

## 📋 개요

플레이어 맵 렌더링 시스템이 구현되었으며, Firebase Firestore 보안 규칙을 배포해야 합니다.

---

## 🔐 보안 규칙 요약

### `publicBases` 컬렉션
- **읽기**: 모든 사용자 (방문 시스템용)
- **쓰기**: 본인만 가능
- **목적**: 다른 플레이어의 기지를 읽기 전용으로 볼 수 있도록 허용

### `publicProfiles` 컬렉션
- **읽기**: 모든 사용자
- **쓰기**: 본인만 가능
- **목적**: 플레이어 프로필 정보 공유

### `globalChat` 컬렉션
- **읽기**: 인증된 사용자만
- **쓰기**: 인증된 사용자만 (메시지 200자 제한)
- **수정/삭제**: 불가 (채팅 불변성)

### `users/{uid}` 컬렉션
- **읽기/쓰기**: 본인만 가능
- **목적**: 비공개 데이터 (친구 목록, 보관함 등)

---

## 🚀 Firebase 콘솔에서 배포하기

### 방법 1: Firebase 콘솔 (웹 UI)

1. **Firebase 콘솔 접속**
   - https://console.firebase.google.com
   - 프로젝트 선택

2. **Firestore Database 메뉴 이동**
   - 왼쪽 메뉴에서 "Firestore Database" 클릭
   - 상단 탭에서 "규칙" 클릭

3. **규칙 복사 & 붙여넣기**
   - `firestore.rules` 파일 내용 전체 복사
   - Firebase 콘솔의 규칙 편집기에 붙여넣기

4. **게시**
   - "게시" 버튼 클릭
   - 변경 사항 확인 후 완료

---

### 방법 2: Firebase CLI (명령줄)

1. **Firebase CLI 설치** (없는 경우)
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase 로그인**
   ```bash
   firebase login
   ```

3. **프로젝트 초기화** (처음인 경우)
   ```bash
   firebase init firestore
   ```
   - 기존 프로젝트 선택
   - `firestore.rules` 파일 경로 확인

4. **규칙 배포**
   ```bash
   firebase deploy --only firestore:rules
   ```

5. **배포 확인**
   ```bash
   firebase firestore:rules:get
   ```

---

## ⚠️ 주의사항

### 1. 기존 규칙 백업
배포 전에 현재 Firebase 콘솔에서 기존 규칙을 복사하여 백업하세요.

### 2. 테스트 환경에서 먼저 테스트
- 가능하면 테스트 프로젝트에서 먼저 규칙을 배포하고 테스트
- 읽기/쓰기 권한이 의도대로 작동하는지 확인

### 3. 보안 검증
- Firebase 콘솔의 "규칙 시뮬레이터"로 테스트
- 비인증 사용자가 `publicBases`를 읽을 수 있는지 확인
- 다른 사용자의 `publicBases`를 수정할 수 없는지 확인

---

## 🧪 규칙 테스트 예시

### Firebase 콘솔 시뮬레이터

**테스트 1: publicBases 읽기 (비인증 사용자)**
```
위치: /publicBases/user123
요청 유형: get
인증: 없음
```
✅ 예상 결과: **허용**

**테스트 2: publicBases 쓰기 (다른 사용자)**
```
위치: /publicBases/user123
요청 유형: update
인증: user456
```
❌ 예상 결과: **거부**

**테스트 3: publicBases 쓰기 (본인)**
```
위치: /publicBases/user123
요청 유형: update
인증: user123
```
✅ 예상 결과: **허용**

---

## 📊 규칙 검증 체크리스트

배포 후 다음 항목을 확인하세요:

- [ ] 로그인하지 않은 사용자가 다른 플레이어의 기지를 볼 수 있음
- [ ] 자신의 기지만 수정할 수 있음
- [ ] 다른 사용자의 기지는 수정할 수 없음
- [ ] 채팅은 인증된 사용자만 사용 가능
- [ ] 채팅 메시지는 200자 제한이 적용됨
- [ ] 친구 목록은 본인만 볼 수 있음

---

## 🐛 문제 해결

### "권한 거부" 오류
- Firebase 콘솔에서 규칙이 정상적으로 배포되었는지 확인
- 브라우저 캐시 삭제 후 재시도
- 로그아웃 후 다시 로그인

### "읽기 실패" 오류
- Firebase 프로젝트 ID가 올바른지 확인
- `firebase-bridge.js`의 설정 확인
- 네트워크 콘솔에서 Firestore 요청 확인

---

## 📝 추가 보안 권장사항

1. **Rate Limiting**: Cloud Functions로 API 호출 제한 구현
2. **데이터 검증**: 클라이언트 측 데이터 유효성 검사 강화
3. **민감 정보 제거**: 기지 데이터에 민감 정보 포함하지 않기
4. **감사 로그**: Cloud Functions로 중요 작업 로깅

---

## 🎯 다음 단계

1. Firebase 규칙 배포 완료
2. 테스트 계정으로 방문 기능 테스트
3. 프로덕션 환경에서 모니터링
4. 사용자 피드백 수집 및 개선

---

**배포 완료 후 게임을 즐기세요!** 🎮
