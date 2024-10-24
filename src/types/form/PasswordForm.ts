import type {ValueOf} from 'type-fest';
import type Form from './Form';

const INPUT_IDS = {
  PASSWORD: 'password',
  RE_ENTER_PASSWORD: 'reEnterPassword',
} as const;

type InputID = ValueOf<typeof INPUT_IDS>;

type PasswordForm = Form<
  InputID,
  {
    [INPUT_IDS.PASSWORD]: string;
    [INPUT_IDS.RE_ENTER_PASSWORD]: string;
  }
>;

export type {PasswordForm};
export default INPUT_IDS;
