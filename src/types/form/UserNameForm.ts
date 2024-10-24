import type {ValueOf} from 'type-fest';
import type Form from './Form';

const INPUT_IDS = {
  FIRST_NAME: 'firstName',
  LAST_NAME: 'lastName',
} as const;

type InputID = ValueOf<typeof INPUT_IDS>;

type UserNameForm = Form<
  InputID,
  {
    [INPUT_IDS.FIRST_NAME]: string;
    [INPUT_IDS.LAST_NAME]: string;
  }
>;

export type {UserNameForm};
export default INPUT_IDS;
