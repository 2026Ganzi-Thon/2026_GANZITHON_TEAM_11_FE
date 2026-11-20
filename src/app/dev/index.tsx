import { Redirect, router } from 'expo-router';
import { Notice } from '../../ui/Notice';
import { canUseMock, isPreviewBuild } from '../../config/runtime';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../ui/Button';

export default function DeveloperMenu() {
  if (!canUseMock()) return <Redirect href="/" />;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          양 세는 밤
        </Text>
        <Text style={styles.description}>잠이 안 오는 밤, 양을 같이 세요.</Text>
        {canUseMock() && (
          <>
            <Button
              label="내 카드 작성·재제출"
              onPress={() => router.push('/dev/my-cards')}
            />
            <Button
              label="설정 이메일·문서 열람"
              onPress={() => router.push('/dev/settings-documents')}
            />
            <Button
              label="받은 털실·아침 홈 연결"
              onPress={() => router.push('/dev/received-yarn-home')}
            />
            <Button
              label="탈퇴·가입 복귀 미리보기"
              onPress={() => router.push('/dev/withdrawal')}
            />
            {isPreviewBuild() && (
              <Notice
                title="테스트 체험판"
                description="가입·고민·카드는 예시 데이터로 동작해요. 실제 계정은 만들지 않으며, 앱을 재실행하면 기록이 초기화돼요. 가상의 정보로 확인해 주세요. 알림 권한·기기 예약·외부 앱 열기는 실제로 동작해요."
              />
            )}
            <Button
              label="양 꾸미기·저장 미리보기"
              onPress={() => router.push('/dev/decoration')}
            />
            <Button
              label="또 왔네·다시 세기"
              onPress={() => router.push('/dev/night-return')}
            />
            <Button
              label="그만 세기 양·마무리"
              onPress={() => router.push('/dev/stop-offer')}
            />
            <Button
              label="고민 맡기기·아침 반영"
              onPress={() => router.push('/dev/entrust')}
            />
            <Button
              label="04시 마감·아침 전환"
              onPress={() => router.push('/dev/night-expiry')}
            />
            <Button
              label="밤→아침 시연"
              onPress={() => router.push('/dev/night-morning')}
            />
            <Button
              label="첫 홈 → 밤 → 아침 통합"
              onPress={() => router.push('/dev/home-night-morning')}
            />
            <Button
              label="가입 → 첫 홈 → 밤·아침"
              onPress={() => router.push('/dev/signup-home')}
            />
            <Button
              label="회원가입 온보딩 미리보기"
              onPress={() => router.push('/dev/signup')}
            />
            <Button
              label="밤 재진입·이어 세기 미리보기"
              onPress={() => router.push('/dev/night-reentry')}
            />
            <Button
              label="첫 밤 전 홈·시간 버튼"
              onPress={() => router.push('/dev/first-night-home')}
            />
            <Button
              label="Android 알림 연결"
              onPress={() => router.push('/dev/android-reminder')}
            />
            <Button
              label="공통 도움 안내 미리보기"
              onPress={() => router.push('/dev/card-support')}
            />
            <Button
              label="알림 설정 미리보기"
              onPress={() => router.push('/dev/reminder')}
            />
            <Button
              label="생년월일·설정·운세 연결"
              onPress={() => router.push('/dev/birth-date-flow')}
            />
            <Button
              label="생년월일 변경 미리보기"
              onPress={() => router.push('/dev/birth-date')}
            />
            <Button
              label="고민 삭제 미리보기"
              onPress={() => router.push('/dev/worry-deletion')}
            />
            <Button
              label="설정·고민 목록 미리보기"
              onPress={() => router.push('/dev/settings')}
            />
            <Button
              label="오늘의 운세 미리보기"
              onPress={() => router.push('/dev/fortune')}
            />
            <Button
              label="받은 털실 미리보기"
              onPress={() => router.push('/dev/received-yarn')}
            />
            <Button
              label="노래 카드 추천 미리보기"
              onPress={() => router.push('/dev/song-card')}
            />
            <Button
              label="솜털과 아침 후보 미리보기"
              onPress={() => router.push('/dev/fluff')}
            />
            <Button
              label="털실 반응 미리보기"
              onPress={() => router.push('/dev/yarn')}
            />
            <Button
              label="글 카드 쓰기 미리보기"
              onPress={() => router.push('/dev/text-card')}
            />
            <Button
              label="담은 노래 미리보기"
              onPress={() => router.push('/dev/saved-songs')}
            />
            <Button
              label="아침 회고 미리보기"
              onPress={() => router.push('/dev/morning-reflection')}
            />
            <Button
              label="로그인 화면 미리보기"
              onPress={() => router.push('/dev/login')}
            />
            <Button
              label="오늘 밤 화면 미리보기"
              onPress={() => router.push('/dev/night-entry')}
            />
            <Button
              label="피드 화면 미리보기"
              onPress={() => router.push('/dev/night-feed')}
            />
            <Button
              label="밤 마무리 미리보기"
              onPress={() => router.push('/dev/night-closing')}
            />
            <Button
              label="아침·양떼 미리보기"
              onPress={() => router.push('/dev/morning')}
            />
            <Button
              label="양 상세 미리보기"
              onPress={() => router.push('/dev/sheep-detail')}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#242460',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: {
    color: '#FFF4D6',
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: '#D5D5F4',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
  },
});
