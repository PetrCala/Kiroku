import type {FetchDataKeys} from '@hooks/useFetchData/types';

type RefetchDatabaseData = (keys?: FetchDataKeys) => Promise<void>;

export default RefetchDatabaseData;
