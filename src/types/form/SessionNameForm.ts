import type {ValueOf} from 'type-fest';
import type Form from './Form';

const INPUT_IDS = {
  NAME: 'name',
} as const;

type InputID = ValueOf<typeof INPUT_IDS>;

type SessionNameForm = Form<
  InputID,
  {
    /** Name of the session */
    [INPUT_IDS.NAME]: string;
  }
>;

export type {SessionNameForm};
export default INPUT_IDS;
