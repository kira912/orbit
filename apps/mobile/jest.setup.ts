// expo-constants reads native config that doesn't exist under plain Jest.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: undefined } },
}));
