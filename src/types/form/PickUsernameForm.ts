import type {ValueOf} from 'type-fest';
import type Form from './Form';

const INPUT_IDS = {
  USERNAME: 'username',
} as const;

type PickUsernameForm = Form<
  ValueOf<typeof INPUT_IDS>,
  {
    [INPUT_IDS.USERNAME]: string;
  }
>;

export type {PickUsernameForm};
export default INPUT_IDS;
