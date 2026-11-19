import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { CardWritingScreen } from '../cards/CardWritingScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import type { SettingsActions } from '../settings/types';
import { MyCardsScreen } from './MyCardsScreen';
import type { MyCardsWritingSource } from './types';

export function MyCardsWritingFlow(props: {
  source: MyCardsWritingSource;
  onBack: () => void;
  settings?: SettingsActions;
}) {
  const [source, setSource] = useState({
    value: props.source,
    settings: props.settings,
    version: 0,
  });
  if (source.value !== props.source || source.settings !== props.settings)
    setSource({
      value: props.source,
      settings: props.settings,
      version: source.version + 1,
    });
  return <WritingSession key={source.version} {...props} />;
}
function WritingSession({
  source,
  onBack,
  settings,
}: {
  source: MyCardsWritingSource;
  onBack: () => void;
  settings?: SettingsActions;
}) {
  const [writer, setWriter] = useState(() => source.createWritingSession());
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const writingOpen = useRef(false);
  const close = () => {
    writingOpen.current = false;
    setOpen(false);
  };
  return (
    <>
      <StatusBar style="light" />
      <MyCardsScreen
        key={revision}
        actions={source}
        deletions={source}
        resubmissions={source}
        onBack={onBack}
        onSettings={settings ? () => setSettingsOpen(true) : undefined}
        submissionConfirmed={revision > 0}
        onWrite={() => {
          writingOpen.current = true;
          setOpen(true);
        }}
      />
      {settingsOpen && settings && (
        <SettingsScreen
          modal
          actions={settings}
          backLabel="내 카드로 돌아가기"
          onBack={() => setSettingsOpen(false)}
        />
      )}
      {open && (
        <CardWritingScreen
          modal
          entryContext="my_cards"
          actions={writer}
          onBack={close}
          onDone={() => {
            if (!writingOpen.current) return;
            close();
            setWriter(source.createWritingSession());
            setRevision((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
