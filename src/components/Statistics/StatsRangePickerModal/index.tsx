import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Button from '@components/Button';
import Modal from '@components/Modal';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import CONST from '@src/CONST';
import RangeCalendar from './RangeCalendar';

const styles = StyleSheet.create({
  container: {
    padding: 16,
    rowGap: 12,
  },
  title: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    columnGap: 8,
    justifyContent: 'flex-end',
  },
  button: {
    minWidth: 96,
  },
});

type Props = {
  isVisible: boolean;
  initialStart: Date;
  initialEnd: Date;
  onApply: (start: Date, end: Date) => void;
  onCancel: () => void;
};

type ContentProps = {
  initialStart: Date;
  initialEnd: Date;
  onApply: (start: Date, end: Date) => void;
  onCancel: () => void;
};

function PickerContent({
  initialStart,
  initialEnd,
  onApply,
  onCancel,
}: ContentProps) {
  const {appBG} = useTheme();
  const {translate} = useLocalize();
  const [pending, setPending] = useState<{start: Date; end: Date}>({
    start: initialStart,
    end: initialEnd,
  });

  return (
    <View style={[styles.container, {backgroundColor: appBG}]}>
      <Text fontSize={17} style={styles.title}>
        {translate('statistics.filters.customRange.title')}
      </Text>
      <RangeCalendar
        initialStart={initialStart}
        initialEnd={initialEnd}
        onChange={(start, end) => setPending({start, end})}
      />
      <View style={styles.actions}>
        <Button
          text={translate('statistics.filters.customRange.cancel')}
          onPress={onCancel}
          style={styles.button}
        />
        <Button
          success
          text={translate('statistics.filters.customRange.apply')}
          onPress={() => onApply(pending.start, pending.end)}
          style={styles.button}
        />
      </View>
    </View>
  );
}

function StatsRangePickerModal({
  isVisible,
  initialStart,
  initialEnd,
  onApply,
  onCancel,
}: Props) {
  return (
    <Modal
      isVisible={isVisible}
      onClose={onCancel}
      type={CONST.MODAL.MODAL_TYPE.CENTERED_SMALL}>
      {isVisible && (
        <PickerContent
          initialStart={initialStart}
          initialEnd={initialEnd}
          onApply={onApply}
          onCancel={onCancel}
        />
      )}
    </Modal>
  );
}

StatsRangePickerModal.displayName = 'StatsRangePickerModal';

export default StatsRangePickerModal;
