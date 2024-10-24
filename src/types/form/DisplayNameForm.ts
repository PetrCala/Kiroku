import type {ValueOf} from 'type-fest';
import type Form from './Form';

const INPUT_IDS = {
  DISPLAY_NAME: 'displayName',
} as const;

type InputID = ValueOf<typeof INPUT_IDS>;

type DisplayNameForm = Form<
  InputID,
  {
    [INPUT_IDS.DISPLAY_NAME]: string;
  }
>;

export type {DisplayNameForm};
export default INPUT_IDS;
