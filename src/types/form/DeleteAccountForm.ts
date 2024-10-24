import type {ValueOf} from 'type-fest';
import type Form from './Form';

const INPUT_IDS = {
  REASON_FOR_LEAVING: 'reasonForLeaving',
  PASSWORD: 'password',
  SUCCESS: 'success',
} as const;

type InputID = ValueOf<typeof INPUT_IDS>;

type DeleteAccountForm = Form<
  InputID,
  {
    [INPUT_IDS.REASON_FOR_LEAVING]: string;
    [INPUT_IDS.PASSWORD]: string;
    [INPUT_IDS.SUCCESS]: string;
  }
>;

export type {DeleteAccountForm};
export default INPUT_IDS;
