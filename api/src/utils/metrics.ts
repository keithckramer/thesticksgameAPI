const counters = new Map<string, number>();

export const incrementMetric = (name: string): number => {
  const nextValue = (counters.get(name) ?? 0) + 1;
  counters.set(name, nextValue);

  if (process.env.NODE_ENV !== 'production') {
    console.debug('Metric incremented.', { name, value: nextValue });
  }

  return nextValue;
};

export const getMetric = (name: string): number | undefined => counters.get(name);

export default incrementMetric;

