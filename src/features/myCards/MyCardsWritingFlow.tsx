import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { CardWritingScreen } from '../cards/CardWritingScreen';
import { MyCardsScreen } from './MyCardsScreen';
import type { MyCardsWritingSource } from './types';

export function MyCardsWritingFlow(props: {
  source: MyCardsWritingSource;
  onBack: () => void;
}) {
  const [source, setSource] = useState({ value: props.source, version: 0 });
  if (source.value !== props.source)
    setSource({ value: props.source, version: source.version + 1 });
  return <WritingSession key={source.version} {...props} />;
}
function WritingSession({
  source,
  onBack,
}: {
  source: MyCardsWritingSource;
  onBack: () => void;
}) {
  const [writer, setWriter] = useState(() => source.createWritingSession());
  const [open, setOpen] = useState(false);
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
        submissionConfirmed={revision > 0}
        onWrite={() => {
          writingOpen.current = true;
          setOpen(true);
        }}
      />
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
