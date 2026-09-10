// Jest picks this up automatically for `react-native-device-info` (it sits next
// to node_modules), so it has to export the module surface itself.

const getUniqueId = jest.fn(() => Promise.resolve('unique-id'));

// generateDeviceID (reached via actions/Device) reads the model id at import.
const getDeviceId = jest.fn(() => 'device-model');

export {getUniqueId, getDeviceId};
export default {getUniqueId, getDeviceId};
