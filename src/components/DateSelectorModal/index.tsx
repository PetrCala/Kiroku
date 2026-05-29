import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Button from '@components/Button';
import Modal from '@components/Modal';
import Text from '@components/Text';
import useTheme from '@hooks/useTheme';
import CONST from '@src/CONST';
import Calendar from './Calendar';
import type {DateSelectorModalProps} from './types';

const localStyles = StyleSheet.create({
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

type FrameProps = {
  title?: string;
  description?: string;
  applyText: string;
  cancelText: string;
  onApply: () => void;
  onCancel: () => void;
  children: React.ReactNode;
};

function PickerFrame({
  title,
  description,
  applyText,
  cancelText,
  onApply,
  onCancel,
  children,
}: FrameProps) {
  const {componentBG, textSupporting} = useTheme();
  return (
    <View style={[localStyles.container, {backgroundColor: componentBG}]}>
      {title ? (
        <Text fontSize={17} style={localStyles.title}>
          {title}
        </Text>
      ) : null}
      {description ? <Text color={textSupporting}>{description}</Text> : null}
      {children}
      <View style={localStyles.actions}>
        <Button
          text={cancelText}
          onPress={onCancel}
          style={localStyles.button}
        />
        <Button
          success
          text={applyText}
          onPress={onApply}
          style={localStyles.button}
        />
      </View>
    </View>
  );
}

type SingleContentProps = Omit<FrameProps, 'onApply' | 'children'> & {
  initialDate: Date;
  minDate?: Date;
  maxDate?: Date;
  onApply: (date: Date) => void;
};

function SingleContent({
  initialDate,
  minDate,
  maxDate,
  onApply,
  title,
  description,
  applyText,
  cancelText,
  onCancel,
}: SingleContentProps) {
  const [pending, setPending] = useState<Date>(initialDate);
  return (
    <PickerFrame
      title={title}
      description={description}
      applyText={applyText}
      cancelText={cancelText}
      onCancel={onCancel}
      onApply={() => onApply(pending)}>
      <Calendar
        mode="single"
        initialDate={initialDate}
        minDate={minDate}
        maxDate={maxDate}
        onChangeSingle={setPending}
      />
    </PickerFrame>
  );
}

type RangeContentProps = Omit<FrameProps, 'onApply' | 'children'> & {
  initialStart: Date;
  initialEnd: Date;
  minDate?: Date;
  maxDate?: Date;
  onApply: (start: Date, end: Date) => void;
};

function RangeContent({
  initialStart,
  initialEnd,
  minDate,
  maxDate,
  onApply,
  title,
  description,
  applyText,
  cancelText,
  onCancel,
}: RangeContentProps) {
  const [pending, setPending] = useState<{start: Date; end: Date}>({
    start: initialStart,
    end: initialEnd,
  });
  return (
    <PickerFrame
      title={title}
      description={description}
      applyText={applyText}
      cancelText={cancelText}
      onCancel={onCancel}
      onApply={() => onApply(pending.start, pending.end)}>
      <Calendar
        mode="range"
        initialStart={initialStart}
        initialEnd={initialEnd}
        minDate={minDate}
        maxDate={maxDate}
        onChangeRange={(start, end) => setPending({start, end})}
      />
    </PickerFrame>
  );
}

/**
 * Unified date / date-range picker rendered in a centered, dimmed modal with a
 * solid surface. Selection is confirmed explicitly via the Apply button in both
 * modes.
 */
function DateSelectorModal(props: DateSelectorModalProps) {
  const {isVisible, title, description, applyText, cancelText, onCancel} =
    props;
  return (
    <Modal
      isVisible={isVisible}
      onClose={onCancel}
      type={CONST.MODAL.MODAL_TYPE.CENTERED_SMALL}>
      {isVisible && props.mode === 'single' ? (
        <SingleContent
          title={title}
          description={description}
          applyText={applyText}
          cancelText={cancelText}
          minDate={props.minDate}
          maxDate={props.maxDate}
          initialDate={props.initialDate}
          onApply={props.onApply}
          onCancel={onCancel}
        />
      ) : null}
      {isVisible && props.mode === 'range' ? (
        <RangeContent
          title={title}
          description={description}
          applyText={applyText}
          cancelText={cancelText}
          minDate={props.minDate}
          maxDate={props.maxDate}
          initialStart={props.initialStart}
          initialEnd={props.initialEnd}
          onApply={props.onApply}
          onCancel={onCancel}
        />
      ) : null}
    </Modal>
  );
}

DateSelectorModal.displayName = 'DateSelectorModal';

export default DateSelectorModal;
