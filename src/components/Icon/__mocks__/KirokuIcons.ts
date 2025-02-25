// eslint-disable-next-line import/no-import-module-exports
import type {SvgProps} from 'react-native-svg';

const KirokuIcons =
  jest.requireActual<Record<string, React.FC<SvgProps>>>('../KirokuIcons');

module.exports = Object.keys(KirokuIcons).reduce(
  (acc: Record<string, () => void>, curr) => {
    // We set the name of the anonymous mock function here so we can dynamically build the list of mocks and access the
    // "name" property to use in accessibility hints for element querying
    const fn = () => '';
    Object.defineProperty(fn, 'name', {value: curr});
    acc[curr] = fn;
    return acc;
  },
  {},
);
