import { useState } from 'react';
import { SongCardScreen } from '../cards/SongCardScreen';
import type { MyCardResubmitActions, RejectedSongCard } from './types';
export function ResubmitSongCardScreen({
  item,
  actions,
  onClose,
  onRefresh,
}: {
  item: RejectedSongCard;
  actions: MyCardResubmitActions;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [writer] = useState(() => actions.createSongResubmitSession!(item));
  return (
    <SongCardScreen
      modal
      actions={writer}
      onBack={onClose}
      onDone={onRefresh}
      completionLabel="내 카드로 돌아가기"
      conflictTitle="카드의 최신 상태를 확인해 주세요"
      resubmission={{
        id: item.id,
        reason: item.rejection_reason || '반려 사유를 확인하고 있어요.',
      }}
    />
  );
}
