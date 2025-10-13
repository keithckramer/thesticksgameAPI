const parseBoolean = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }

  switch (value.toLowerCase().trim()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    default:
      return false;
  }
};

export const loadFeatures = () => ({
  rbac: parseBoolean(process.env.FEATURE_RBAC),
});

export type FeatureFlags = ReturnType<typeof loadFeatures>;

export const features: FeatureFlags = loadFeatures();

export default features;
