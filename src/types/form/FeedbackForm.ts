import type {ValueOf} from 'type-fest';
import type Form from './Form';

const INPUT_IDS = {
  TEXT: 'text',
} as const;

type FeedbackForm = Form<
  ValueOf<typeof INPUT_IDS>,
  {
    [INPUT_IDS.TEXT]: string;
  }
>;

export type {FeedbackForm};
export default INPUT_IDS;
