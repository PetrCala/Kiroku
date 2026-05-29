/** Selection mode of the unified date picker. */
type DateSelectorMode = 'single' | 'range';

/** View currently rendered by the calendar grid. */
type CalendarView = 'days' | 'years' | 'months';

type CalendarBoundsProps = {
  /** Earliest selectable day (inclusive). */
  minDate?: Date;

  /** Latest selectable day (inclusive). */
  maxDate?: Date;
};

type CalendarProps = CalendarBoundsProps &
  (
    | {
        mode: 'single';
        /** Initially selected day. */
        initialDate: Date;
        /** Fired whenever a day is tapped. */
        onChangeSingle: (date: Date) => void;
      }
    | {
        mode: 'range';
        /** Initially selected range start. */
        initialStart: Date;
        /** Initially selected range end. */
        initialEnd: Date;
        /** Fired once a range is completed (second tap). */
        onChangeRange: (start: Date, end: Date) => void;
      }
  );

type DateSelectorModalCommonProps = CalendarBoundsProps & {
  /** Whether the modal is open. */
  isVisible: boolean;

  /** Optional heading shown above the calendar. */
  title?: string;

  /** Optional explanatory copy shown below the title. */
  description?: string;

  /** Label of the confirm button. */
  applyText: string;

  /** Label of the dismiss button. */
  cancelText: string;

  /** Fired when the modal is dismissed without applying. */
  onCancel: () => void;
};

type DateSelectorModalProps = DateSelectorModalCommonProps &
  (
    | {
        mode: 'single';
        initialDate: Date;
        onApply: (date: Date) => void;
      }
    | {
        mode: 'range';
        initialStart: Date;
        initialEnd: Date;
        onApply: (start: Date, end: Date) => void;
      }
  );

export type {
  DateSelectorMode,
  CalendarView,
  CalendarProps,
  DateSelectorModalProps,
};
