// ============================================
// 랭킹 디버깅 도구
// 브라우저 콘솔에서 실행
// ============================================

async function debugRanking() {
    console.log('=== 랭킹 디버깅 시작 ===');

    // 1. 현재 로그인 사용자 확인
    const user = CitySimAuth?.getCurrentUser?.() || firebase?.auth?.()?.currentUser;
    if (!user) {
        console.error('❌ 로그인되지 않음');
        return;
    }
    console.log('✅ 현재 사용자:', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
    });

    // 2. Firebase DB 접근 확인
    const db = firebase.firestore();
    if (!db) {
        console.error('❌ Firestore 연결 실패');
        return;
    }
    console.log('✅ Firestore 연결됨');

    // 3. publicProfiles에 내 프로필 존재 확인
    try {
        const myProfileSnap = await db.collection('publicProfiles').doc(user.uid).get();
        if (myProfileSnap.exists) {
            console.log('✅ 내 프로필 존재:', myProfileSnap.data());
        } else {
            console.warn('⚠️ 내 프로필이 publicProfiles에 없음!');
            console.log('💡 해결: 친구 탭 열기 또는 syncMyProfile() 호출 필요');
        }
    } catch (err) {
        console.error('❌ 프로필 조회 실패:', err);
        console.log('💡 Firebase 규칙 확인 필요');
    }

    // 4. publicProfiles 전체 개수 확인
    try {
        const allProfilesSnap = await db.collection('publicProfiles').get();
        console.log(`📊 전체 프로필 수: ${allProfilesSnap.size}개`);

        if (allProfilesSnap.size > 0) {
            console.log('📋 모든 프로필:');
            allProfilesSnap.docs.forEach((doc, idx) => {
                const data = doc.data();
                console.log(`  ${idx + 1}. ${data.displayName} (${doc.id}) - 명예: ${data.honor || 0}`);
            });
        } else {
            console.warn('⚠️ publicProfiles 컬렉션이 비어있음!');
        }
    } catch (err) {
        console.error('❌ 전체 프로필 조회 실패:', err);
    }

    // 5. 랭킹 쿼리 테스트
    try {
        const rankingSnap = await db.collection('publicProfiles')
            .orderBy('honor', 'desc')
            .limit(50)
            .get();
        console.log(`🏆 랭킹 조회 성공: ${rankingSnap.size}명`);

        if (rankingSnap.size > 0) {
            console.log('🥇 상위 랭킹:');
            rankingSnap.docs.forEach((doc, idx) => {
                const data = doc.data();
                console.log(`  ${idx + 1}위. ${data.displayName} - 명예: ${data.honor || 0} - Lv.${data.level || 1}`);
            });
        }
    } catch (err) {
        console.error('❌ 랭킹 쿼리 실패:', err);
        console.log('💡 Firestore 인덱스 생성 필요할 수 있음');
    }

    // 6. 수동 프로필 동기화 테스트
    console.log('\n💡 수동 프로필 동기화 방법:');
    console.log('  CitySimChat.syncMyProfile(game)');

    console.log('\n=== 랭킹 디버깅 완료 ===');
}

// 자동 실행
console.log('💡 랭킹 디버깅 도구 로드됨');
console.log('실행: debugRanking()');
